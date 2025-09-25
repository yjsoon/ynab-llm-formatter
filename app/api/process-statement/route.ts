import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const Z_AI_API_KEY = process.env.Z_AI_API_KEY;

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

    if (!Z_AI_API_KEY) {
      console.error('Z_AI_API_KEY not configured');
      return NextResponse.json(
        { error: 'API key not configured' },
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

      messages = [
        {
          role: 'system',
          content: `You are a financial data extraction assistant. Extract credit card transaction data from statements and return it in a specific JSON format.`
        },
        {
          role: 'user',
          content: `Please extract all credit card transactions from this statement text and convert them to the following format:

Required fields:
- date: Transaction date in YYYY-MM-DD format
- payee: The merchant or payee name
- memo: Any additional transaction details (foreign currency, reference numbers, etc.)
- outflow: Amount for charges/debits (positive number with $ sign, e.g., "$123.45")
- inflow: Amount for credits/refunds/payments (positive number with $ sign, e.g., "$50.00")

Important rules:
- Each transaction should have EITHER outflow OR inflow, not both
- All amounts should be positive numbers with $ signs
- Dates must be in YYYY-MM-DD format
- Include foreign currency amounts in the memo field if present
- Extract ALL transactions you can find in the text

Statement text:
${extractedText}

Return ONLY a valid JSON array of transactions with these exact field names. No additional text or explanation.`
        }
      ];
    } else {
      // Handle images (PNG, JPG, etc.)
      const base64 = buffer.toString('base64');
      const mimeType = file.type || 'image/jpeg';
      const dataUri = `data:${mimeType};base64,${base64}`;

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
              text: `Please extract all credit card transactions from this statement image and convert them to the following CSV format:

Required fields:
- date: Transaction date in YYYY-MM-DD format
- payee: The merchant or payee name
- memo: Any additional transaction details (foreign currency, reference numbers, etc.)
- outflow: Amount for charges/debits (positive number with $ sign, e.g., "$123.45")
- inflow: Amount for credits/refunds/payments (positive number with $ sign, e.g., "$50.00")

Important rules:
- Each transaction should have EITHER outflow OR inflow, not both
- All amounts should be positive numbers with $ signs
- Dates must be in YYYY-MM-DD format
- Include foreign currency amounts in the memo field if present

Return ONLY a valid JSON array of transactions with these exact field names. No additional text or explanation.`
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
      console.log(`Calling z.ai API with model: ${model}`);

      const response = await axios.post(
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

      // Parse the response
      let transactions = [];
      try {
        const content = response.data.choices[0].message.content;
        console.log('AI Response:', content);

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
      console.error('z.ai API error:', error.response?.data || error.message);

      if (error.response?.status === 401) {
        return NextResponse.json(
          { error: 'Invalid API key. Please check your z.ai API key.' },
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
        { error: `API error: ${error.response?.data?.error?.message || error.message}` },
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