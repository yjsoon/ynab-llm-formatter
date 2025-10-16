import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// LLM Configuration
// Default to Google AI Studio if API key exists, but allow explicit override via LLM_PROVIDER env var
const defaultProvider = process.env.GOOGLEAISTUDIO_API_KEY ? 'googleaistudio' :
                       process.env.OPENROUTER_API_KEY ? 'openrouter' :
                       process.env.Z_AI_API_KEY ? 'z.ai' : 'lm-studio';




const GOOGLEAISTUDIO_API_KEY = process.env.GOOGLEAISTUDIO_API_KEY;
const GOOGLEAISTUDIO_MODEL = process.env.GOOGLEAISTUDIO_MODEL || 'gemini-2.5-flash-lite';
const Z_AI_API_KEY = process.env.Z_AI_API_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-flash-1.5-8b';
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://localhost:1234/v1';
const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL || 'qwen2.5-vl-7b-instruct';


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

// Helper function to generate the common extraction prompt
function generateExtractionPrompt(currentYear: number, currentMonth: number, customPrompt?: string | null): string {
  return `Extract all credit card transactions from this statement image.

Today's date: ${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}

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
${customPrompt ? `
Additional instructions from user:
${customPrompt}` : ''}

Return ONLY the JSON array, no other text.`;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const selectedModel = formData.get('model') as string;
    const selectedProvider = formData.get('provider') as string;
    const customPrompt = formData.get('customPrompt') as string | null;

    // Determine which provider to use - frontend selection takes priority
    // Default to Google AI Studio when no explicit selection and GAI API key exists
    let effectiveProvider = selectedProvider || process.env.LLM_PROVIDER || defaultProvider;
    
    // Force Google AI Studio as default when both API keys exist but no explicit provider chosen
    if (!selectedProvider && !process.env.LLM_PROVIDER && process.env.GOOGLEAISTUDIO_API_KEY) {
      effectiveProvider = 'googleaistudio';
    }

    

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files (PNG/JPG) are supported' },
        { status: 400 }
      );
    }

    // Check configuration based on provider
    if (effectiveProvider === 'googleaistudio' && !GOOGLEAISTUDIO_API_KEY) {
      console.error('GOOGLEAISTUDIO_API_KEY not configured');
      return NextResponse.json(
        { error: 'Google AI Studio API key not configured' },
        { status: 500 }
      );
    }

    if (effectiveProvider === 'openrouter' && !OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY not configured');
      return NextResponse.json(
        { error: 'OpenRouter API key not configured' },
        { status: 500 }
      );
    }

    if (effectiveProvider === 'z.ai' && !Z_AI_API_KEY) {
      console.error('Z_AI_API_KEY not configured');
      return NextResponse.json(
        { error: 'Z.AI API key not configured' },
        { status: 500 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Get current date for year inference
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    // Process image
    const base64 = buffer.toString('base64');
    const mimeType = file.type || 'image/jpeg';
    const imageData = `data:${mimeType};base64,${base64}`;

    try {
      let response;
      let transactions: TransactionData[] = [];

      if (effectiveProvider === 'googleaistudio') {
        // GOOGLE AI STUDIO PATH - Isolated implementation
        console.log(`Calling Google AI Studio API with model: ${GOOGLEAISTUDIO_MODEL}`);

        const prompt = generateExtractionPrompt(currentYear, currentMonth, customPrompt);

        // Google AI Studio API format - separate text and image parts
        const requestBody = {
          contents: [{
            parts: [
              {
                text: prompt
              },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4000
          }
        };

        response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${GOOGLEAISTUDIO_MODEL}:generateContent?key=${GOOGLEAISTUDIO_API_KEY}`,
          requestBody,
          {
            headers: { 'Content-Type': 'application/json' }
          }
        );

      } else if (effectiveProvider === 'openrouter') {
        // OPENROUTER PATH - Isolated implementation
        let modelToUse = selectedModel || OPENROUTER_MODEL;
        
        
        
        console.log(`Calling OpenRouter API with model: ${modelToUse}`);

        const prompt = generateExtractionPrompt(currentYear, currentMonth, customPrompt);

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
                text: prompt
              },
              {
                type: 'image_url',
                image_url: { url: imageData }
              }
            ]
          }
        ];

        response = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: modelToUse,
            messages,
            temperature: 0.1,
            max_tokens: 4000
          },
          {
            headers: {
              'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'http://localhost:3000',
              'X-Title': 'YNAB Statement Formatter'
            }
          }
        );

      } else if (effectiveProvider === 'lm-studio') {
        // LOCAL MODEL PATH - Two-step CSV approach
        console.log(`Calling LM Studio: ${LM_STUDIO_MODEL}`);

        // Step 1: Extract to CSV (simpler for local models)
        const csvMessages = [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extract all credit card transactions from this image to CSV format.

Today's date: ${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}

Create CSV with headers: Date,Payee,Memo,Outflow,Inflow

Rules:
- Date: Statements may use DD/MM/YYYY, MM/DD/YYYY, or other formats - intelligently parse to YYYY-MM-DD output
- When date format is ambiguous (e.g., 04/06/2025 could be April 6 or June 4), use these heuristics:
  * Prefer DD/MM interpretation if both are valid dates
  * Choose the date closest to current month (${currentMonth}/${currentYear})
  * Example: if it's September, 04/06 is more likely June 4th than April 6th
- If the statement omits the year entirely, infer a single consistent year for all rows based on any printed year (e.g. statement period). When no year is visible anywhere, keep the same year as the first transaction you extract and do not decrement the year when the month number decreases.
- Payee: merchant/company name
- Memo: Only foreign currency (e.g. "USD 50.00") or location if different from payee
- Outflow: charges/debits as positive amount with $ (e.g. "$123.45")
- Inflow: credits/payments as positive amount with $ (e.g. "$50.00")
- Each row has EITHER Outflow OR Inflow, not both
- Extract EVERY transaction visible
${customPrompt ? `
Additional instructions from user:
${customPrompt}` : ''}

Output the CSV starting with the header line.`
              },
              {
                type: 'image_url',
                image_url: { url: imageData }
              }
            ]
          }
        ];

        const csvResponse = await axios.post(
          `${LM_STUDIO_URL}/chat/completions`,
          {
            model: LM_STUDIO_MODEL,
            messages: csvMessages,
            temperature: 0,
            max_tokens: 4000
          },
          {
            headers: { 'Content-Type': 'application/json' }
          }
        );

        const csvContent = csvResponse.data.choices[0].message.content;
        console.log('Step 1 - CSV extracted:', csvContent);

        // Step 2: Convert CSV to JSON
        const jsonResponse = await axios.post(
          `${LM_STUDIO_URL}/chat/completions`,
          {
            model: LM_STUDIO_MODEL,
            messages: [
              {
                role: 'user',
                content: `Convert this CSV to JSON array. Each row becomes an object with lowercase keys: date, payee, memo, outflow, inflow.
Empty cells become empty strings "".

CSV:
${csvContent}

Output only the JSON array starting with [ and ending with ]`
              }
            ],
            temperature: 0,
            max_tokens: 4000
          },
          {
            headers: { 'Content-Type': 'application/json' }
          }
        );

        response = jsonResponse;
        console.log('Step 2 - Converted to JSON');

      } else {
        // Z.AI PATH - Direct JSON extraction
        const model = 'glm-4.5v';
        console.log(`Calling z.ai API with model: ${model}`);

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
                text: generateExtractionPrompt(currentYear, currentMonth, customPrompt)
              },
              {
                type: 'image_url',
                image_url: { url: imageData }
              }
            ]
          }
        ];

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
      try {
        let rawContent;
        
        // Handle different response formats based on provider
        if (effectiveProvider === 'googleaistudio') {
          rawContent = response?.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        } else {
          // OpenRouter, z.ai, and others use the same format
          rawContent = response?.data?.choices?.[0]?.message?.content;
        }
        if (typeof rawContent !== "string") {
          console.error('Missing content in AI response:', response?.data);
          return NextResponse.json(
            { error: 'AI response did not contain text content' },
            { status: 502 }
          );
        }

        let content = rawContent;
        console.log('AI Response:', content.substring(0, 500));

        // Clean up common issues
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');

        // Extract JSON array
        let parsed: unknown;
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          parsed = JSON.parse(content);
        }

        if (Array.isArray(parsed)) {
          transactions = parsed as TransactionData[];
        } else if (parsed && typeof parsed === "object" && Array.isArray((parsed as { transactions?: TransactionData[] }).transactions)) {
          transactions = (parsed as { transactions: TransactionData[] }).transactions;
        } else {
          console.error('Unexpected AI response shape:', parsed);
          return NextResponse.json(
            { error: 'AI response did not include a transaction list' },
            { status: 422 }
          );
        }

        console.log(`Parsed ${transactions.length} transactions`);
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        return NextResponse.json(
          { error: 'Could not parse AI response' },
          { status: 502 }
        );
      }

      // Clean and validate transactions
      const cleanedTransactions = transactions.map((tx: TransactionData) => ({
        date: tx.date || '',
        payee: tx.payee || tx.merchant || '',
        memo: tx.memo || tx.details || '',
        outflow: tx.outflow || '',
        inflow: tx.inflow || ''
      }));

      return NextResponse.json({ transactions: cleanedTransactions });

    } catch (apiError) {
      const error = apiError as Error & {
        code?: string;
        response?: {
          data?: unknown;
          status?: number;
        };
      };
      // Fix provider name mapping - use the actual effectiveProvider value
      const provider = effectiveProvider === 'googleaistudio' ? 'Google AI Studio' :
                      effectiveProvider === 'openrouter' ? 'OpenRouter' :
                      effectiveProvider === 'lm-studio' ? 'LM Studio' : 'z.ai';
      console.error(`${provider} API error:`, error.response?.data || error.message);

      if (error.code === 'ECONNREFUSED' && effectiveProvider === 'lm-studio') {
        return NextResponse.json(
          { error: `Cannot connect to LM Studio at ${LM_STUDIO_URL}. Please ensure LM Studio is running.` },
          { status: 503 }
        );
      }

      if (error.response?.status === 401) {
        return NextResponse.json(
          { error: `Invalid API key for ${provider}` },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: `${provider} API error: ${error.message}` },
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