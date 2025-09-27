import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// Get OpenRouter API key
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

interface ModelTestRequest {
  models: string[];
  imageData: string;
}

interface TransactionItem {
  date?: string;
  payee?: string;
  memo?: string;
  outflow?: string;
  inflow?: string;
}

interface ModelResult {
  model: string;
  transactions: TransactionItem[];
  processingTime: number;
  error?: string;
  transactionCount: number;
  totalOutflow: number;
  totalInflow: number;
  cost?: number;
  tokens?: {
    prompt: number;
    completion: number;
  };
}

async function processWithModel(
  model: string,
  imageData: string
): Promise<ModelResult> {
  const startTime = Date.now();

  try {
    // Get current date for year inference
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    const messages = [
      {
        role: 'system',
        content: 'You are a financial data extraction assistant. Extract credit card transactions and return them in JSON format.'
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract all credit card transactions from this statement image.

Today's date: ${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}

Return a JSON array where each transaction has these fields:
- date: YYYY-MM-DD format (use transaction date, not posting date)
- payee: merchant name
- memo: foreign currency (e.g. "USD 50.00") or location only, leave empty if none
- outflow: debit amount with $ (e.g. "$123.45") or empty string ""
- inflow: credit amount with $ (e.g. "$50.00") or empty string ""

Rules:
- Date format: Intelligently parse dates which may be in DD/MM/YYYY, MM/DD/YYYY or other formats
- For ambiguous dates (e.g., 04/06 could be April 6 or June 4):
  * Prefer DD/MM interpretation when both are valid
  * Choose the date closest to ${currentMonth}/${currentYear}
- Each transaction has EITHER outflow OR inflow, never both
- If the statement omits the year, assume the entire statement belongs to a single year. Use any printed statement year if present; otherwise keep the same inferred year for every row even when the month number wraps around.
- Do NOT include reference numbers in memo

Return ONLY the JSON array, no other text.`
          },
          {
            type: 'image_url',
            image_url: { url: imageData }
          }
        ]
      }
    ];

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model,
        messages,
        temperature: 0.1,
        max_tokens: 4000
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'YNAB Model Tester'
        }
      }
    );

    // Parse the response
    let content = response.data.choices[0].message.content;
    console.log(`${model} response:`, content.substring(0, 200));

    // Clean up common issues
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');

    // Extract JSON array
    let transactions = [];
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      transactions = JSON.parse(jsonMatch[0]);
    } else {
      transactions = JSON.parse(content);
    }

    // Calculate totals for comparison
    let totalOutflow = 0;
    let totalInflow = 0;

    transactions.forEach((tx: TransactionItem) => {
      if (tx.outflow) {
        const amount = parseFloat(tx.outflow.replace(/[\$,]/g, ''));
        if (!isNaN(amount)) totalOutflow += amount;
      }
      if (tx.inflow) {
        const amount = parseFloat(tx.inflow.replace(/[\$,]/g, ''));
        if (!isNaN(amount)) totalInflow += amount;
      }
    });

    const processingTime = Date.now() - startTime;

    // Extract token usage and cost from response headers
    const usage = response.data.usage;
    let cost = 0;
    const tokens = { prompt: 0, completion: 0 };

    if (usage) {
      tokens.prompt = usage.prompt_tokens || 0;
      tokens.completion = usage.completion_tokens || 0;
      // OpenRouter provides total cost in the response
      cost = usage.total_cost || 0;
    }

    return {
      model,
      transactions,
      processingTime,
      transactionCount: transactions.length,
      totalOutflow: Math.round(totalOutflow * 100) / 100,
      totalInflow: Math.round(totalInflow * 100) / 100,
      cost,
      tokens
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const err = error as Error & { response?: { data?: { error?: { message?: string } } } };
    console.error(`Error processing with ${model}:`, err.response?.data || err.message);

    return {
      model,
      transactions: [],
      processingTime,
      error: err.response?.data?.error?.message || err.message,
      transactionCount: 0,
      totalOutflow: 0,
      totalInflow: 0,
      cost: 0
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check for API key
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      );
    }

    const body: ModelTestRequest = await request.json();
    const { models, imageData } = body;

    if (!models || models.length === 0) {
      return NextResponse.json(
        { error: 'No models specified' },
        { status: 400 }
      );
    }

    if (!imageData) {
      return NextResponse.json(
        { error: 'No image data provided' },
        { status: 400 }
      );
    }

    console.log(`Testing ${models.length} models in parallel...`);

    // Process all models in parallel
    const promises = models.map(model => processWithModel(model, imageData));
    const results = await Promise.all(promises);

    // Sort by processing time
    results.sort((a, b) => a.processingTime - b.processingTime);

    // Check for consensus on transaction count and totals
    const counts = results.map(r => r.transactionCount);
    const uniqueCounts = [...new Set(counts)];
    const hasConsensus = uniqueCounts.length === 1 && uniqueCounts[0] > 0;

    return NextResponse.json({
      results,
      summary: {
        totalModels: models.length,
        successfulModels: results.filter(r => !r.error).length,
        fastestModel: results[0]?.model,
        fastestTime: results[0]?.processingTime,
        slowestModel: results[results.length - 1]?.model,
        slowestTime: results[results.length - 1]?.processingTime,
        hasConsensus,
        consensusCount: hasConsensus ? uniqueCounts[0] : null
      }
    });

  } catch (error) {
    console.error('Error in model testing:', error);
    return NextResponse.json(
      { error: 'Failed to test models' },
      { status: 500 }
    );
  }
}