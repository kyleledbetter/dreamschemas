'use client';

import React, { useState, useCallback } from 'react';
import { Play, Square, Database, Clock, AlertCircle, CheckCircle2, Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';
import type { PGLiteTestResult } from '@/lib/db/pglite-instance';

interface QueryInterfaceProps {
  onExecuteQuery: (query: string) => Promise<PGLiteTestResult>;
  isExecuting?: boolean;
  className?: string;
}

interface QueryTab {
  id: string;
  name: string;
  query: string;
  result?: PGLiteTestResult;
  isExecuting?: boolean;
}

export function QueryInterface({ 
  onExecuteQuery, 
  isExecuting = false, 
  className = '' 
}: QueryInterfaceProps) {
  const [tabs, setTabs] = useState<QueryTab[]>([
    {
      id: 'query-1',
      name: 'Query 1',
      query: '-- Enter your SQL query here\nSELECT 1 as test;'
    }
  ]);
  const [activeTabId, setActiveTabId] = useState('query-1');

  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];

  const updateTabQuery = useCallback((tabId: string, query: string) => {
    setTabs(prev => prev.map(tab => 
      tab.id === tabId ? { ...tab, query } : tab
    ));
  }, []);

  const executeQuery = useCallback(async () => {
    if (!activeTab || isExecuting) return;

    const query = activeTab.query.trim();
    if (!query) return;

    // Mark tab as executing
    setTabs(prev => prev.map(tab => {
      if (tab.id === activeTab.id) {
        const updatedTab: QueryTab = { ...tab, isExecuting: true };
        delete updatedTab.result;
        return updatedTab;
      }
      return tab;
    }));

    try {
      const result = await onExecuteQuery(query);
      
      setTabs(prev => prev.map(tab => 
        tab.id === activeTab.id ? { ...tab, isExecuting: false, result } : tab
      ));
    } catch (error) {
      const errorResult: PGLiteTestResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0,
        query
      };

      setTabs(prev => prev.map(tab => 
        tab.id === activeTab.id ? { ...tab, isExecuting: false, result: errorResult } : tab
      ));
    }
  }, [activeTab, isExecuting, onExecuteQuery]);

  const addNewTab = useCallback(() => {
    const newTab: QueryTab = {
      id: `query-${Date.now()}`,
      name: `Query ${tabs.length + 1}`,
      query: '-- Enter your SQL query here\n'
    };
    
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, [tabs.length]);

  const closeTab = useCallback((tabId: string) => {
    if (tabs.length <= 1) return;

    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    
    setTabs(newTabs);
    
    if (activeTabId === tabId) {
      const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
      setActiveTabId(newTabs[newActiveIndex].id);
    }
  }, [tabs, activeTabId]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, []);

  const downloadResults = useCallback((result: PGLiteTestResult) => {
    const data = {
      query: result.query,
      success: result.success,
      executionTime: result.executionTime,
      rowsAffected: result.rowsAffected,
      results: result.results,
      error: result.error
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query-result-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Tab Bar */}
      <div className="flex items-center gap-2 p-3 border-b bg-muted/30">
        <div className="flex items-center gap-1 flex-1 overflow-x-auto">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer
                ${activeTabId === tab.id ? 'bg-background shadow-sm' : 'hover:bg-muted'}
              `}
              onClick={() => setActiveTabId(tab.id)}
            >
              <Database className="h-3 w-3" />
              <span className="text-sm font-medium truncate max-w-[100px]">
                {tab.name}
              </span>
              {tab.isExecuting && (
                <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
              )}
              {tab.result && (
                <div className={`h-2 w-2 rounded-full ${
                  tab.result.success ? 'bg-green-500' : 'bg-red-500'
                }`} />
              )}
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="ml-1 hover:bg-muted rounded p-0.5"
                >
                  <Square className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={addNewTab}
          className="shrink-0"
        >
          + New Query
        </Button>
      </div>

      {/* Query Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-medium">SQL Query Editor</h3>
            <Button
              onClick={executeQuery}
              disabled={isExecuting || activeTab?.isExecuting}
              size="sm"
              className="gap-2"
            >
              {isExecuting || activeTab?.isExecuting ? (
                <>
                  <Square className="h-4 w-4" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Execute
                </>
              )}
            </Button>
          </div>

          <div className="relative">
            <textarea
              value={activeTab?.query || ''}
              onChange={(e) => updateTabQuery(activeTab?.id || '', e.target.value)}
              className="w-full h-32 p-3 border rounded-md font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter your SQL query here..."
              spellCheck={false}
            />
            
            {activeTab?.query && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(activeTab.query)}
                className="absolute top-2 right-2 opacity-60 hover:opacity-100"
              >
                <Copy className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Results Panel */}
        <div className="flex-1 overflow-auto">
          {activeTab?.result ? (
            <QueryResults
              result={activeTab.result}
              onCopy={copyToClipboard}
              onDownload={downloadResults}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Execute a query to see results</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface QueryResultsProps {
  result: PGLiteTestResult;
  onCopy: (text: string) => Promise<void>;
  onDownload: (result: PGLiteTestResult) => void;
}

function QueryResults({ result, onCopy, onDownload }: QueryResultsProps) {
  const formatExecutionTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="p-4 space-y-4">
      {/* Result Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {result.success ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-600" />
          )}
          
          <div className="flex items-center gap-4 text-sm">
            <Badge variant={result.success ? 'default' : 'destructive'}>
              {result.success ? 'Success' : 'Error'}
            </Badge>
            
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatExecutionTime(result.executionTime)}
            </div>
            
            {result.rowsAffected !== undefined && (
              <span className="text-muted-foreground">
                {result.rowsAffected} rows affected
              </span>
            )}

            {result.results && (
              <span className="text-muted-foreground">
                {result.results.length} rows returned
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCopy(JSON.stringify(result, null, 2))}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            Copy
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDownload(result)}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {!result.success && result.error && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-red-600 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm text-red-800 bg-red-50 p-3 rounded border whitespace-pre-wrap">
              {result.error}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Results Table */}
      {result.success && result.results && result.results.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Query Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {Object.keys(result.results[0]).map(column => (
                      <th key={column} className="text-left p-2 font-medium">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.results.slice(0, 100).map((row, index) => (
                    <tr key={index} className="border-b hover:bg-muted/50">
                      {Object.values(row).map((value, cellIndex) => (
                        <td key={cellIndex} className="p-2">
                          <div className="max-w-[200px] truncate">
                            {value === null ? (
                              <span className="text-muted-foreground italic">null</span>
                            ) : typeof value === 'object' ? (
                              <span className="font-mono text-xs">
                                {JSON.stringify(value)}
                              </span>
                            ) : (
                              <span className="font-mono text-xs">
                                {String(value)}
                              </span>
                            )}
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {result.results.length > 100 && (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  Showing first 100 of {result.results.length} rows
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty Results */}
      {result.success && result.results && result.results.length === 0 && (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            Query executed successfully but returned no results
          </CardContent>
        </Card>
      )}

      {/* Query Display */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Executed Query</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-sm bg-muted p-3 rounded border overflow-x-auto">
            <code
              dangerouslySetInnerHTML={{
                __html: Prism.highlight(result.query, Prism.languages.sql, 'sql')
              }}
            />
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}