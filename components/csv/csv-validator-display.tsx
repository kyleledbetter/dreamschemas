"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  FileText,
  Zap,
  Download,
  Eye,
  Settings,
  RefreshCw,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import type {
  CSVValidationResult,
  CSVValidationError,
} from "@/lib/csv/validator";

interface CSVValidatorDisplayProps {
  validationResult: CSVValidationResult;
  onRetry?: () => void;
  onApplyFixes?: (errors: CSVValidationError[]) => void;
  onExportCleaned?: () => void;
  onViewRawData?: () => void;
  className?: string;
}

export function CSVValidatorDisplay({
  validationResult,
  onRetry,
  onApplyFixes,
  onExportCleaned,
  onViewRawData,
  className = "",
}: CSVValidatorDisplayProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["summary"])
  );
  const [activeTab, setActiveTab] = useState("overview");

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const { metadata, errors, warnings, suggestions } = validationResult;

  const getStatusColor = () => {
    if (errors.length > 0) return "text-red-600";
    if (warnings.length > 0) return "text-yellow-600";
    return "text-green-600";
  };

  const getStatusIcon = () => {
    if (errors.length > 0)
      return <AlertCircle className="h-5 w-5 text-red-600" />;
    if (warnings.length > 0)
      return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    return <CheckCircle2 className="h-5 w-5 text-green-600" />;
  };

  const getStatusText = () => {
    if (errors.length > 0) return "Validation Failed";
    if (warnings.length > 0) return "Validation Passed with Warnings";
    return "Validation Passed";
  };

  const autoFixableErrors = [...errors, ...warnings].filter(
    (e) => e.autoFixable
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

  const getQualityScore = (): number => {
    const totalIssues = errors.length + warnings.length;
    const maxScore = 100;
    const deduction = Math.min(totalIssues * 5, 80); // Max 80% deduction
    return Math.max(maxScore - deduction, 20);
  };

  const renderErrorList = (
    errorList: CSVValidationError[],
    type: "error" | "warning" | "info"
  ) => {
    if (errorList.length === 0) return null;

    const typeConfig = {
      error: {
        icon: AlertCircle,
        color: "text-destructive",
        bg: "bg-destructive/10",
        border: "border-destructive/20",
      },
      warning: {
        icon: AlertTriangle,
        color: "text-warning",
        bg: "bg-warning/10",
        border: "border-warning/20",
      },
      info: {
        icon: Info,
        color: "text-info",
        bg: "bg-info/10",
        border: "border-info/20",
      },
    };

    const config = typeConfig[type];
    const Icon = config.icon;

    return (
      <div className="space-y-2">
        {errorList.map((error, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg border ${config.bg} ${config.border}`}
          >
            <div className="flex items-start gap-3">
              <Icon className={`h-4 w-4 mt-0.5 ${config.color}`} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{error.message}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {error.code}
                      </Badge>
                      {error.row && <span>Row {error.row}</span>}
                      {error.column && <span>Column: {error.column}</span>}
                    </div>
                  </div>
                  {error.autoFixable && (
                    <Badge className="bg-green-100 text-green-800">
                      Auto-fixable
                    </Badge>
                  )}
                </div>
                {error.suggestion && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    💡 {error.suggestion}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Validation Status Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <CardTitle className={getStatusColor()}>
                  {getStatusText()}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  CSV validation completed with {errors.length} error
                  {errors.length !== 1 ? "s" : ""}, {warnings.length} warning
                  {warnings.length !== 1 ? "s" : ""}, and {suggestions.length}{" "}
                  suggestion{suggestions.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {autoFixableErrors.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onApplyFixes?.(autoFixableErrors)}
                  className="gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Apply {autoFixableErrors.length} Fix
                  {autoFixableErrors.length !== 1 ? "es" : ""}
                </Button>
              )}

              {validationResult.cleanedData && onExportCleaned && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExportCleaned}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Export Cleaned
                </Button>
              )}

              {onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
              )}
            </div>
          </div>

          {/* Quality Score */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Data Quality Score</span>
              <span className="text-sm font-bold">{getQualityScore()}%</span>
            </div>
            <Progress value={getQualityScore()} className="h-2" />
          </div>
        </CardHeader>
      </Card>

      {/* Detailed Validation Results */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="errors" className="relative">
            Errors
            {errors.length > 0 && (
              <Badge className="ml-2 bg-red-600 text-white text-xs">
                {errors.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="warnings" className="relative">
            Warnings
            {warnings.length > 0 && (
              <Badge className="ml-2 bg-yellow-600 text-white text-xs">
                {warnings.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="relative">
            Suggestions
            {suggestions.length > 0 && (
              <Badge className="ml-2 bg-blue-600 text-white text-xs">
                {suggestions.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* File Metadata */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  File Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">File Size:</span>
                    <p className="font-medium">
                      {formatFileSize(metadata.fileSize)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Encoding:</span>
                    <p className="font-medium">{metadata.encoding}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Delimiter:</span>
                    <p className="font-medium">
                      &quot;{metadata.delimiter}&quot;
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Has Headers:</span>
                    <p className="font-medium">
                      {metadata.hasHeaders ? "Yes" : "No"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Data Structure */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Data Structure
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Rows:</span>
                    <p className="font-medium">
                      {metadata.totalRows.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      Total Columns:
                    </span>
                    <p className="font-medium">{metadata.totalColumns}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Empty Rows:</span>
                    <p className="font-medium">{metadata.emptyRows}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      Duplicate Headers:
                    </span>
                    <p className="font-medium">
                      {metadata.duplicateHeaders.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Column Information */}
            <Card className="md:col-span-2">
              <Collapsible
                open={expandedSections.has("columns")}
                onOpenChange={() => toggleSection("columns")}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 py-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      Column Details ({metadata.headers.length})
                      <Button variant="ghost" size="sm">
                        {expandedSections.has("columns") ? (
                          <X className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {metadata.headers.map((header, index) => (
                        <div
                          key={index}
                          className="p-3 border rounded-lg bg-muted/30"
                        >
                          <div className="font-medium text-sm">{header}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {metadata.estimatedTypes[header] || "TEXT"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {/* Data Preview */}
            <Card className="md:col-span-2">
              <Collapsible
                open={expandedSections.has("preview")}
                onOpenChange={() => toggleSection("preview")}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 py-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      Data Preview (First 10 rows)
                      <Button variant="ghost" size="sm">
                        {expandedSections.has("preview") ? (
                          <X className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-2">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b">
                            {metadata.headers.map((header, index) => (
                              <th
                                key={index}
                                className="text-left p-2 font-medium bg-muted/50"
                              >
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {validationResult.sampleData
                            .slice(0, 5)
                            .map((row, rowIndex) => (
                              <tr key={rowIndex} className="border-b">
                                {metadata.headers.map((header, colIndex) => (
                                  <td
                                    key={colIndex}
                                    className="p-2 max-w-[200px] truncate"
                                    title={String(row[header] || "")}
                                  >
                                    {String(row[header] || "")}
                                  </td>
                                ))}
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    {onViewRawData && (
                      <div className="mt-4 text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onViewRawData}
                        >
                          View Full Data
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Validation Errors ({errors.length})
              </CardTitle>
              {errors.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  These issues must be resolved before proceeding with schema
                  generation.
                </p>
              )}
            </CardHeader>
            <CardContent>
              {errors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-600" />
                  No validation errors found! Your CSV file is structurally
                  valid.
                </div>
              ) : (
                renderErrorList(errors, "error")
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warnings">
          <Card>
            <CardHeader>
              <CardTitle className="text-yellow-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Warnings ({warnings.length})
              </CardTitle>
              {warnings.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  These issues may affect data quality but won&apos;t prevent
                  schema generation.
                </p>
              )}
            </CardHeader>
            <CardContent>
              {warnings.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-600" />
                  No warnings found! Your data quality looks good.
                </div>
              ) : (
                renderErrorList(warnings, "warning")
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions">
          <Card>
            <CardHeader>
              <CardTitle className="text-blue-600 flex items-center gap-2">
                <Info className="h-5 w-5" />
                Optimization Suggestions ({suggestions.length})
              </CardTitle>
              {suggestions.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  These recommendations can help optimize your database schema.
                </p>
              )}
            </CardHeader>
            <CardContent>
              {suggestions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-blue-600" />
                  No additional optimizations suggested. Your schema looks
                  well-structured!
                </div>
              ) : (
                renderErrorList(suggestions, "info")
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
