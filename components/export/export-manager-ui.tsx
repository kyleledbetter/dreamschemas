'use client';

import React, { useState, useCallback } from 'react';
import {
  Download,
  FileText,
  Database,
  Code,
  Settings,
  Globe,
  Container,
  Cloud,
  Braces,
  GitBranch,
  Share2,
  Shield,
  Type,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  Package,
  Copy,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ExportManager, type ExportFormat, type ExportOptions, type ExportResult } from '@/lib/export/export-manager';
import type { DatabaseSchema } from '@/types/schema.types';

interface ExportManagerUIProps {
  schema: DatabaseSchema;
  className?: string;
}

interface ExportJob {
  id: string;
  format: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  result?: ExportResult;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

export function ExportManagerUI({ schema, className = '' }: ExportManagerUIProps) {
  const [selectedFormats, setSelectedFormats] = useState<Set<string>>(new Set());
  const [exportOptions, setExportOptions] = useState<Partial<ExportOptions>>({
    includeComments: true,
    includeDropStatements: false,
    includeRLS: true,
    includeIndexes: true,
    includeConstraints: true,
    includeData: false,
    indentation: 'spaces',
    spacesCount: 2,
    lineEnding: 'lf',
  });
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [activeTab, setActiveTab] = useState('formats');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['sql', 'types']));

  const formats = ExportManager.getFormats();
  const categories = Array.from(new Set(formats.map(f => f.category)));

  const getFormatIcon = (format: ExportFormat) => {
    const iconMap = {
      database: Database,
      code: Code,
      settings: Settings,
      'file-text': FileText,
      globe: Globe,
      container: Container,
      cloud: Cloud,
      braces: Braces,
      'git-branch': GitBranch,
      'share-2': Share2,
      shield: Shield,
      type: Type,
    };
    return iconMap[format.icon as keyof typeof iconMap] || FileText;
  };

  const getCategoryIcon = (category: ExportFormat['category']) => {
    const iconMap = {
      sql: Database,
      types: Type,
      documentation: FileText,
      data: Package,
      config: Settings,
    };
    return iconMap[category];
  };

  const toggleFormat = useCallback((formatId: string) => {
    setSelectedFormats(prev => {
      const newSet = new Set(prev);
      if (newSet.has(formatId)) {
        newSet.delete(formatId);
      } else {
        newSet.add(formatId);
      }
      return newSet;
    });
  }, []);

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  }, []);

  const selectAllInCategory = useCallback((category: ExportFormat['category']) => {
    const categoryFormats = formats.filter(f => f.category === category);
    setSelectedFormats(prev => {
      const newSet = new Set(prev);
      categoryFormats.forEach(format => newSet.add(format.id));
      return newSet;
    });
  }, [formats]);

  const deselectAllInCategory = useCallback((category: ExportFormat['category']) => {
    const categoryFormats = formats.filter(f => f.category === category);
    setSelectedFormats(prev => {
      const newSet = new Set(prev);
      categoryFormats.forEach(format => newSet.delete(format.id));
      return newSet;
    });
  }, [formats]);

  const startExport = useCallback(async (formatIds: string[]) => {
    const newJobs: ExportJob[] = formatIds.map(formatId => ({
      id: `${formatId}-${Date.now()}`,
      format: formatId,
      status: 'pending',
      progress: 0,
      startedAt: new Date(),
    }));

    setExportJobs(prev => [...prev, ...newJobs]);

    // Process each export
    for (const job of newJobs) {
      try {
        // Update job to running
        setExportJobs(prev => prev.map(j => 
          j.id === job.id ? { ...j, status: 'running', progress: 10 } : j
        ));

        // Simulate progress updates
        for (let progress = 20; progress <= 80; progress += 20) {
          await new Promise(resolve => setTimeout(resolve, 200));
          setExportJobs(prev => prev.map(j => 
            j.id === job.id ? { ...j, progress } : j
          ));
        }

        // Perform actual export
        const result = await ExportManager.exportSchema(schema, {
          ...exportOptions,
          format: job.format,
        } as ExportOptions);

        // Update job to completed
        setExportJobs(prev => prev.map(j => 
          j.id === job.id ? { 
            ...j, 
            status: 'completed',
            progress: 100,
            result,
            completedAt: new Date()
          } : j
        ));

      } catch (error) {
        console.error(`Export failed for ${job.format}:`, error);
        setExportJobs(prev => prev.map(j => 
          j.id === job.id ? { 
            ...j, 
            status: 'failed',
            error: error instanceof Error ? error.message : 'Export failed',
            completedAt: new Date()
          } : j
        ));
      }
    }
  }, [schema, exportOptions]);

  const exportSelected = useCallback(() => {
    if (selectedFormats.size > 0) {
      startExport(Array.from(selectedFormats));
    }
  }, [selectedFormats, startExport]);

  const exportSingle = useCallback((formatId: string) => {
    startExport([formatId]);
  }, [startExport]);

  const downloadResult = useCallback((job: ExportJob) => {
    if (!job.result) return;

    job.result.files.forEach(file => {
      const blob = new Blob([file.content], { type: file.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }, []);

  const copyToClipboard = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      // Could add a toast notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, []);

  const clearJobs = useCallback(() => {
    setExportJobs([]);
  }, []);

  const runningJobs = exportJobs.filter(job => job.status === 'running').length;
  const completedJobs = exportJobs.filter(job => job.status === 'completed').length;
  const failedJobs = exportJobs.filter(job => job.status === 'failed').length;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Schema Export Manager
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Export {schema.name} to multiple formats for different tools and frameworks
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {selectedFormats.size > 0 && (
                <Button onClick={exportSelected} className="gap-2">
                  <Download className="h-4 w-4" />
                  Export {selectedFormats.size} Format{selectedFormats.size !== 1 ? 's' : ''}
                </Button>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{formats.length}</p>
              <p className="text-xs text-muted-foreground">Available Formats</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{selectedFormats.size}</p>
              <p className="text-xs text-muted-foreground">Selected</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">{runningJobs}</p>
              <p className="text-xs text-muted-foreground">Exporting</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{completedJobs}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="formats">Select Formats</TabsTrigger>
          <TabsTrigger value="options">Export Options</TabsTrigger>
          <TabsTrigger value="progress" className="relative">
            Progress
            {runningJobs > 0 && (
              <Badge className="ml-2 bg-orange-600 text-white text-xs">
                {runningJobs}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="results" className="relative">
            Results
            {completedJobs > 0 && (
              <Badge className="ml-2 bg-green-600 text-white text-xs">
                {completedJobs}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="formats">
          <div className="space-y-4">
            {categories.map(category => {
              const categoryFormats = formats.filter(f => f.category === category);
              const CategoryIcon = getCategoryIcon(category);
              const isExpanded = expandedCategories.has(category);
              const selectedInCategory = categoryFormats.filter(f => selectedFormats.has(f.id)).length;

              return (
                <Card key={category}>
                  <Collapsible
                    open={isExpanded}
                    onOpenChange={() => toggleCategory(category)}
                  >
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {CategoryIcon && <CategoryIcon className="h-5 w-5 text-muted-foreground" />}
                            <div>
                              <CardTitle className="text-base capitalize">
                                {category} Formats
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                {categoryFormats.length} format{categoryFormats.length !== 1 ? 's' : ''} available
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {selectedInCategory > 0 && (
                              <Badge className="bg-blue-100 text-blue-800">
                                {selectedInCategory} selected
                              </Badge>
                            )}
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectAllInCategory(category);
                                }}
                                className="text-xs"
                              >
                                Select All
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deselectAllInCategory(category);
                                }}
                                className="text-xs"
                              >
                                Clear
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {categoryFormats.map(format => {
                            const Icon = getFormatIcon(format);
                            const isSelected = selectedFormats.has(format.id);

                            return (
                              <div
                                key={format.id}
                                className={cn(
                                  'p-4 border rounded-lg cursor-pointer transition-all',
                                  isSelected 
                                    ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                                    : 'border-gray-200 hover:border-gray-300'
                                )}
                                onClick={() => toggleFormat(format.id)}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <Icon className="h-5 w-5 text-muted-foreground" />
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      .{format.extension}
                                    </Badge>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        exportSingle(format.id);
                                      }}
                                    >
                                      <Download className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                                
                                <h4 className="font-medium text-sm mb-1">{format.name}</h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {format.description}
                                </p>
                                
                                {format.supportsOptions && (
                                  <Badge variant="outline" className="mt-2 text-xs">
                                    Configurable
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="options">
          <Card>
            <CardHeader>
              <CardTitle>Export Options</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure how your schema should be exported
              </p>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Content Options */}
              <div>
                <h4 className="font-medium mb-3">Content Options</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { key: 'includeComments', label: 'Include Comments' },
                    { key: 'includeDropStatements', label: 'Include DROP Statements' },
                    { key: 'includeRLS', label: 'Include RLS Policies' },
                    { key: 'includeIndexes', label: 'Include Indexes' },
                    { key: 'includeConstraints', label: 'Include Constraints' },
                    { key: 'includeData', label: 'Include Sample Data' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center space-x-2">
                      <Checkbox
                        id={key}
                        checked={exportOptions[key as keyof ExportOptions] as boolean}
                        onCheckedChange={(checked) => setExportOptions(prev => ({
                          ...prev,
                          [key]: checked
                        }))}
                      />
                      <Label htmlFor={key} className="text-sm">{label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Formatting Options */}
              <div>
                <h4 className="font-medium mb-3">Formatting Options</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="indentation">Indentation</Label>
                    <Select
                      value={exportOptions.indentation}
                      onValueChange={(value) => setExportOptions(prev => ({
                        ...prev,
                        indentation: value as 'spaces' | 'tabs'
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="spaces">Spaces</SelectItem>
                        <SelectItem value="tabs">Tabs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {exportOptions.indentation === 'spaces' && (
                    <div>
                      <Label htmlFor="spacesCount">Spaces Count</Label>
                      <Input
                        id="spacesCount"
                        type="number"
                        min="1"
                        max="8"
                        value={exportOptions.spacesCount}
                        onChange={(e) => setExportOptions(prev => ({
                          ...prev,
                          spacesCount: parseInt(e.target.value)
                        }))}
                      />
                    </div>
                  )}
                  
                  <div>
                    <Label htmlFor="lineEnding">Line Ending</Label>
                    <Select
                      value={exportOptions.lineEnding}
                      onValueChange={(value) => setExportOptions(prev => ({
                        ...prev,
                        lineEnding: value as 'lf' | 'crlf'
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lf">LF (Unix)</SelectItem>
                        <SelectItem value="crlf">CRLF (Windows)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Table Prefix */}
              <div>
                <Label htmlFor="tablePrefix">Table Prefix (Optional)</Label>
                <Input
                  id="tablePrefix"
                  value={exportOptions.tablePrefix || ''}
                  onChange={(e) => setExportOptions(prev => ({
                    ...prev,
                    tablePrefix: e.target.value || undefined
                  }))}
                  placeholder="e.g., app_, prod_"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Add a prefix to all table names in the exported schema
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress">
          <div className="space-y-4">
            {runningJobs > 0 && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>
                  {runningJobs} export{runningJobs !== 1 ? 's' : ''} in progress...
                </AlertDescription>
              </Alert>
            )}

            {exportJobs.filter(job => job.status === 'running').map(job => {
              const format = formats.find(f => f.id === job.format);
              
              return (
                <Card key={job.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        <CardTitle className="text-sm">{format?.name}</CardTitle>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800">
                        {job.progress}%
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <Progress value={job.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                      Started {job.startedAt.toLocaleTimeString()}
                    </p>
                  </CardContent>
                </Card>
              );
            })}

            {runningJobs === 0 && exportJobs.length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <Download className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No exports in progress</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="results">
          <div className="space-y-4">
            {exportJobs.length > 0 && (
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  {completedJobs} completed, {failedJobs} failed
                </p>
                <Button variant="outline" size="sm" onClick={clearJobs}>
                  Clear All
                </Button>
              </div>
            )}

            {exportJobs.filter(job => job.status === 'completed' || job.status === 'failed').map(job => {
              const format = formats.find(f => f.id === job.format);
              const isSuccess = job.status === 'completed';
              
              return (
                <Card key={job.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isSuccess ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                        <CardTitle className="text-sm">{format?.name}</CardTitle>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isSuccess && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadResult(job)}
                              className="gap-2"
                            >
                              <Download className="h-3 w-3" />
                              Download
                            </Button>
                            <Badge className="bg-green-100 text-green-800">
                              {job.result?.files.length} file{job.result?.files.length !== 1 ? 's' : ''}
                            </Badge>
                          </>
                        )}
                        {!isSuccess && (
                          <Badge variant="destructive">Failed</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    {isSuccess && job.result && (
                      <div className="space-y-3">
                        {job.result.files.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">{file.filename}</span>
                              <Badge variant="outline" className="text-xs">
                                {(file.size / 1024).toFixed(1)} KB
                              </Badge>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => copyToClipboard(file.content)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={() => {
                                  // Could open a preview modal
                                  console.log('Preview file:', file);
                                }}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        
                        <div className="text-xs text-muted-foreground">
                          Generated: {job.result.metadata.generatedAt.toLocaleString()}
                        </div>
                      </div>
                    )}
                    
                    {!isSuccess && job.error && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{job.error}</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {exportJobs.filter(job => job.status === 'completed' || job.status === 'failed').length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No export results yet</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}