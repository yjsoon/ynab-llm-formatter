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
          <h1 className="text-3xl font-bold tracking-tight mb-2">Model Testing Arena</h1>
          <p className="text-muted-foreground">
            Compare AI models side by side
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - File Upload & Model Selection */}
          <div className="lg:col-span-1 space-y-6">
            {/* File Upload */}
            <Card>
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
                    className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
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
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">
                2. Select Models ({selectedModels.length} selected)
              </h2>

              {/* Quick Select */}
              <div className="mb-4 flex flex-wrap gap-2">
                <button
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
                  className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-full hover:bg-green-200"
                >
                  All Free
                </button>
                <button
                  onClick={() => handleSelectCategory('openai')}
                  className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200"
                >
                  All OpenAI
                </button>
                <button
                  onClick={() => handleSelectCategory('google')}
                  className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-full hover:bg-red-200"
                >
                  All Google
                </button>
                <button
                  onClick={() => handleSelectCategory('meta')}
                  className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200"
                >
                  All Meta
                </button>
                <button
                  onClick={() => setSelectedModels(AVAILABLE_MODELS.map(m => m.id))}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedModels([])}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200"
                >
                  Clear All
                </button>
              </div>

              {/* Model List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {AVAILABLE_MODELS.map(model => (
                  <label key={model.id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedModels.includes(model.id)}
                      onChange={() => handleModelToggle(model.id)}
                      className="mr-3"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{model.name}</div>
                      <div className="text-xs text-gray-500">{model.id}</div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      model.id.endsWith(':free') ? 'bg-green-100 text-green-700' :
                      model.category === 'openai' ? 'bg-blue-100 text-blue-700' :
                      model.category === 'google' ? 'bg-red-100 text-red-700' :
                      model.category === 'meta' ? 'bg-purple-100 text-purple-700' :
                      model.category === 'anthropic' ? 'bg-orange-100 text-orange-700' :
                      model.category === 'mistral' ? 'bg-indigo-100 text-indigo-700' :
                      model.category === 'qwen' ? 'bg-teal-100 text-teal-700' :
                      model.category === 'xai' ? 'bg-yellow-100 text-yellow-700' :
                      model.category === 'zhipuai' ? 'bg-pink-100 text-pink-700' :
                      model.category === 'moonshot' ? 'bg-cyan-100 text-cyan-700' :
                      model.category === 'deepseek' ? 'bg-emerald-100 text-emerald-700' :
                      model.category === 'bytedance' ? 'bg-rose-100 text-rose-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {model.id.endsWith(':free') ? 'FREE' : model.category}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Run Test Button */}
            <button
              onClick={runTest}
              disabled={!selectedFile || selectedModels.length === 0 || isLoading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            </button>
          </div>

          {/* Right Panel - Results */}
          <div className="lg:col-span-2">
            {/* Live Status During Processing */}
            {isLoading && modelStatuses.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Processing Models...</h2>
                <div className="space-y-3">
                  {modelStatuses.map(status => (
                    <div key={status.model} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
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
                          <div className="text-xs text-gray-500">{status.model}</div>
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
              </div>
            )}

            {summary && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Test Summary</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Models Tested</p>
                    <p className="text-2xl font-bold">{summary.totalModels}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Successful</p>
                    <p className="text-2xl font-bold text-green-600">{summary.successfulModels}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Consensus</p>
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
                        <p className="text-sm text-gray-500">Fastest</p>
                        <p className="text-sm font-medium truncate">{summary.fastestModel?.split('/').pop()}</p>
                        <p className="text-xs text-gray-600">{formatTime(summary.fastestTime)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Slowest</p>
                        <p className="text-sm font-medium truncate">{summary.slowestModel?.split('/').pop()}</p>
                        <p className="text-xs text-gray-600">{formatTime(summary.slowestTime)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Speed Range</p>
                        <p className="text-sm font-medium">
                          {((summary.slowestTime / summary.fastestTime).toFixed(1))}x difference
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {results.length > 0 && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-6 flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Model Results</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSortBy('time')}
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        sortBy === 'time'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Sort by Time
                    </button>
                    <button
                      onClick={() => setSortBy('cost')}
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        sortBy === 'cost'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Sort by Cost
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-t border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Txns</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Outflow</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Inflow</th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
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
                          <tr key={result.model} className={isWinner ? 'bg-green-50' : result.error ? 'bg-red-50' : ''}>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {isWinner && <span className="text-2xl">🏆</span>}
                              {!isWinner && <span className="text-sm font-medium text-gray-600">{rank}</span>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {AVAILABLE_MODELS.find(m => m.id === result.model)?.name || result.model}
                                </div>
                                <div className="text-xs text-gray-500">{result.model}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`text-sm font-medium ${isWinner ? 'text-green-600' : 'text-gray-900'}`}>
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
                                  <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">Failed</span>
                                  <div className="text-xs text-red-600 mt-1 max-w-xs truncate" title={result.error}>
                                    {result.error}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center">
                                  <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">Success</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!results.length && !isLoading && (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <svg className="w-24 h-24 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No test results yet</h3>
                <p className="text-gray-500">Select an image and models to begin testing</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}