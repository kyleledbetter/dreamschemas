'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2, CheckCircle, XCircle, AlertCircle, Zap, Database, RefreshCw } from 'lucide-react';
import type { CSVParseResult } from '../../types/csv.types';
import type { AISchemaAnalysis } from '../../lib/ai/schema-analyzer';

interface StreamEvent {
  type: 'metadata' | 'content' | 'complete' | 'error';
  data: {
    content?: string;
    message?: string;
    timestamp?: string;
    tablesCount?: number;
    aiProvider?: string;
    totalTokens?: number;
  };
}

interface AnalysisState {
  status: 'idle' | 'connecting' | 'streaming' | 'completed' | 'error';
  content: string;
  metadata?: {
    timestamp?: string;
    tablesAnalyzed?: number;
    confidence?: number;
    aiProvider?: string;
    processingTime?: number;
    totalTokens?: number;
  };
  error?: string;
  progress: number;
}

interface AIAnalysisStreamProps {
  csvResults: CSVParseResult[];
  onAnalysisComplete?: (analysis: AISchemaAnalysis) => void;
  onError?: (error: string) => void;
  targetUseCase?: string;
  autoStart?: boolean;
}

export function AIAnalysisStream({
  csvResults,
  onAnalysisComplete,
  onError,
  targetUseCase = 'General purpose application',
  autoStart = false,
}: AIAnalysisStreamProps) {
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    status: 'idle',
    content: '',
    progress: 0,
  });

  const [structuredAnalysis, setStructuredAnalysis] = useState<AISchemaAnalysis | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const resetAnalysis = useCallback(() => {
    setAnalysisState({
      status: 'idle',
      content: '',
      progress: 0,
    });
    setStructuredAnalysis(null);
    setRetryCount(0);
  }, []);

  const handleStreamEvent = useCallback(async (event: StreamEvent, progress: number) => {
    switch (event.type) {
      case 'metadata':
        setAnalysisState(prev => ({
          ...prev,
          metadata: event.data,
          progress: Math.max(prev.progress, 30),
        }));
        break;

      case 'content':
        setAnalysisState(prev => ({
          ...prev,
          content: prev.content + (event.data.content || ''),
          progress: Math.max(prev.progress, progress),
        }));
        break;

      case 'complete':
        setAnalysisState(prev => ({
          ...prev,
          status: 'completed',
          progress: 100,
          metadata: { ...prev.metadata, ...event.data },
        }));
        break;

      case 'error':
        setAnalysisState(prev => ({
          ...prev,
          status: 'error',
          error: event.data.message || 'Unknown error',
        }));
        onError?.(event.data.message || 'Unknown error');
        break;
    }
  }, [onError]);

  const startStreamingAnalysis = useCallback(async () => {
    if (analysisState.status === 'streaming') return;

    setAnalysisState(prev => ({
      ...prev,
      status: 'connecting',
      content: '',
      progress: 10,
    }));

    try {
      // First, try structured analysis
      const structuredResponse = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvResults,
          options: {
            streaming: false,
            includeOptimizations: true,
            targetUseCase,
          },
        }),
      });

      if (structuredResponse.ok) {
        const result = await structuredResponse.json();
        if (result.success && result.analysis) {
          setStructuredAnalysis(result.analysis);
          onAnalysisComplete?.(result.analysis);
          
          setAnalysisState(prev => ({
            ...prev,
            status: 'completed',
            progress: 100,
            metadata: result.metadata,
          }));
          return;
        }
      }

      // Fallback to streaming analysis
      setAnalysisState(prev => ({
        ...prev,
        status: 'streaming',
        progress: 20,
      }));

      const streamResponse = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          csvResults,
          options: {
            streaming: true,
            targetUseCase,
          },
        }),
      });

      if (!streamResponse.ok) {
        const errorData = await streamResponse.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${streamResponse.status}`);
      }

      const reader = streamResponse.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let currentProgress = 20;

      while (true) {
        const { value, done } = await reader.read();
        
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const eventData: StreamEvent = JSON.parse(line.slice(6));
              await handleStreamEvent(eventData, currentProgress);
              currentProgress = Math.min(currentProgress + 10, 90);
            } catch {
              console.warn('Failed to parse stream event:', line);
            }
          }
        }
      }

    } catch (error) {
      console.error('Analysis streaming failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      setAnalysisState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
      }));

      onError?.(errorMessage);
    }
  }, [csvResults, targetUseCase, analysisState.status, onAnalysisComplete, onError, handleStreamEvent]);

  const handleRetry = useCallback(() => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      startStreamingAnalysis();
    }
  }, [retryCount, maxRetries, startStreamingAnalysis]);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && analysisState.status === 'idle') {
      startStreamingAnalysis();
    }
  }, [autoStart, analysisState.status, startStreamingAnalysis]);

  const getStatusIcon = () => {
    switch (analysisState.status) {
      case 'connecting':
      case 'streaming':
        return <Loader2 className="h-4 w-4 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Database className="h-4 w-4" />;
    }
  };

  const getStatusText = () => {
    switch (analysisState.status) {
      case 'connecting':
        return 'Connecting to AI service...';
      case 'streaming':
        return 'Analyzing your data...';
      case 'completed':
        return 'Analysis completed';
      case 'error':
        return 'Analysis failed';
      default:
        return 'Ready to analyze';
    }
  };

  const getStatusColor = () => {
    switch (analysisState.status) {
      case 'connecting':
      case 'streaming':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-4">
      {/* Analysis Control Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon()}
              AI Schema Analysis
            </CardTitle>
            <div className="flex items-center gap-2">
              {analysisState.metadata?.aiProvider && (
                <Badge variant="outline" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  {analysisState.metadata.aiProvider}
                </Badge>
              )}
              {structuredAnalysis && (
                <Badge variant="outline" className="text-xs">
                  Confidence: {Math.round(structuredAnalysis.confidence * 100)}%
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status and Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{getStatusText()}</span>
              <span>{analysisState.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${getStatusColor()}`}
                style={{ width: `${analysisState.progress}%` }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            {analysisState.status === 'idle' && (
              <Button onClick={startStreamingAnalysis} className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Start Analysis
              </Button>
            )}
            
            {analysisState.status === 'error' && retryCount < maxRetries && (
              <Button onClick={handleRetry} variant="outline" className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Retry ({maxRetries - retryCount} left)
              </Button>
            )}
            
            {(analysisState.status === 'completed' || analysisState.status === 'error') && (
              <Button onClick={resetAnalysis} variant="outline">
                Reset
              </Button>
            )}
          </div>

          {/* Error Display */}
          {analysisState.error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-red-800">Analysis Error</p>
                  <p className="text-red-600 mt-1">{analysisState.error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Metadata Display */}
          {analysisState.metadata && (
            <div className="text-xs text-gray-500 space-y-1">
              {analysisState.metadata.tablesAnalyzed && (
                <p>Tables analyzed: {analysisState.metadata.tablesAnalyzed}</p>
              )}
              {analysisState.metadata.totalTokens && (
                <p>Tokens used: {analysisState.metadata.totalTokens}</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Streaming Content Display */}
      {analysisState.content && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Analysis Stream</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-sm font-mono bg-gray-50 p-4 rounded-md max-h-96 overflow-y-auto">
              {analysisState.content}
              {analysisState.status === 'streaming' && (
                <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Structured Analysis Display */}
      {structuredAnalysis && (
        <StructuredAnalysisDisplay analysis={structuredAnalysis} />
      )}
    </div>
  );
}

interface StructuredAnalysisDisplayProps {
  analysis: AISchemaAnalysis;
}

function StructuredAnalysisDisplay({ analysis }: StructuredAnalysisDisplayProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-500" />
          Structured Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Assessment */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Overall Confidence</h4>
            <Badge 
              variant={analysis.confidence > 0.8 ? "default" : analysis.confidence > 0.6 ? "secondary" : "outline"}
            >
              {Math.round(analysis.confidence * 100)}%
            </Badge>
          </div>
          <p className="text-sm text-gray-600">{analysis.reasoning}</p>
        </div>

        {/* Tables Summary */}
        <div className="space-y-3">
          <h4 className="font-medium">Generated Tables ({analysis.tables.length})</h4>
          <div className="grid gap-3">
            {analysis.tables.map((table, index) => (
              <div key={index} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium">{table.name}</h5>
                  <Badge variant="outline">{table.columns.length} columns</Badge>
                </div>
                
                {table.comment && (
                  <p className="text-xs text-gray-600">{table.comment}</p>
                )}

                <div className="text-xs space-y-1">
                  <p><strong>Columns:</strong> {table.columns.map(c => c.name).join(', ')}</p>
                  {table.relationships.length > 0 && (
                    <p><strong>Relationships:</strong> {table.relationships.length} detected</p>
                  )}
                  {table.indexes.length > 0 && (
                    <p><strong>Indexes:</strong> {table.indexes.length} suggested</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Suggestions */}
        {analysis.suggestions.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">AI Suggestions ({analysis.suggestions.length})</h4>
            <div className="space-y-2">
              {analysis.suggestions.map((suggestion, index) => (
                <div key={index} className="p-3 border rounded-md space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={suggestion.impact === 'high' ? 'default' : 
                               suggestion.impact === 'medium' ? 'secondary' : 'outline'}
                    >
                      {suggestion.type}
                    </Badge>
                    <Badge variant="outline">{suggestion.impact} impact</Badge>
                  </div>
                  <p className="text-sm font-medium">{suggestion.description}</p>
                  <p className="text-xs text-gray-600">{suggestion.reasoning}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}