"use client";

import React, { useState, useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  Settings,
  Info,
  Download,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  CSVValidator,
  csvValidators,
  type CSVValidationOptions,
  type CSVValidationResult,
} from "@/lib/csv/validator";
import { CSVValidatorDisplay } from "./csv-validator-display";

interface EnhancedCSVDropzoneProps {
  onValidationComplete?: (result: CSVValidationResult, file: File) => void;
  onError?: (error: string) => void;
  validationOptions?: CSVValidationOptions;
  className?: string;
  maxFiles?: number;
  disabled?: boolean;
  initialFiles?: CSVValidationResult[];
}

interface FileValidationState {
  file: File;
  status: "pending" | "validating" | "completed" | "error";
  progress: number;
  result?: CSVValidationResult;
  error?: string;
  originalMetadata?: {
    name: string;
    size: number;
    type: string;
  };
}

export function EnhancedCSVDropzone({
  onValidationComplete,
  onError,
  validationOptions = {},
  className = "",
  maxFiles = 1,
  disabled = false,
  initialFiles = [],
}: EnhancedCSVDropzoneProps) {
  const [files, setFiles] = useState<FileValidationState[]>(() =>
    initialFiles.map((result) => ({
      file: new File(
        [],
        result.originalMetadata?.name || `data_${result.metadata.totalRows}.csv`
      ),
      status: "completed" as const,
      progress: 100,
      result,
      ...(result.originalMetadata && {
        originalMetadata: result.originalMetadata,
      }),
    }))
  );
  const [validator] = useState(
    () =>
      new CSVValidator({
        ...validationOptions,
        customValidators: [
          csvValidators.emailValidator,
          csvValidators.dateValidator,
          ...(validationOptions.customValidators || []),
        ],
      })
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      if (disabled) return;

      // Handle rejected files
      if (rejectedFiles.length > 0) {
        const errors = rejectedFiles
          .map(
            ({ file, errors }) =>
              `${file.name}: ${errors.map((e) => e.message).join(", ")}`
          )
          .join("; ");
        onError?.(errors);
        return;
      }

      // Filter CSV files only
      const csvFiles = acceptedFiles.filter((file) => {
        const isCSV =
          file.type === "text/csv" ||
          file.type === "text/plain" ||
          file.name.toLowerCase().endsWith(".csv") ||
          file.name.toLowerCase().endsWith(".txt");

        if (!isCSV) {
          onError?.(`${file.name} is not a valid CSV file`);
        }
        return isCSV;
      });

      if (csvFiles.length === 0) return;

      // Initialize validation states
      const newFiles: FileValidationState[] = csvFiles.map((file) => ({
        file,
        status: "pending",
        progress: 0,
        originalMetadata: {
          name: file.name,
          size: file.size,
          type: file.type,
        },
      }));

      setFiles((prev) => [
        ...prev.slice(0, maxFiles - csvFiles.length),
        ...newFiles,
      ]);

      // Start validation for each file
      for (let i = 0; i < csvFiles.length; i++) {
        const file = csvFiles[i];
        const fileIndex = files.length + i;

        try {
          // Update status to validating
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === fileIndex
                ? { ...f, status: "validating", progress: 10 }
                : f
            )
          );

          // Simulate progressive validation steps
          const updateProgress = (progress: number) => {
            setFiles((prev) =>
              prev.map((f, idx) => (idx === fileIndex ? { ...f, progress } : f))
            );
          };

          updateProgress(25);
          await new Promise((resolve) => setTimeout(resolve, 200));

          updateProgress(50);
          const result = await validator.validateFile(file);

          // Add original metadata to the validation result
          result.originalMetadata = {
            name: file.name,
            size: file.size,
            type: file.type,
          };

          // Check if validation was successful
          if (!result.isValid) {
            throw new Error(
              result.errors.map((e) => e.message).join("; ") ||
                "CSV validation failed"
            );
          }

          updateProgress(100);

          // Update with results
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === fileIndex
                ? {
                    ...f,
                    status: "completed",
                    progress: 100,
                    result,
                  }
                : f
            )
          );

          onValidationComplete?.(result, file);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Validation failed";

          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === fileIndex
                ? {
                    ...f,
                    status: "error",
                    error: errorMessage,
                  }
                : f
            )
          );

          onError?.(errorMessage);
        }
      }
    },
    [disabled, files.length, maxFiles, onError, onValidationComplete, validator]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop,
      accept: {
        "text/csv": [".csv"],
        "text/plain": [".txt", ".csv"],
      },
      maxFiles,
      disabled,
      maxSize: validationOptions.maxFileSize || 50 * 1024 * 1024, // 50MB default
    });

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const retryValidation = useCallback(
    async (index: number) => {
      const fileState = files[index];
      if (!fileState || fileState.status === "validating") return;

      try {
        setFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? { ...f, status: "validating", progress: 0, error: "" }
              : f
          )
        );

        const result = await validator.validateFile(fileState.file);

        setFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? {
                  ...f,
                  status: "completed",
                  progress: 100,
                  result,
                }
              : f
          )
        );

        onValidationComplete?.(result, fileState.file);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Validation failed";

        setFiles((prev) =>
          prev.map((f, i) =>
            i === index
              ? {
                  ...f,
                  status: "error",
                  error: errorMessage,
                }
              : f
          )
        );

        onError?.(errorMessage);
      }
    },
    [files, onError, onValidationComplete, validator]
  );

  const exportCleanedData = useCallback(
    (index: number) => {
      const fileState = files[index];
      if (!fileState?.result?.cleanedData) return;

      // Convert cleaned data back to CSV
      const headers = fileState.result.metadata.headers;
      const csvContent = [
        headers.join(","),
        ...fileState.result.cleanedData.map((row) =>
          headers
            .map((header) => {
              const value = row[header] || "";
              // Escape quotes and wrap in quotes if contains comma
              const escaped = String(value).replace(/"/g, '""');
              return escaped.includes(",") ? `"${escaped}"` : escaped;
            })
            .join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `cleaned_${fileState.file.name}`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    },
    [files]
  );

  const formatFileSize = (bytes: number): string => {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Upload Area */}
      <Card>
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
            isDragActive && !isDragReject && "border-primary bg-primary/5",
            isDragReject && "border-red-500 bg-red-50",
            disabled && "cursor-not-allowed opacity-50",
            files.length === 0 && "border-muted"
          )}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-muted">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>

            <div>
              <h3 className="text-lg font-medium">
                {isDragActive
                  ? isDragReject
                    ? "Invalid file type"
                    : "Drop CSV files here"
                  : "Upload CSV Files"}
              </h3>
              <p className="text-muted-foreground mt-1">
                {isDragActive
                  ? "Release to upload"
                  : `Drag and drop CSV files here, or click to select (max ${maxFiles} file${
                      maxFiles !== 1 ? "s" : ""
                    })`}
              </p>
            </div>

            {validationOptions.maxFileSize && (
              <Badge variant="outline">
                Max size: {formatFileSize(validationOptions.maxFileSize)}
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {/* File Validation Results */}
      {files.length > 0 && (
        <div className="space-y-4">
          {files.map((fileState, index) => (
            <Card
              key={`${
                fileState.originalMetadata?.name || fileState.file.name
              }-${index}`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">
                        {fileState.originalMetadata?.name ||
                          fileState.file.name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(
                          fileState.originalMetadata?.size ||
                            fileState.file.size
                        )}{" "}
                        •{" "}
                        {fileState.originalMetadata?.type ||
                          fileState.file.type ||
                          "text/csv"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {fileState.status === "completed" && (
                      <>
                        {fileState.result?.cleanedData && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => exportCleanedData(index)}
                            className="gap-2"
                          >
                            <Download className="h-4 w-4" />
                            Export Cleaned
                          </Button>
                        )}
                        <Badge className="bg-accent/10 text-accent border border-accent">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Validated
                        </Badge>
                      </>
                    )}

                    {fileState.status === "validating" && (
                      <Badge className="bg-blue-100 text-blue-800">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Validating
                      </Badge>
                    )}

                    {fileState.status === "error" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => retryValidation(index)}
                          className="gap-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Retry
                        </Button>
                        <Badge variant="destructive">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Error
                        </Badge>
                      </>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {fileState.status === "validating" && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">
                        Validation Progress
                      </span>
                      <span className="text-sm font-medium">
                        {fileState.progress}%
                      </span>
                    </div>
                    <Progress value={fileState.progress} className="h-2" />
                  </div>
                )}
              </CardHeader>

              {fileState.status === "error" && fileState.error && (
                <CardContent className="pt-0">
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{fileState.error}</AlertDescription>
                  </Alert>
                </CardContent>
              )}

              {fileState.status === "completed" && fileState.result && (
                <CardContent className="pt-0">
                  <CSVValidatorDisplay
                    validationResult={fileState.result}
                    onRetry={() => retryValidation(index)}
                    onExportCleaned={() => exportCleanedData(index)}
                  />
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Configuration Info */}
      {files.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Validation Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">File Limits</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Max files: {maxFiles}</li>
                  <li>
                    • Max size:{" "}
                    {formatFileSize(
                      validationOptions.maxFileSize || 50 * 1024 * 1024
                    )}
                  </li>
                  <li>
                    • Max rows:{" "}
                    {(validationOptions.maxRows || 100000).toLocaleString()}
                  </li>
                  <li>• Max columns: {validationOptions.maxColumns || 100}</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">Validation Features</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Structure validation</li>
                  <li>• Data type detection</li>
                  <li>• Quality analysis</li>
                  <li>• Schema optimization</li>
                </ul>
              </div>
            </div>

            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Files are processed entirely client-side. No data is sent to
                external servers during validation.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
