import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// LLM Configuration
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'z.ai';
const Z_AI_API_KEY = process.env.Z_AI_API_KEY;
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://localhost:1234/v1';
const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL || 'qwen2.5-vl-7b-instruct';

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

    // Get current date for year inference
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    let messages;
    let model = 'glm-4.5v'; // Default to vision model for z.ai

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

      // Use text model for PDFs with z.ai
      model = 'glm-4.5';

      messages = [
        {
          role: 'system',
          content: 'Extract credit card transactions and return as JSON.'
        },
        {
          role: 'user',
          content: `Extract all transactions from this statement.

Date format: YYYY-MM-DD
Today: ${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}

Return JSON array with fields: date, payee, memo, outflow, inflow

Statement:
${extractedText}

Output only the JSON array.`
        }
      ];
    } else {
      // Handle images
      const base64 = buffer.toString('base64');
      const mimeType = file.type || 'image/jpeg';
      const dataUri = `data:${mimeType};base64,${base64}`;

      messages = [
        {
          role: 'system',
          content: 'Extract credit card transactions and return as JSON.'
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Extract all transactions from this statement.

Date format: YYYY-MM-DD
Today: ${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}

Return JSON array with fields: date, payee, memo, outflow, inflow

Output only the JSON array.`
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
        console.log(`Calling LM Studio: ${LM_STUDIO_MODEL}`);

        // For local models, use two-step approach
        // Step 1: Get CSV
        const csvResponse = await axios.post(
          `${LM_STUDIO_URL}/chat/completions`,
          {
            model: LM_STUDIO_MODEL,
            messages: [
              {
                role: 'user',
                content: messages[1].content && Array.isArray(messages[1].content)
                  ? [
                      {
                        type: 'text',
                        text: 'Extract all transactions to CSV format. Headers: Date,Payee,Memo,Outflow,Inflow'
                      },
                      ...messages[1].content.filter(item => item.type === 'image_url')
                    ]
                  : 'Extract all transactions to CSV format. Headers: Date,Payee,Memo,Outflow,Inflow\n\n' + extractedText
              }
            ],
            temperature: 0,
            max_tokens: 4000
          },
          {
            headers: { 'Content-Type': 'application/json' }
          }
        );

        const csvContent = csvResponse.data.choices[0].message.content;
        console.log('CSV extracted:', csvContent);

        // Step 2: Convert to JSON
        response = await axios.post(
          `${LM_STUDIO_URL}/chat/completions`,
          {
            model: LM_STUDIO_MODEL,
            messages: [
              {
                role: 'user',
                content: `Convert this CSV to JSON:\n\n${csvContent}\n\nOutput only the JSON array.`
              }
            ],
            temperature: 0,
            max_tokens: 4000
          },
          {
            headers: { 'Content-Type': 'application/json' }
          }
        );

      } else {
        // Z.AI - single step
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

        // Clean up common issues
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');

        // Extract JSON array
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          transactions = JSON.parse(jsonMatch[0]);
        } else {
          transactions = JSON.parse(content);
        }

        console.log(`Parsed ${transactions.length} transactions`);
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        return NextResponse.json({
          error: 'Could not parse AI response',
          transactions: []
        });
      }

      // Clean the transactions
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
          { error: `Cannot connect to LM Studio at ${LM_STUDIO_URL}. Please ensure LM Studio is running.` },
          { status: 503 }
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