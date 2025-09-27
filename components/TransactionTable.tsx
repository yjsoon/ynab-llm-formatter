'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { Transaction } from '@/types/transaction';

interface TransactionTableProps {
  transactions: Transaction[];
}

export default function TransactionTable({ transactions }: TransactionTableProps) {
  const [editedTransactions, setEditedTransactions] = useState(transactions);

  const handleEdit = (index: number, field: keyof Transaction, value: string) => {
    const updated = [...editedTransactions];
    updated[index] = { ...updated[index], [field]: value };
    setEditedTransactions(updated);
  };

  const handleDownloadCSV = () => {
    // Use Papa.unparse with custom headers for proper CSV generation
    const csv = Papa.unparse({
      fields: ['Date', 'Payee', 'Memo', 'Outflow', 'Inflow'],
      data: editedTransactions.map(t => ({
        'Date': t.date || '',
        'Payee': t.payee || '',
        'Memo': t.memo || '',
        'Outflow': t.outflow || '',
        'Inflow': t.inflow || ''
      }))
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `statement_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the object URL
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-8">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-800">
            Extracted Transactions ({editedTransactions.length})
          </h2>
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap" style={{minWidth: '110px'}}>
                  Date
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider" style={{minWidth: '300px'}}>
                  Payee
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider" style={{minWidth: '250px'}}>
                  Memo
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap" style={{minWidth: '120px'}}>
                  Outflow
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider whitespace-nowrap" style={{minWidth: '120px'}}>
                  Inflow
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {editedTransactions.map((transaction, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="text"
                      value={transaction.date}
                      onChange={(e) => handleEdit(index, 'date', e.target.value)}
                      className="w-full px-2 py-1 text-sm text-slate-800 border border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                      style={{minWidth: '100px'}}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={transaction.payee}
                      onChange={(e) => handleEdit(index, 'payee', e.target.value)}
                      className="w-full px-2 py-1 text-sm text-slate-800 border border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={transaction.memo}
                      onChange={(e) => handleEdit(index, 'memo', e.target.value)}
                      className="w-full px-2 py-1 text-sm text-slate-800 border border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                    />
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <input
                      type="text"
                      value={transaction.outflow}
                      onChange={(e) => handleEdit(index, 'outflow', e.target.value)}
                      className="w-full px-2 py-1 text-sm font-mono text-right border border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded text-red-600"
                      style={{minWidth: '100px'}}
                    />
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <input
                      type="text"
                      value={transaction.inflow}
                      onChange={(e) => handleEdit(index, 'inflow', e.target.value)}
                      className="w-full px-2 py-1 text-sm font-mono text-right border border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded text-green-600"
                      style={{minWidth: '100px'}}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editedTransactions.length === 0 && (
          <div className="px-6 py-12 text-center text-slate-500">
            No transactions to display
          </div>
        )}
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-700">
          <strong>Tip:</strong> You can edit any cell by clicking on it. All changes will be included in the downloaded CSV.
        </p>
      </div>
    </div>
  );
}