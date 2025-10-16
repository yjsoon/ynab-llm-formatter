'use client';

import { useState, useEffect } from 'react';
import FileUploader from '@/components/FileUploader';
import TransactionTable from '@/components/TransactionTable';
import Navbar from '@/components/Navbar';
import { Transaction } from '@/types/transaction';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Info, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

type Provider = 'googleaistudio' | 'openrouter' | 'z.ai' | 'lm-studio';

interface ModelOption {
  id: string;
  name: string;
  provider: Provider;
  displayName: string;
}


export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [currentProvider, setCurrentProvider] = useState<Provider>('googleaistudio');
  const [customPrompt, setCustomPrompt] = useState<string>('');

  useEffect(() => {
    // Set up all available models across all providers
    const models: ModelOption[] = [
      // Google AI Studio Models
      {
        id: 'gemini-2.5-flash-lite',
        name: 'gemini-2.5-flash-lite',
        provider: 'googleaistudio',
        displayName: '2.5-flash-lite (GAI)'
      },
      {
        id: 'gemini-2.5-flash',
        name: 'gemini-2.5-flash',
        provider: 'googleaistudio',
        displayName: '2.5-flash (GAI)'
      },
      {
        id: 'gemini-2.5-pro',
        name: 'gemini-2.5-pro',
        provider: 'googleaistudio',
        displayName: '2.5-pro (GAI)'
      },
      
      // OpenRouter Models
      {
        id: 'google/gemini-2.5-flash-lite',
        name: 'google/gemini-2.5-flash-lite',
        provider: 'openrouter',
        displayName: 'Gemini 2.5 Flash Lite (OpenRouter)'
      },
      {
        id: 'google/gemini-flash-1.5-8b',
        name: 'google/gemini-flash-1.5-8b',
        provider: 'openrouter',
        displayName: 'Gemini Flash 1.5 8B (OpenRouter)'
      },
      {
        id: 'google/gemini-flash-1.5',
        name: 'google/gemini-flash-1.5',
        provider: 'openrouter',
        displayName: 'Gemini Flash 1.5 (OpenRouter)'
      },
      {
        id: 'anthropic/claude-3.5-haiku',
        name: 'anthropic/claude-3.5-haiku',
        provider: 'openrouter',
        displayName: 'Claude 3.5 Haiku (OpenRouter)'
      },
      {
        id: 'openai/gpt-4o-mini',
        name: 'openai/gpt-4o-mini',
        provider: 'openrouter',
        displayName: 'GPT-4o Mini (OpenRouter)'
      },
      {
        id: 'meta-llama/llama-4-scout:free',
        name: 'meta-llama/llama-4-scout:free',
        provider: 'openrouter',
        displayName: 'Llama 4 Scout (OpenRouter - FREE)'
      },
      
      // Z.AI Models
      {
        id: 'glm-4.5v',
        name: 'glm-4.5v',
        provider: 'z.ai',
        displayName: 'GLM-4.5V (Z.AI)'
      },
      
      // LM Studio Models
      {
        id: 'qwen2.5-vl-7b-instruct',
        name: 'qwen2.5-vl-7b-instruct',
        provider: 'lm-studio',
        displayName: 'Local Model (LM Studio)'
      }
    ];

    setAvailableModels(models);
    
    // Set default to Google AI Studio's 2.5-flash-lite as it's the preferred default
    setSelectedModel('gemini-2.5-flash-lite');
  }, []);

  const getCurrentModelDisplay = () => {
    const model = availableModels.find(m => m.id === selectedModel);
    return model ? model.displayName : 'No model selected';
  };

  const getProviderBadgeColor = (provider: Provider) => {
    switch (provider) {
      case 'googleaistudio': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'openrouter': return 'bg-green-100 text-green-800 border-green-200';
      case 'z.ai': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'lm-studio': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleFileProcess = async (files: File[], customInstructions: string) => {
    setIsLoading(true);
    setError(null);
    setWarning(null);
    setTransactions([]);
    setCustomPrompt(customInstructions);

    const allTransactions: Transaction[] = [];
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProcessingProgress(`Processing ${i + 1} of ${files.length}: ${file.name}`);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', selectedModel);
      if (customInstructions) {
        formData.append('customPrompt', customInstructions);
      }

      try {
        const formData = new FormData();
        formData.append('file', file);
        if (selectedModel) {
          formData.append('model', selectedModel);
        }
        if (customInstructions) {
          formData.append('customPrompt', customInstructions);
        }

        const response = await fetch('/api/process-statement', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
          errors.push(`${file.name}: ${data.error || 'Failed to process statement'}`);
        } else if (data.transactions && data.transactions.length > 0) {
          allTransactions.push(...data.transactions);
        }
      } catch (err) {
        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'An error occurred'}`);
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
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Model:</span>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-80">
                  <SelectValue placeholder="Select model..." />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center gap-2">
                        <span>{model.displayName}</span>
                        <Badge variant="outline" className={`text-xs ${getProviderBadgeColor(model.provider)}`}>
                          {model.provider === 'googleaistudio' ? 'GAI' :
                           model.provider === 'openrouter' ? 'OpenRouter' :
                           model.provider === 'z.ai' ? 'Z.AI' : 'Local'}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
              </div>
            </CardHeader>
            <CardContent>
              <FileUploader
                onFileProcess={handleFileProcess}
                isLoading={isLoading}
                customPrompt={customPrompt}
                setCustomPrompt={setCustomPrompt}
              />
            </CardContent>
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
            <TransactionTable
              transactions={transactions}
              onTransactionsChange={setTransactions}
            />
          )}
        </div>
      </main>
    </div>
  );
}