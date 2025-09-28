'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Image as ImageIcon, BarChart3, Loader2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Available models for testing
const AVAILABLE_MODELS = [
  // Anthropic
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', category: 'anthropic' },

  // Google
  { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', category: 'google' },

  // Meta
  { id: 'meta-llama/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision', category: 'meta' },
  { id: 'meta-llama/llama-4-scout:free', name: 'Llama 4 Scout (FREE)', category: 'meta' },

  // Mistral
  { id: 'mistralai/pixtral-12b', name: 'Pixtral 12B', category: 'mistral' },
  { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1 24B (FREE)', category: 'mistral' },

  // OpenAI
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', category: 'openai' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', category: 'openai' },

  // Google (additional)
  { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B (FREE)', category: 'google' },

  // Moonshot
  { id: 'moonshotai/kimi-vl-a3b-thinking:free', name: 'Kimi VL A3B Thinking (FREE)', category: 'moonshot' },

  // ByteDance
  { id: 'bytedance/ui-tars-1.5-7b', name: 'UI-TARS 1.5 7B', category: 'bytedance' },

  // MiniMax
  { id: 'minimax/minimax-01', name: 'MiniMax-01', category: 'minimax' },

  // Qwen/Alibaba
  { id: 'qwen/qwen-2.5-vl-7b-instruct', name: 'Qwen 2.5 VL 7B', category: 'qwen' },
  { id: 'qwen/qwen2.5-vl-32b-instruct:free', name: 'Qwen 2.5 VL 32B (FREE)', category: 'qwen' },
  { id: 'qwen/qwen2.5-vl-72b-instruct:free', name: 'Qwen 2.5 VL 72B (FREE)', category: 'qwen' },

  // xAI
  { id: 'x-ai/grok-4-fast:free', name: 'Grok 4 Fast (FREE)', category: 'xai' },

  // z.ai
  { id: 'z-ai/glm-4.5v', name: 'GLM-4.5V', category: 'zai' }
];

interface TransactionItem {
  date?: string;
  payee?: string;
  memo?: string;
  outflow?: string;
  inflow?: string;
}

interface ModelResult {
  model: string;
  transactions: TransactionItem[];
  processingTime: number;
  error?: string;
  transactionCount: number;
  totalOutflow: number;
  totalInflow: number;
  cost?: number;
  tokens?: {
    prompt: number;
    completion: number;
  };
}

interface TestSummary {
  totalModels: number;
  successfulModels: number;
  fastestModel: string;
  fastestTime: number;
  slowestModel: string;
  slowestTime: number;
  hasConsensus: boolean;
  consensusCount: number | null;
}

interface ModelStatus {
  model: string;
  status: 'waiting' | 'processing' | 'completed' | 'failed';
  startTime?: number;
  error?: string;
}

export default function TestPage() {
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ModelResult[]>([]);
  const [summary, setSummary] = useState<TestSummary | null>(null);
  const [modelStatuses, setModelStatuses] = useState<ModelStatus[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [sortBy, setSortBy] = useState<'time' | 'cost'>('time');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isLoading && modelStatuses.length > 0) {
      timerRef.current = setInterval(() => {
        setCurrentTime(prev => prev + 0.1);
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isLoading, modelStatuses]);

  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleModelToggle = (modelId: string) => {
    setSelectedModels(prev => {
      if (prev.includes(modelId)) {
        return prev.filter(id => id !== modelId);
      }
      return [...prev, modelId];
    });
  };

  const handleSelectCategory = (category: string) => {
    const categoryModels = AVAILABLE_MODELS
      .filter(m => m.category === category)
      .map(m => m.id);
    setSelectedModels(prev => {
      const hasAll = categoryModels.every(id => prev.includes(id));
      if (hasAll) {
        return prev.filter(id => !categoryModels.includes(id));
      }
      return [...new Set([...prev, ...categoryModels])];
    });
  };

  const runTest = async () => {
    if (!selectedFile || selectedModels.length === 0) return;

    setIsLoading(true);
    setResults([]);
    setSummary(null);
    setCurrentTime(0);

    // Initialize model statuses
    const initialStatuses: ModelStatus[] = selectedModels.map(model => ({
      model,
      status: 'processing',
      startTime: Date.now()
    }));
    setModelStatuses(initialStatuses);

    try {
      // Convert file to base64 once
      const bytes = await selectedFile.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = buffer.toString('base64');
      const mimeType = selectedFile.type || 'image/jpeg';
      const imageData = `data:${mimeType};base64,${base64}`;

      const cloneResult = (result: ModelResult): ModelResult => ({
        ...result,
        tokens: result.tokens ? { ...result.tokens } : undefined
      });

      const response = await axios.post('/api/test-models', {
        models: selectedModels,
        imageData
      });

      const resultsMap = new Map<string, ModelResult>();
      (response.data?.results as ModelResult[] | undefined)?.forEach(result => {
        resultsMap.set(result.model, cloneResult(result));
      });

      selectedModels.forEach(model => {
        if (!resultsMap.has(model)) {
          resultsMap.set(model, {
            model,
            transactions: [],
            processingTime: 0,
            error: 'No response received from server',
            transactionCount: 0,
            totalOutflow: 0,
            totalInflow: 0
          });
        }
      });

      const allResults = Array.from(resultsMap.values());
      const successfulResults = allResults.filter(r => !r.error && r.transactionCount > 0);

      // Find consensus
      let consensusCount = 0;

      if (successfulResults.length >= 2) {
        // Find most common transaction count
        const countFrequency: { [key: number]: number } = {};
        successfulResults.forEach(r => {
          countFrequency[r.transactionCount] = (countFrequency[r.transactionCount] || 0) + 1;
        });

        const mostCommonCount = Object.entries(countFrequency)
          .sort((a, b) => b[1] - a[1])[0];

        if (mostCommonCount && mostCommonCount[1] >= Math.ceil(successfulResults.length / 2)) {
          consensusCount = parseInt(mostCommonCount[0]);

        }
      }

      // Mark models as outliers if they deviate too much from consensus
      const finalResults = allResults.map(cloneResult);
      finalResults.forEach(result => {
        if (consensusCount > 0 && !result.error) {
          const countDiff = Math.abs(result.transactionCount - consensusCount);

          // Only check for outliers based on transaction count difference
          // Do not mark as outlier if the count is correct, even if amounts differ slightly
          if (countDiff > 2) {
            result.error = `Outlier: ${result.transactionCount} txns (consensus: ${consensusCount})`;
          }
        }
      });

      // Sort by processing time (only successful models)
      const sortedResults = [...finalResults].sort((a, b) => {
        if (a.error && !b.error) return 1;
        if (!a.error && b.error) return -1;
        return a.processingTime - b.processingTime;
      });

      setModelStatuses(prev => prev.map(status => {
        const match = sortedResults.find(r => r.model === status.model);
        if (!match) {
          return { ...status, status: 'failed' as const, error: 'No result returned' };
        }
        if (match.error) {
          return { ...status, status: 'failed' as const, error: match.error };
        }
        return { ...status, status: 'completed' as const };
      }));

      setResults(sortedResults);

      // Calculate summary (only for successful models)
      const successfulOnly = sortedResults.filter(r => !r.error);
      const summary: TestSummary = {
        totalModels: selectedModels.length,
        successfulModels: successfulOnly.length,
        fastestModel: successfulOnly[0]?.model || '',
        fastestTime: successfulOnly[0]?.processingTime || 0,
        slowestModel: successfulOnly[successfulOnly.length - 1]?.model || '',
        slowestTime: successfulOnly[successfulOnly.length - 1]?.processingTime || 0,
        hasConsensus: consensusCount > 0,
        consensusCount
      };

      setSummary(summary);
    } catch (error) {
      console.error('Test failed:', error);
      const err = error as Error & { response?: { data?: { error?: string } } };
      alert('Test failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsLoading(false);
      setModelStatuses([]);
    }
  };

  const formatTime = (ms: number) => {
    return (ms / 1000).toFixed(2) + 's';
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Model Lab</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - File Upload & Model Selection */}
          <div className="lg:col-span-1 space-y-6">
            {/* File Upload */}
            <Card className="bg-gradient-to-br from-card via-card to-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle>1. Select Test Image</CardTitle>
              </CardHeader>
              <CardContent>
                <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />

              {!imagePreview ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 hover:border-primary/50 transition-colors"
                >
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Click to select image</p>
                </button>
              ) : (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Preview" className="w-full rounded-lg" />
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setImagePreview(null);
                      setResults([]);
                      setSummary(null);
                    }}
                    className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-2 rounded-full hover:bg-destructive/90"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              </CardContent>
            </Card>

            {/* Model Selection */}
            <Card className="bg-gradient-to-br from-card via-card to-accent/5 border-accent/20">
              <CardHeader>
                <CardTitle>
                  2. Select Models ({selectedModels.length} selected)
                </CardTitle>
              </CardHeader>
              <CardContent>

              {/* Quick Select */}
              <div className="mb-4 flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    const freeModels = AVAILABLE_MODELS.filter(m => m.id.endsWith(':free')).map(m => m.id);
                    setSelectedModels(prev => {
                      const hasAll = freeModels.every(id => prev.includes(id));
                      if (hasAll) {
                        return prev.filter(id => !freeModels.includes(id));
                      }
                      return [...new Set([...prev, ...freeModels])];
                    });
                  }}
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 text-xs"
                >
                  All Free
                </Button>
                <Button
                  onClick={() => handleSelectCategory('openai')}
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 text-xs"
                >
                  All OpenAI
                </Button>
                <Button
                  onClick={() => handleSelectCategory('google')}
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 text-xs"
                >
                  All Google
                </Button>
                <Button
                  onClick={() => handleSelectCategory('meta')}
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 text-xs"
                >
                  All Meta
                </Button>
                <Button
                  onClick={() => setSelectedModels(AVAILABLE_MODELS.map(m => m.id))}
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 text-xs"
                >
                  Select All
                </Button>
                <Button
                  onClick={() => setSelectedModels([])}
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 text-xs"
                >
                  Clear All
                </Button>
              </div>

              {/* Model List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {AVAILABLE_MODELS.map(model => (
                  <label key={model.id} className="flex items-center p-2 hover:bg-muted rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(model.id)}
                      onChange={() => handleModelToggle(model.id)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{model.name}</div>
                      <div className="text-xs text-muted-foreground">{model.id}</div>
                    </div>
                      <Badge variant={model.id.endsWith(':free') ? 'secondary' : 'outline'} className="text-xs">
                        {model.id.endsWith(':free') ? 'FREE' : model.category}
                      </Badge>
                  </label>
                ))}
              </div>
              </CardContent>
            </Card>

            {/* Run Test Button */}
            <Button
              onClick={runTest}
              disabled={!selectedFile || selectedModels.length === 0 || isLoading}
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              size="lg"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Testing {selectedModels.length} models... {currentTime.toFixed(1)}s
                </span>
              ) : (
                `Run Test with ${selectedModels.length} Model${selectedModels.length !== 1 ? 's' : ''}`
              )}
            </Button>
          </div>

          {/* Right Panel - Results */}
          <div className="lg:col-span-2">
            {/* Live Status During Processing */}
            {isLoading && modelStatuses.length > 0 && (
              <Card className="mb-6 bg-gradient-to-br from-card via-card to-primary/10 border-primary/30">
                <CardHeader>
                  <CardTitle>Processing Models...</CardTitle>
                </CardHeader>
                <CardContent>
                <div className="space-y-3">
                  {modelStatuses.map(status => (
                    <div key={status.model} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full animate-pulse ${
                          status.status === 'processing' ? 'bg-blue-500' :
                          status.status === 'completed' ? 'bg-green-500' :
                          status.status === 'failed' ? 'bg-red-500' :
                          'bg-gray-400'
                        }`} />
                        <div>
                          <div className="text-sm font-medium">
                            {AVAILABLE_MODELS.find(m => m.id === status.model)?.name || status.model}
                          </div>
                          <div className="text-xs text-muted-foreground">{status.model}</div>
                        </div>
                      </div>
                      <div className="text-sm">
                        {status.status === 'processing' && (
                          <span className="text-blue-600">Processing...</span>
                        )}
                        {status.status === 'completed' && (
                          <span className="text-green-600">✓ Complete</span>
                        )}
                        {status.status === 'failed' && (
                          <span className="text-red-600">✗ Failed</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                </CardContent>
              </Card>
            )}

            {summary && (
              <Card className="mb-6 bg-gradient-to-br from-card via-card to-accent/10 border-accent/30">
                <CardHeader>
                  <CardTitle>Test Summary</CardTitle>
                </CardHeader>
                <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Models Tested</p>
                    <p className="text-2xl font-bold">{summary.totalModels}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Successful</p>
                    <p className="text-2xl font-bold text-green-600">{summary.successfulModels}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Consensus</p>
                    <p className="text-2xl font-bold">
                      {summary.hasConsensus ? (
                        <span className="text-green-600">✓ {summary.consensusCount} txns</span>
                      ) : (
                        <span className="text-red-600">✗ Varies</span>
                      )}
                    </p>
                  </div>
                  {summary.successfulModels > 0 && (
                    <>
                      <div>
                        <p className="text-sm text-muted-foreground">Fastest</p>
                        <p className="text-sm font-medium truncate">{summary.fastestModel?.split('/').pop()}</p>
                        <p className="text-xs text-muted-foreground">{formatTime(summary.fastestTime)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Slowest</p>
                        <p className="text-sm font-medium truncate">{summary.slowestModel?.split('/').pop()}</p>
                        <p className="text-xs text-muted-foreground">{formatTime(summary.slowestTime)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Speed Range</p>
                        <p className="text-sm font-medium">
                          {((summary.slowestTime / summary.fastestTime).toFixed(1))}x difference
                        </p>
                      </div>
                    </>
                  )}
                </div>
                </CardContent>
              </Card>
            )}

            {results.length > 0 && (
              <Card className="overflow-hidden bg-gradient-to-br from-card via-card to-secondary/5 border-secondary/20">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Model Results</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setSortBy('time')}
                      variant={sortBy === 'time' ? 'default' : 'outline'}
                      size="sm"
                    >
                      Sort by Time
                    </Button>
                    <Button
                      onClick={() => setSortBy('cost')}
                      variant={sortBy === 'cost' ? 'default' : 'outline'}
                      size="sm"
                    >
                      Sort by Cost
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted border-t border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Rank</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Model</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Time</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Cost</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Txns</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Outflow</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Inflow</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {[...results].sort((a, b) => {
                        // Put errors last
                        if (a.error && !b.error) return 1;
                        if (!a.error && b.error) return -1;
                        if (a.error && b.error) return 0;

                        // Sort by selected criteria
                        if (sortBy === 'cost') {
                          const aCost = a.cost || 0;
                          const bCost = b.cost || 0;
                          return aCost - bCost;
                        } else {
                          return a.processingTime - b.processingTime;
                        }
                      }).map((result, idx, sortedResults) => {
                        const isWinner = idx === 0 && !result.error;
                        const rank = result.error ? '-' : (sortedResults.filter((r, i) => i < idx && !r.error).length + 1);

                        return (
                          <tr key={result.model} className={isWinner ? 'bg-green-500/10' : result.error ? 'bg-red-500/10' : ''}>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {isWinner && <span className="text-2xl">🏆</span>}
                              {!isWinner && <span className="text-sm font-medium text-gray-600">{rank}</span>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-foreground">
                                  {AVAILABLE_MODELS.find(m => m.id === result.model)?.name || result.model}
                                </div>
                                <div className="text-xs text-muted-foreground">{result.model}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`text-sm font-medium ${isWinner ? 'text-green-600' : 'text-foreground'}`}>
                                {result.error ? '-' : formatTime(result.processingTime)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className="text-sm">
                                {result.error ? '-' : result.cost ? `$${result.cost.toFixed(4)}` : 'FREE'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                              {result.error ? '-' : result.transactionCount}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                              {result.error ? '-' : `$${result.totalOutflow.toFixed(2)}`}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                              {result.error ? '-' : `$${result.totalInflow.toFixed(2)}`}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {result.error ? (
                                <div className="text-center">
                                  <Badge variant="destructive" className="text-xs">Failed</Badge>
                                  <div className="text-xs text-red-600 mt-1 max-w-xs truncate" title={result.error}>
                                    {result.error}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center">
                                  <Badge variant="default" className="text-xs bg-green-600">Success</Badge>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {!results.length && !isLoading && (
              <Card className="bg-gradient-to-br from-card via-card to-muted/20 border-muted/30">
                <CardContent className="py-12 text-center">
                <BarChart3 className="w-24 h-24 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No test results yet</h3>
                <p className="text-muted-foreground">Select an image and models to begin testing</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}