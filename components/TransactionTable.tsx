'use client';

import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Transaction } from '@/types/transaction';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TransactionTableProps {
  transactions: Transaction[];
  onTransactionsChange?: (transactions: Transaction[]) => void;
}

export default function TransactionTable({ transactions, onTransactionsChange }: TransactionTableProps) {
  const [editedTransactions, setEditedTransactions] = useState(transactions);

  // Sync with parent when transactions prop changes
  useEffect(() => {
    setEditedTransactions(transactions);
  }, [transactions]);

  const handleEdit = (index: number, field: keyof Transaction, value: string) => {
    const updated = [...editedTransactions];
    updated[index] = { ...updated[index], [field]: value };
    setEditedTransactions(updated);
    if (onTransactionsChange) {
      onTransactionsChange(updated);
    }
  };

  const handleDeleteRow = (index: number) => {
    const updated = editedTransactions.filter((_, i) => i !== index);
    setEditedTransactions(updated);
    if (onTransactionsChange) {
      onTransactionsChange(updated);
    }
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
    <Card className="bg-gradient-to-br from-card via-card to-success/5 border-success/20">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Extracted Transactions</CardTitle>
            <CardDescription>
              Review and edit transactions before downloading
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm px-3 py-1.5 bg-secondary/15 text-secondary rounded-md font-semibold">
              {editedTransactions.length} {editedTransactions.length === 1 ? 'transaction' : 'transactions'}
            </div>
            <Button
              onClick={handleDownloadCSV}
              className="bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 cursor-pointer"
            >
              <Download className="mr-2 h-4 w-4" />
              Download CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-y">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{minWidth: '110px'}}>
                  Date
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{minWidth: '250px'}}>
                  Payee
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{minWidth: '200px'}}>
                  Memo
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{minWidth: '100px'}}>
                  Outflow
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{minWidth: '100px'}}>
                  Inflow
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" style={{width: '50px'}}>

                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {editedTransactions.map((transaction, index) => (
                <tr key={index} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={transaction.date}
                      onChange={(e) => handleEdit(index, 'date', e.target.value)}
                      className="w-full px-2 py-1 text-sm bg-transparent border border-transparent hover:border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary rounded"
                      style={{minWidth: '100px'}}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={transaction.payee}
                      onChange={(e) => handleEdit(index, 'payee', e.target.value)}
                      className="w-full px-2 py-1 text-sm bg-transparent border border-transparent hover:border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary rounded"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={transaction.memo}
                      onChange={(e) => handleEdit(index, 'memo', e.target.value)}
                      className="w-full px-2 py-1 text-sm bg-transparent border border-transparent hover:border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary rounded"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={transaction.outflow}
                      onChange={(e) => handleEdit(index, 'outflow', e.target.value)}
                      className="w-full px-2 py-1 text-sm font-mono text-right bg-transparent border border-transparent hover:border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary rounded text-destructive"
                      style={{minWidth: '90px'}}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={transaction.inflow}
                      onChange={(e) => handleEdit(index, 'inflow', e.target.value)}
                      className="w-full px-2 py-1 text-sm font-mono text-right bg-transparent border border-transparent hover:border-border focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary rounded text-success"
                      style={{minWidth: '90px'}}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      onClick={() => handleDeleteRow(index)}
                      title="Delete row"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editedTransactions.length === 0 && (
          <div className="px-6 py-12 text-center text-muted-foreground">
            No transactions to display
          </div>
        )}
      </CardContent>

      {editedTransactions.length > 0 && (
        <div className="p-4 border-t">
          <Alert>
            <AlertDescription className="text-sm">
              <strong>Tip:</strong> Click on any cell to edit. Use the delete button on hover to remove unwanted rows. All changes will be included in the downloaded CSV.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </Card>
  );
}