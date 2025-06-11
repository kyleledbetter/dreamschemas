'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { 
  Download, 
  Copy, 
  FileText, 
  Database, 
  Code, 
  Settings,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-typescript';
import type { DatabaseSchema } from '@/types/schema.types';
import { 
  generateMigrations, 
  type MigrationOptions, 
  type GeneratedMigration 
} from '@/lib/supabase/migration-formatter';
import { 
  generateTypes, 
  type TypeGeneratorOptions 
} from '@/lib/supabase/type-generator';

interface MigrationPreviewProps {
  schema: DatabaseSchema;
  className?: string;
}

interface PreviewOptions {
  format: 'migration' | 'declarative' | 'prisma';
  includeDropStatements: boolean;
  includeComments: boolean;
  includeRLS: boolean;
  includeIndexes: boolean;
  includeTypes: boolean;
  typeFormat: 'typescript' | 'supabase' | 'prisma-client';
}

export function MigrationPreview({ schema, className = '' }: MigrationPreviewProps) {
  const [options, setOptions] = useState<PreviewOptions>({
    format: 'migration',
    includeDropStatements: false,
    includeComments: true,
    includeRLS: true,
    includeIndexes: true,
    includeTypes: true,
    typeFormat: 'typescript'
  });

  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set(['0']));
  const [copiedFiles, setCopiedFiles] = useState<Set<string>>(new Set());

  // Generate migrations based on current options
  const generatedFiles = useMemo(() => {
    const migrationOptions: Partial<MigrationOptions> = {
      format: options.format,
      includeDropStatements: options.includeDropStatements,
      includeComments: options.includeComments,
      includeRLS: options.includeRLS,
      includeIndexes: options.includeIndexes,
      timestampPrefix: true
    };

    const migrations = generateMigrations(schema, migrationOptions);

    // Add type files if enabled
    if (options.includeTypes) {
      const typeOptions: Partial<TypeGeneratorOptions> = {
        format: options.typeFormat,
        includeComments: options.includeComments
      };
      const types = generateTypes(schema, typeOptions);
      migrations.push(...types);
    }

    return migrations;
  }, [schema, options]);

  const toggleFileExpansion = useCallback((index: string) => {
    setExpandedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  const copyToClipboard = useCallback(async (content: string, index: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedFiles(prev => new Set(prev).add(index));
      
      // Clear copied state after 2 seconds
      setTimeout(() => {
        setCopiedFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(index);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, []);

  const downloadFile = useCallback((file: GeneratedMigration) => {
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const downloadAll = useCallback(() => {
    // Create a zip-like structure by downloading multiple files
    generatedFiles.forEach(file => {
      setTimeout(() => downloadFile(file), 100); // Small delay between downloads
    });
  }, [generatedFiles, downloadFile]);

  const getLanguageFromType = (type: GeneratedMigration['type']): string => {
    switch (type) {
      case 'sql':
        return 'sql';
      case 'typescript':
        return 'typescript';
      case 'prisma':
        return 'prisma'; // Falls back to text if not available
      default:
        return 'text';
    }
  };

  const getFileIcon = (type: GeneratedMigration['type']) => {
    switch (type) {
      case 'sql':
        return <Database className="h-4 w-4" />;
      case 'typescript':
        return <Code className="h-4 w-4" />;
      case 'prisma':
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getFileTypeColor = (type: GeneratedMigration['type']): string => {
    switch (type) {
      case 'sql':
        return 'bg-blue-100 text-blue-800';
      case 'typescript':
        return 'bg-purple-100 text-purple-800';
      case 'prisma':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Migration Preview</h2>
          <p className="text-muted-foreground">
            Generate and export your database schema in multiple formats
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={downloadAll}
            variant="outline"
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download All
          </Button>
        </div>
      </div>

      {/* Options Panel */}
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Export Options
              <Badge variant="outline">{generatedFiles.length} files</Badge>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <Collapsible defaultOpen>
          <CollapsibleContent>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Format Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Format</label>
                <select
                  value={options.format}
                  onChange={(e) => setOptions(prev => ({ 
                    ...prev, 
                    format: e.target.value as PreviewOptions['format']
                  }))}
                  className="w-full p-2 border rounded-md text-sm"
                >
                  <option value="migration">Supabase Migration</option>
                  <option value="declarative">Declarative SQL</option>
                  <option value="prisma">Prisma Schema</option>
                </select>
              </div>

              {/* Type Format */}
              {options.includeTypes && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type Format</label>
                  <select
                    value={options.typeFormat}
                    onChange={(e) => setOptions(prev => ({ 
                      ...prev, 
                      typeFormat: e.target.value as PreviewOptions['typeFormat']
                    }))}
                    className="w-full p-2 border rounded-md text-sm"
                  >
                    <option value="typescript">TypeScript</option>
                    <option value="supabase">Supabase Types</option>
                    <option value="prisma-client">Prisma Client</option>
                  </select>
                </div>
              )}

              {/* Boolean Options */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Include</label>
                
                {[
                  { key: 'includeComments', label: 'Comments' },
                  { key: 'includeRLS', label: 'RLS Policies' },
                  { key: 'includeIndexes', label: 'Indexes' },
                  { key: 'includeDropStatements', label: 'Drop Statements' },
                  { key: 'includeTypes', label: 'TypeScript Types' }
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={options[key as keyof PreviewOptions] as boolean}
                      onChange={(e) => setOptions(prev => ({ 
                        ...prev, 
                        [key]: e.target.checked 
                      }))}
                      className="rounded"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Generated Files */}
      <div className="space-y-4">
        {generatedFiles.map((file, index) => {
          const indexStr = index.toString();
          const isExpanded = expandedFiles.has(indexStr);
          const isCopied = copiedFiles.has(indexStr);

          return (
            <Card key={index}>
              <Collapsible
                open={isExpanded}
                onOpenChange={() => toggleFileExpansion(indexStr)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getFileIcon(file.type)}
                        <div>
                          <CardTitle className="text-base">{file.filename}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {file.description}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={getFileTypeColor(file.type)}
                        >
                          {file.type.toUpperCase()}
                        </Badge>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(file.content, indexStr);
                          }}
                          className="gap-1"
                        >
                          {isCopied ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              Copy
                            </>
                          )}
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadFile(file);
                          }}
                          className="gap-1"
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </Button>

                        {isExpanded ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    {/* File Stats */}
                    <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
                      <span>{file.content.split('\n').length} lines</span>
                      <span>{file.content.length} characters</span>
                      <span>{Math.round(file.content.length / 1024 * 100) / 100} KB</span>
                    </div>

                    {/* Syntax Highlighted Code */}
                    <div className="relative">
                      <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto max-h-96">
                        <code
                          dangerouslySetInnerHTML={{
                            __html: Prism.highlight(
                              file.content,
                              Prism.languages[getLanguageFromType(file.type)] || Prism.languages.text,
                              getLanguageFromType(file.type)
                            )
                          }}
                        />
                      </pre>
                      
                      {/* Copy overlay button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(file.content, indexStr)}
                        className="absolute top-2 right-2 opacity-60 hover:opacity-100"
                      >
                        {isCopied ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {/* Summary */}
      {generatedFiles.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-medium mb-2">No files generated</h3>
            <p className="text-muted-foreground">
              Check your export options and ensure your schema contains tables.
            </p>
          </CardContent>
        </Card>
      )}

      {generatedFiles.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Ready to export</span>
                </div>
                <span className="text-muted-foreground">
                  {generatedFiles.length} file{generatedFiles.length !== 1 ? 's' : ''} generated
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Total size: {Math.round(
                    generatedFiles.reduce((acc, file) => acc + file.content.length, 0) / 1024 * 100
                  ) / 100} KB
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}