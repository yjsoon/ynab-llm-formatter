import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// LLM Configuration
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'z.ai';
const Z_AI_API_KEY = process.env.Z_AI_API_KEY;
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://localhost:1234/v1';
const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL || 'mini-cpm';

// Import the CommonJS module
const { parsePDF } = require('@/lib/pdf-parser');

interface TransactionData {
  date?: string;
  merchant?: string;
  payee?: string;
  amount?: number | string;
  type?: 'debit' | 'credit';
  details?: string;
  memo?: string;
  outflow?: string;
  inflow?: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check configuration based on provider
    if (LLM_PROVIDER === 'z.ai' && !Z_AI_API_KEY) {
      console.error('Z_AI_API_KEY not configured');
      return NextResponse.json(
        { error: 'Z.AI API key not configured' },
        { status: 500 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let messages;
    let model = 'glm-4.5v'; // Default to vision model

    // Handle PDFs and images
    if (file.type === 'application/pdf') {
      // Extract text from PDF
      let extractedText = '';
      try {
        extractedText = await parsePDF(buffer);
        console.log('Extracted PDF text (first 500 chars):', extractedText.substring(0, 500));

        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error('No text could be extracted from PDF');
        }
      } catch (err) {
        console.error('PDF extraction failed:', err);
        return NextResponse.json(
          { error: 'Failed to extract text from PDF. Please try converting to an image (PNG/JPG) instead.' },
          { status: 400 }
        );
      }

      // Use text model for PDFs
      model = 'glm-4.5';

      // Get current date for year inference
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1; // 0-indexed

      messages = [
        {
          role: 'system',
          content: `You are a financial data extraction assistant. Extract credit card transaction data from statements and return it in a specific JSON format.`
        },
        {
          role: 'user',
          content: `Extract all transactions from this credit card statement text.

Today is ${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}.

Return a JSON array where each transaction has exactly these fields:
- date: YYYY-MM-DD format (use transaction date, not posting date)
- payee: merchant name
- memo: foreign currency or location only (leave empty if none)
- outflow: debit amount with $ (e.g. "$123.45") or empty string
- inflow: credit amount with $ (e.g. "$50.00") or empty string

Rules:
- Each transaction has EITHER outflow OR inflow, never both
- If date has no year: months after ${currentMonth} are year ${currentYear - 1}, others are ${currentYear}
- Skip reference numbers in memo

Example output:
[
  {"date": "2025-09-15", "payee": "Starbucks", "memo": "", "outflow": "$4.50", "inflow": ""},
  {"date": "2025-09-14", "payee": "Amazon", "memo": "USD 25.00", "outflow": "$33.75", "inflow": ""}
]

Statement text:
${extractedText}

Return ONLY the JSON array, no other text.`
        }
      ];
    } else {
      // Handle images (PNG, JPG, etc.)
      const base64 = buffer.toString('base64');
      const mimeType = file.type || 'image/jpeg';
      const dataUri = `data:${mimeType};base64,${base64}`;

      // Get current date for year inference
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1; // 0-indexed

      messages = [
        {
          role: 'system',
          content: `You are a financial data extraction assistant. Extract credit card transaction data from statements and return it in a specific JSON format.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract all transactions from this credit card statement image.

Today is ${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}.

Return a JSON array where each transaction has exactly these fields:
- date: YYYY-MM-DD format (use transaction date, not posting date)
- payee: merchant name
- memo: foreign currency or location only (leave empty if none)
- outflow: debit amount with $ (e.g. "$123.45") or empty string
- inflow: credit amount with $ (e.g. "$50.00") or empty string

Rules:
- Each transaction has EITHER outflow OR inflow, never both
- If date has no year: months after ${currentMonth} are year ${currentYear - 1}, others are ${currentYear}
- Skip reference numbers in memo

Example output:
[
  {"date": "2025-09-15", "payee": "Starbucks", "memo": "", "outflow": "$4.50", "inflow": ""},
  {"date": "2025-09-14", "payee": "Amazon", "memo": "USD 25.00", "outflow": "$33.75", "inflow": ""}
]

Return ONLY the JSON array, no other text.`
            },
            {
              type: 'image_url',
              image_url: {
                url: dataUri
              }
            }
          ]
        }
      ];
    }

    try {
      let response;

      if (LLM_PROVIDER === 'lm-studio') {
        // LM Studio configuration (OpenAI-compatible API)
        console.log(`Calling LM Studio with model: ${LM_STUDIO_MODEL}`);

        // Optimize prompts for local models like Qwen
        const optimizedMessages = messages.map(msg => {
          if (msg.role === 'system') {
            // Stronger system prompt for local models
            return {
              ...msg,
              content: 'You are a JSON extraction tool. Extract transaction data and output ONLY valid JSON. No explanations, no markdown, just JSON array.'
            };
          }
          if (msg.role === 'user' && typeof msg.content === 'string') {
            // Simplify for text-based PDFs
            return {
              ...msg,
              content: msg.content.replace('Return ONLY the JSON array, no other text.',
                'Output format: JSON array only.\nStart your response with [ and end with ]')
            };
          }
          return msg;
        });

        response = await axios.post(
          `${LM_STUDIO_URL}/chat/completions`,
          {
            model: LM_STUDIO_MODEL,
            messages: optimizedMessages,
            temperature: 0.0, // More deterministic for local models
            max_tokens: 4000,
            top_p: 0.1, // Reduce randomness
            frequency_penalty: 0,
            presence_penalty: 0
          },
          {
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
      } else {
        // Z.AI configuration (default)
        console.log(`Calling z.ai API with model: ${model}`);

        response = await axios.post(
          'https://api.z.ai/api/paas/v4/chat/completions',
          {
            model,
            messages,
            temperature: 0.1,
            max_tokens: 4000
          },
          {
            headers: {
              'Authorization': `Bearer ${Z_AI_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
      }

      // Parse the response
      let transactions = [];
      try {
        let content = response.data.choices[0].message.content;
        console.log('AI Response:', content);

        // Clean up response for local models (they might add extra text)
        if (LLM_PROVIDER === 'lm-studio') {
          // Remove markdown code blocks if present
          content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
          // Remove any text before the first [
          const startIdx = content.indexOf('[');
          if (startIdx > 0) {
            content = content.substring(startIdx);
          }
          // Remove any text after the last ]
          const endIdx = content.lastIndexOf(']');
          if (endIdx > -1 && endIdx < content.length - 1) {
            content = content.substring(0, endIdx + 1);
          }
        }

        // Try to extract JSON from the response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          transactions = JSON.parse(jsonMatch[0]);
        } else {
          transactions = JSON.parse(content);
        }

        console.log(`Parsed ${transactions.length} transactions`);
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        console.log('Raw AI response:', response.data);

        // Return empty transactions with error
        return NextResponse.json({
          error: 'AI could not extract transactions from the document. The response was not in the expected format.',
          transactions: []
        });
      }

      // If we got empty array, return a message
      if (transactions.length === 0) {
        return NextResponse.json({
          error: 'No transactions found in the document. Please ensure the document contains transaction data.',
          transactions: []
        });
      }

      // Validate and clean the transactions
      const cleanedTransactions = transactions.map((tx: TransactionData) => ({
        date: tx.date || '',
        payee: tx.payee || tx.merchant || '',
        memo: tx.memo || tx.details || '',
        outflow: tx.outflow || '',
        inflow: tx.inflow || ''
      }));

      return NextResponse.json({ transactions: cleanedTransactions });

    } catch (apiError) {
      const error = apiError as any;
      const provider = LLM_PROVIDER === 'lm-studio' ? 'LM Studio' : 'z.ai';
      console.error(`${provider} API error:`, error.response?.data || error.message);

      if (error.code === 'ECONNREFUSED' && LLM_PROVIDER === 'lm-studio') {
        return NextResponse.json(
          { error: `Cannot connect to LM Studio at ${LM_STUDIO_URL}. Please ensure LM Studio is running and the server is started.` },
          { status: 503 }
        );
      }

      if (error.response?.status === 401) {
        return NextResponse.json(
          { error: `Invalid API key. Please check your ${provider} API key.` },
          { status: 401 }
        );
      }

      if (error.response?.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: `${provider} API error: ${error.response?.data?.error?.message || error.message}` },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error processing statement:', error);
    return NextResponse.json(
      { error: 'Failed to process statement' },
      { status: 500 }
    );
  }
}