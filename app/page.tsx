'use client';

import { useState, useEffect } from 'react';
import FileUploader from '@/components/FileUploader';
import TransactionTable from '@/components/TransactionTable';
import Navbar from '@/components/Navbar';
import { Transaction } from '@/types/transaction';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, AlertCircle, Info, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

// Top performing models from testing
const OPENROUTER_MODELS = [
  { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', speed: '3.95s', free: false },
  { id: 'mistralai/pixtral-12b', name: 'Pixtral 12B', speed: '5.64s', free: false },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', speed: '6.80s', free: false },
  { id: 'bytedance/ui-tars-1.5-7b', name: 'UI-TARS 1.5 7B', speed: '12.26s', free: false },
  { id: 'meta-llama/llama-4-scout:free', name: 'Llama 4 Scout', speed: '12.52s', free: true },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', speed: '15.38s', free: false },
  { id: 'qwen/qwen-2.5-vl-7b-instruct', name: 'Qwen 2.5 VL 7B', speed: '15.57s', free: false },
  { id: 'meta-llama/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision', speed: '18.69s', free: false },
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
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [showCustomInstructions, setShowCustomInstructions] = useState(false);

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
      if (customPrompt) {
        formData.append('customPrompt', customPrompt);
      }

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

    // Sort all transactions by date in reverse order (newest first). Unknown dates go last.
    const sortedTransactions = allTransactions.sort((a, b) => {
      const parse = (value?: string) => {
        if (!value) return null;
        const timestamp = Date.parse(value);
        return Number.isNaN(timestamp) ? null : timestamp;
      };
      const timeA = parse(a.date);
      const timeB = parse(b.date);
      if (timeA === null && timeB === null) return 0;
      if (timeA === null) return 1;
      if (timeB === null) return -1;
      return timeB - timeA;
    });

    setTransactions(sortedTransactions);
    if (errors.length > 0) {
      setError(errors.join('\n'));
    }
    setProcessingProgress('');
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Transaction Converter
            </h1>
            <p className="text-muted-foreground">
              Upload statements and convert them to YNAB-compatible CSV format
            </p>
          </div>

          {/* Model Selector and File Upload */}
          <Card className="bg-gradient-to-br from-card via-card to-accent/5 border-accent/20">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Upload Statements</CardTitle>
                  <CardDescription>Select AI model and upload your credit card statements</CardDescription>
                </div>
                <Select value={selectedModel} onValueChange={handleModelChange}>
                  <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue placeholder="Select AI Model" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPENROUTER_MODELS.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center gap-2">
                          <span>{model.name}</span>
                          {model.free && <Badge variant="secondary" className="text-xs">FREE</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <FileUploader
                onFileProcess={handleFileProcess}
                isLoading={isLoading}
                customPrompt={customPrompt}
              />
            </CardContent>
          </Card>

          {/* Custom Instructions Card */}
          <Card className="bg-gradient-to-br from-card via-card to-secondary/10 border-secondary/20">
            <CardHeader
              className="cursor-pointer select-none"
              onClick={() => setShowCustomInstructions(!showCustomInstructions)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Custom Instructions</CardTitle>
                  <CardDescription>
                    Add specific instructions to help the AI extract transactions accurately
                  </CardDescription>
                </div>
                <Button variant="ghost" size="icon">
                  {showCustomInstructions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </CardHeader>
            {showCustomInstructions && (
              <CardContent className="space-y-4">
                <Textarea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="E.g., This bank uses DD/MM format. Foreign transactions show original currency in brackets. Ignore fee reversals."
                  className="min-h-[100px] resize-none"
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card className="bg-gradient-to-br from-primary/10 via-card to-card border-primary/30">
                    <CardHeader className="p-4">
                      <CardTitle className="text-sm">Date Format</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-xs text-muted-foreground">
                        "Dates are in DD/MM/YYYY format"
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-accent/10 via-card to-card border-accent/30">
                    <CardHeader className="p-4">
                      <CardTitle className="text-sm">Filtering</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-xs text-muted-foreground">
                        "Ignore transactions marked as 'REVERSAL'"
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-secondary/20 via-card to-card border-secondary/30">
                    <CardHeader className="p-4">
                      <CardTitle className="text-sm">Currency</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-xs text-muted-foreground">
                        "Foreign amounts shown as (USD 50.00)"
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Progress Alert */}
          {processingProgress && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>{processingProgress}</AlertDescription>
            </Alert>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
            </Alert>
          )}

          {/* Warning Alert */}
          {warning && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>{warning}</AlertDescription>
            </Alert>
          )}

          {/* Transactions Table */}
          {transactions.length > 0 && (
            <TransactionTable transactions={transactions} />
          )}
        </div>
      </main>
    </div>
  );
}