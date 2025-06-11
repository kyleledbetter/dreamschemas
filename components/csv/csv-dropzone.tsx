'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, X, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { validateFiles, formatFileSize } from '@/lib/utils/validation';
import { parseMultipleCSVs } from '@/lib/csv/parser';
import type { CSVFile, CSVParseResult, CSVUploadProgress } from '@/types/csv.types';

interface CSVDropzoneProps {
  onFilesUploaded: (results: CSVParseResult[]) => void;
  onError: (error: string) => void;
  maxFiles?: number;
  disabled?: boolean;
  className?: string;
}

export function CSVDropzone({
  onFilesUploaded,
  onError,
  maxFiles = 10,
  disabled = false,
  className = ''
}: CSVDropzoneProps) {
  const [uploadedFiles, setUploadedFiles] = useState<CSVFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Map<string, CSVUploadProgress>>(new Map());
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (disabled || isProcessing) return;

    // Validate files
    const validation = validateFiles(acceptedFiles);
    if (!validation.valid) {
      onError(validation.errors.join('\n'));
      return;
    }

    // Check total file count
    if (uploadedFiles.length + acceptedFiles.length > maxFiles) {
      onError(`Cannot upload more than ${maxFiles} files. Currently have ${uploadedFiles.length} files.`);
      return;
    }

    // Create CSV file objects
    const csvFiles: CSVFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substring(2),
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      file
    }));

    // Add to uploaded files
    setUploadedFiles(prev => [...prev, ...csvFiles]);

    // Initialize progress tracking
    const newProgress = new Map(uploadProgress);
    csvFiles.forEach(csvFile => {
      newProgress.set(csvFile.id, {
        fileId: csvFile.id,
        fileName: csvFile.name,
        status: 'pending',
        progress: 0,
        currentStep: 'Preparing...'
      });
    });
    setUploadProgress(newProgress);

    // Process files
    setIsProcessing(true);
    try {
      // Update progress to parsing
      csvFiles.forEach(csvFile => {
        const progress = newProgress.get(csvFile.id);
        if (progress) {
          progress.status = 'parsing';
          progress.progress = 25;
          progress.currentStep = 'Parsing CSV...';
        }
      });
      setUploadProgress(new Map(newProgress));

      // Parse CSV files
      const parseResults = await parseMultipleCSVs(
        csvFiles.map(f => f.file),
        {
          sampleSize: 1000,
          hasHeader: true,
          skipEmptyLines: true,
          trimWhitespace: true
        }
      );

      // Update progress to analyzing
      csvFiles.forEach(csvFile => {
        const progress = newProgress.get(csvFile.id);
        if (progress) {
          progress.status = 'analyzing';
          progress.progress = 75;
          progress.currentStep = 'Analyzing data...';
        }
      });
      setUploadProgress(new Map(newProgress));

      // Simulate analysis time
      await new Promise(resolve => setTimeout(resolve, 500));

      // Complete processing
      csvFiles.forEach(csvFile => {
        const progress = newProgress.get(csvFile.id);
        if (progress) {
          progress.status = 'completed';
          progress.progress = 100;
          progress.currentStep = 'Complete';
        }
      });
      setUploadProgress(new Map(newProgress));

      // Notify parent component
      onFilesUploaded(parseResults);

    } catch (error) {
      // Update progress to error
      csvFiles.forEach(csvFile => {
        const progress = newProgress.get(csvFile.id);
        if (progress) {
          progress.status = 'error';
          progress.progress = 0;
          progress.error = error instanceof Error ? error.message : 'Unknown error';
        }
      });
      setUploadProgress(new Map(newProgress));

      onError(error instanceof Error ? error.message : 'Failed to process CSV files');
    } finally {
      setIsProcessing(false);
    }
  }, [uploadedFiles, uploadProgress, maxFiles, disabled, isProcessing, onFilesUploaded, onError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'text/tab-separated-values': ['.tsv'],
      'text/plain': ['.txt']
    },
    multiple: true,
    maxFiles,
    disabled: disabled || isProcessing,
    maxSize: 50 * 1024 * 1024 // 50MB
  });

  const removeFile = (fileId: string) => {
    if (isProcessing) return;
    
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    setUploadProgress(prev => {
      const newMap = new Map(prev);
      newMap.delete(fileId);
      return newMap;
    });
  };

  const clearAllFiles = () => {
    if (isProcessing) return;
    
    setUploadedFiles([]);
    setUploadProgress(new Map());
  };

  const getProgressIcon = (status: CSVUploadProgress['status']) => {
    switch (status) {
      case 'pending':
        return <FileText className="h-4 w-4 text-muted-foreground" />;
      case 'parsing':
      case 'analyzing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: CSVUploadProgress['status']) => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'parsing':
      case 'analyzing':
        return 'default';
      case 'completed':
        return 'default';
      case 'error':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Dropzone */}
      <Card
        {...getRootProps()}
        className={`
          cursor-pointer border-dashed transition-colors duration-200
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
          ${disabled || isProcessing ? 'cursor-not-allowed opacity-50' : 'hover:border-primary hover:bg-primary/5'}
        `}
      >
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <input {...getInputProps()} />
          
          <Upload className={`h-12 w-12 mb-4 ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
          
          <div className="space-y-2">
            <p className="text-lg font-medium">
              {isDragActive ? 'Drop CSV files here' : 'Upload CSV files'}
            </p>
            <p className="text-sm text-muted-foreground">
              Drag and drop CSV, TSV, or TXT files here, or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Maximum {maxFiles} files, 50MB each
            </p>
          </div>

          {!isDragActive && !disabled && !isProcessing && (
            <Button className="mt-4" variant="outline">
              Choose Files
            </Button>
          )}

          {isProcessing && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing files...
            </div>
          )}
        </CardContent>
      </Card>

      {/* File List */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium">
                Uploaded Files ({uploadedFiles.length})
              </h3>
              {!isProcessing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFiles}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear All
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {uploadedFiles.map(file => {
                const progress = uploadProgress.get(file.id);
                return (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    {getProgressIcon(progress?.status || 'pending')}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate">{file.name}</p>
                        <Badge variant={getStatusColor(progress?.status || 'pending')} className="text-xs">
                          {progress?.status || 'pending'}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{formatFileSize(file.size)}</span>
                        {progress?.currentStep && (
                          <span>{progress.currentStep}</span>
                        )}
                      </div>

                      {progress && progress.status !== 'pending' && progress.status !== 'error' && (
                        <div className="mt-2">
                          <div className="w-full bg-secondary rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${progress.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {progress?.error && (
                        <p className="text-sm text-red-500 mt-1">{progress.error}</p>
                      )}
                    </div>

                    {!isProcessing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(file.id)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}