'use client';

import { useState } from 'react';
import FileUploader from '@/components/FileUploader';
import TransactionTable from '@/components/TransactionTable';
import { Transaction } from '@/types/transaction';

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const handleFileProcess = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setWarning(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/process-statement', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to process statement');
        setTransactions(data.transactions || []);
      } else {
        setTransactions(data.transactions || []);
        if (data.warning) {
          setWarning(data.warning);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-slate-800 mb-2 text-center">
            Credit Card Statement Converter
          </h1>
          <p className="text-slate-600 text-center mb-8">
            Upload your statement and convert it to YNAB-compatible CSV format
          </p>

          <FileUploader onFileProcess={handleFileProcess} isLoading={isLoading} />

          {error && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{error}</p>
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