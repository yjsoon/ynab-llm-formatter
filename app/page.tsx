'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import FileUploader from '@/components/FileUploader';
import TransactionTable from '@/components/TransactionTable';
import { Transaction } from '@/types/transaction';

// Top performing models from testing
const OPENROUTER_MODELS = [
  { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', speed: '3.95s', free: true },
  { id: 'mistralai/pixtral-12b', name: 'Pixtral 12B', speed: '5.64s', free: true },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', speed: '6.80s', free: true },
  { id: 'bytedance/ui-tars-1.5-7b', name: 'UI-TARS 1.5 7B', speed: '12.26s', free: true },
  { id: 'meta-llama/llama-4-scout:free', name: 'Llama 4 Scout', speed: '12.52s', free: true },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', speed: '15.38s', free: true },
  { id: 'qwen/qwen-2.5-vl-7b-instruct', name: 'Qwen 2.5 VL 7B', speed: '15.57s', free: true },
  { id: 'meta-llama/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision', speed: '18.69s', free: true },
  { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B', speed: '19.45s', free: true },
  { id: 'qwen/qwen2.5-vl-32b-instruct:free', name: 'Qwen 2.5 VL 32B', speed: '20.13s', free: true },
];

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('google/gemini-2.5-flash-lite');

  // Load saved model preference from localStorage
  useEffect(() => {
    const savedModel = localStorage.getItem('selectedOpenRouterModel');
    if (savedModel && OPENROUTER_MODELS.some(m => m.id === savedModel)) {
      setSelectedModel(savedModel);
    }
  }, []);

  // Save model preference to localStorage
  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem('selectedOpenRouterModel', model);
  };

  const handleFileProcess = async (files: File[]) => {
    setIsLoading(true);
    setError(null);
    setWarning(null);
    setTransactions([]);

    const allTransactions: Transaction[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProcessingProgress(`Processing ${i + 1} of ${files.length}: ${file.name}`);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', selectedModel);

      try {
        const response = await fetch('/api/process-statement', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          errors.push(`${file.name}: ${data.error || 'Failed to process'}`);
        } else if (data.transactions && data.transactions.length > 0) {
          allTransactions.push(...data.transactions);
        }
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Something went wrong'}`);
      }
    }

    // Sort all transactions by date in reverse order (newest first)
    const sortedTransactions = allTransactions.sort((a, b) => {
      const dateA = new Date(a.date || '');
      const dateB = new Date(b.date || '');
      return dateB.getTime() - dateA.getTime();
    });

    setTransactions(sortedTransactions);
    if (errors.length > 0) {
      setError(errors.join('\n'));
    }
    setProcessingProgress('');
    setIsLoading(false);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Settings/Test Link */}
      <div className="absolute top-4 right-4">
        <Link
          href="/test"
          className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow hover:shadow-md transition-shadow text-gray-700 hover:text-gray-900"
          title="Model Testing Arena"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-medium">Test Models</span>
        </Link>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-slate-800 mb-2 text-center">
            Credit Card Statement Converter
          </h1>
          <p className="text-slate-600 text-center mb-8">
            Upload multiple statements and convert them to YNAB-compatible CSV format
          </p>

          {/* Model Selection Dropdown */}
          <div className="mb-6 bg-white rounded-xl shadow-md p-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI Model Selection
            </label>
            <select
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {OPENROUTER_MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} - {model.speed} {model.free && '(FREE)'}
                </option>
              ))}
            </select>
            <p className="mt-2 text-sm text-gray-500">
              All models are currently FREE. Faster models provide quicker results.
            </p>
          </div>

          <FileUploader onFileProcess={handleFileProcess} isLoading={isLoading} />

          {processingProgress && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-700 font-medium">{processingProgress}</p>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 whitespace-pre-line">{error}</p>
            </div>
          )}

          {warning && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-700">{warning}</p>
            </div>
          )}

          {transactions.length > 0 && (
            <TransactionTable transactions={transactions} />
          )}
        </div>
      </div>
    </main>
  );
}