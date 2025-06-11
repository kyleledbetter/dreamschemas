'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Database, FileText, AlertTriangle, Info, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getCSVPreview } from '@/lib/csv/parser';
import { analyzeCSVTypes } from '@/lib/csv/type-inference';
import type { CSVParseResult } from '@/types/csv.types';

interface CSVPreviewProps {
  parseResults: CSVParseResult[];
  className?: string;
  maxPreviewRows?: number;
  showTypeInference?: boolean;
}

interface TablePreviewProps {
  parseResult: CSVParseResult;
  maxPreviewRows: number;
  showTypeInference: boolean;
}

function TablePreview({ parseResult, maxPreviewRows, showTypeInference }: TablePreviewProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAllColumns, setShowAllColumns] = useState(false);
  
  const preview = useMemo(() => 
    getCSVPreview(parseResult, maxPreviewRows), 
    [parseResult, maxPreviewRows]
  );
  
  const typeInference = useMemo(() => 
    showTypeInference ? analyzeCSVTypes(parseResult.columns) : null,
    [parseResult.columns, showTypeInference]
  );

  const visibleColumns = showAllColumns ? preview.headers : preview.headers.slice(0, 8);
  const hasMoreColumns = preview.headers.length > 8;

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'UUID':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'INTEGER':
      case 'SMALLINT':
      case 'BIGINT':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'NUMERIC':
      case 'REAL':
      case 'DOUBLE PRECISION':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300';
      case 'BOOLEAN':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'DATE':
      case 'TIMESTAMP':
      case 'TIMESTAMPTZ':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'JSONB':
      case 'JSON':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'TEXT':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <Card>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <Database className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-lg">{parseResult.fileName}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {parseResult.totalRows.toLocaleString()} rows × {parseResult.headers.length} columns
                    {parseResult.sampledRows < parseResult.totalRows && (
                      <span className="ml-2 text-xs">
                        (showing sample of {parseResult.sampledRows.toLocaleString()})
                      </span>
                    )}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {parseResult.parseErrors.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {parseResult.parseErrors.length} issues
                  </Badge>
                )}
                
                <Badge variant="secondary">
                  {parseResult.config.delimiter === ',' ? 'CSV' : 
                   parseResult.config.delimiter === '\t' ? 'TSV' : 
                   'Delimited'}
                </Badge>
              </div>
            </div>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Type Inference Summary */}
            {showTypeInference && typeInference && (
              <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Inferred Types</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(typeInference).slice(0, showAllColumns ? undefined : 8).map(([column, inference]) => (
                    <div key={column} className="flex items-center gap-1 text-xs">
                      <span className="font-mono text-muted-foreground max-w-[100px] truncate">
                        {column}:
                      </span>
                      <Badge variant="outline" className={`text-xs ${getTypeColor(inference.type)}`}>
                        {inference.type}
                        {inference.suggestedLength && `(${inference.suggestedLength})`}
                      </Badge>
                      <span className={`text-xs ${getConfidenceColor(inference.confidence)}`}>
                        {Math.round(inference.confidence * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Column visibility toggle */}
            {hasMoreColumns && (
              <div className="mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllColumns(!showAllColumns)}
                  className="gap-2"
                >
                  {showAllColumns ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showAllColumns ? 'Show fewer columns' : `Show all ${preview.headers.length} columns`}
                </Button>
              </div>
            )}

            {/* Data Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 text-left font-medium text-muted-foreground w-12">
                        #
                      </th>
                      {visibleColumns.map((header, index) => (
                        <th key={index} className="p-2 text-left font-medium min-w-[120px]">
                          <div className="space-y-1">
                            <div className="font-mono text-sm">{header}</div>
                            {showTypeInference && typeInference?.[header] && (
                              <div className="flex items-center gap-1">
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${getTypeColor(typeInference[header].type)}`}
                                >
                                  {typeInference[header].type}
                                  {typeInference[header].suggestedLength && 
                                    `(${typeInference[header].suggestedLength})`}
                                </Badge>
                                <span className={`text-xs ${getConfidenceColor(typeInference[header].confidence)}`}>
                                  {Math.round(typeInference[header].confidence * 100)}%
                                </span>
                              </div>
                            )}
                          </div>
                        </th>
                      ))}
                      {!showAllColumns && hasMoreColumns && (
                        <th className="p-2 text-left font-medium text-muted-foreground">
                          +{preview.headers.length - 8} more...
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-t">
                        <td className="p-2 text-muted-foreground font-mono text-xs">
                          {rowIndex + 1}
                        </td>
                        {visibleColumns.map((_, colIndex) => {
                          const value = row[colIndex];
                          return (
                            <td key={colIndex} className="p-2 border-l">
                              <div className="max-w-[200px] truncate">
                                {value === null || value === '' ? (
                                  <span className="text-muted-foreground italic text-xs">null</span>
                                ) : (
                                  <span className="font-mono text-xs">{value}</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        {!showAllColumns && hasMoreColumns && (
                          <td className="p-2 border-l text-muted-foreground text-xs">
                            ...
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer info */}
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>Showing {preview.showingRows} of {preview.totalRows} rows</span>
                {showTypeInference && (
                  <span>Types inferred from sample data</span>
                )}
              </div>
              
              {parseResult.parseErrors.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs">
                  View {parseResult.parseErrors.length} issues
                </Button>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function CSVPreview({ 
  parseResults, 
  className = '',
  maxPreviewRows = 10,
  showTypeInference = true
}: CSVPreviewProps) {
  if (parseResults.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No CSV files uploaded</h3>
          <p className="text-sm text-muted-foreground">
            Upload CSV files to see a preview of your data and inferred schema
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalRows = parseResults.reduce((sum, result) => sum + result.totalRows, 0);
  const totalColumns = parseResults.reduce((sum, result) => sum + result.headers.length, 0);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Data Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">{parseResults.length}</p>
              <p className="text-sm text-muted-foreground">Files</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{totalRows.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Rows</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{totalColumns}</p>
              <p className="text-sm text-muted-foreground">Total Columns</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">
                {parseResults.reduce((sum, result) => sum + result.parseErrors.length, 0)}
              </p>
              <p className="text-sm text-muted-foreground">Issues Found</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual table previews */}
      <div className="space-y-4">
        {parseResults.map((result, index) => (
          <TablePreview
            key={`${result.fileName}-${index}`}
            parseResult={result}
            maxPreviewRows={maxPreviewRows}
            showTypeInference={showTypeInference}
          />
        ))}
      </div>
    </div>
  );
}