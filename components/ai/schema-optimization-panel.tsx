"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  OptimizationSuggestion,
  SchemaOptimizationResult,
} from "@/lib/ai/schema-optimizer";
import { cn } from "@/lib/utils";
import {
  ArrowRightIcon,
  Brain,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  Info,
  RefreshCw,
  Settings,
  Shield,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useCallback, useState } from "react";

interface SchemaOptimizationPanelProps {
  optimizationResult?: SchemaOptimizationResult;
  isLoading?: boolean;
  onApplySuggestion?: (suggestion: OptimizationSuggestion) => void;
  onApplyAllAutoSuggestions?: () => void;
  onRefineSchema?: (feedback: string) => void;
  onExportOptimized?: () => void;
  className?: string;
}

export function SchemaOptimizationPanel({
  optimizationResult,
  isLoading = false,
  onApplySuggestion,
  onApplyAllAutoSuggestions,
  onRefineSchema,
  onExportOptimized,
  className = "",
}: SchemaOptimizationPanelProps) {
  const [expandedSuggestions, setExpandedSuggestions] = useState<Set<string>>(
    new Set()
  );
  const [showCode, setShowCode] = useState<Set<string>>(new Set());
  const [refinementFeedback, setRefinementFeedback] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(
    new Set()
  );

  const toggleSuggestionExpansion = useCallback((suggestionId: string) => {
    setExpandedSuggestions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(suggestionId)) {
        newSet.delete(suggestionId);
      } else {
        newSet.add(suggestionId);
      }
      return newSet;
    });
  }, []);

  const toggleCode = useCallback((suggestionId: string) => {
    setShowCode((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(suggestionId)) {
        newSet.delete(suggestionId);
      } else {
        newSet.add(suggestionId);
      }
      return newSet;
    });
  }, []);

  const handleApplySuggestion = useCallback(
    (suggestion: OptimizationSuggestion) => {
      setAppliedSuggestions((prev) => new Set([...prev, suggestion.id]));
      onApplySuggestion?.(suggestion);
    },
    [onApplySuggestion]
  );

  const getTypeIcon = (type: OptimizationSuggestion["type"]) => {
    const icons = {
      performance: TrendingUp,
      normalization: Database,
      "data-quality": CheckCircle2,
      security: Shield,
      "best-practice": Target,
    };
    return icons[type] || Info;
  };

  const getTypeColor = (type: OptimizationSuggestion["type"]) => {
    const colors = {
      performance: "text-blue-600",
      normalization: "text-purple-600",
      "data-quality": "text-green-600",
      security: "text-red-600",
      "best-practice": "text-orange-600",
    };
    return colors[type] || "text-gray-600";
  };

  const getPriorityColor = (priority: OptimizationSuggestion["priority"]) => {
    const colors = {
      critical: "bg-red-600 text-white",
      high: "bg-orange-600 text-white",
      medium: "bg-yellow-600 text-white",
      low: "bg-gray-600 text-white",
    };
    return colors[priority];
  };

  const getEffortColor = (effort: OptimizationSuggestion["effort"]) => {
    const colors = {
      high: "text-red-600",
      medium: "text-yellow-600",
      low: "text-green-600",
    };
    return colors[effort];
  };

  const filterSuggestionsByType = (type: OptimizationSuggestion["type"]) => {
    return optimizationResult?.suggestions.filter((s) => s.type === type) || [];
  };

  const renderSuggestionCard = (suggestion: OptimizationSuggestion) => {
    const Icon = getTypeIcon(suggestion.type);
    const isExpanded = expandedSuggestions.has(suggestion.id);
    const showingCode = showCode.has(suggestion.id);
    const isApplied = appliedSuggestions.has(suggestion.id);

    return (
      <Card
        key={suggestion.id}
        className={cn("transition-all", isApplied && "opacity-60")}
      >
        <Collapsible
          open={isExpanded}
          onOpenChange={() => toggleSuggestionExpansion(suggestion.id)}
        >
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <Icon
                    className={cn(
                      "h-5 w-5 mt-1",
                      getTypeColor(suggestion.type)
                    )}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-base">
                        {suggestion.title}
                      </CardTitle>
                      <Badge className={getPriorityColor(suggestion.priority)}>
                        {suggestion.priority}
                      </Badge>
                      {suggestion.autoApplicable && (
                        <Badge className="bg-green-100 text-green-800">
                          <Zap className="h-3 w-3 mr-1" />
                          Auto-fix
                        </Badge>
                      )}
                      {isApplied && (
                        <Badge className="bg-blue-100 text-blue-800">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Applied
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {suggestion.description}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Impact: {suggestion.impact}</span>
                      <span className={getEffortColor(suggestion.effort)}>
                        Effort: {suggestion.effort}
                      </span>
                      <span>
                        Confidence: {Math.round(suggestion.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {suggestion.code && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCode(suggestion.id);
                      }}
                      className="gap-2"
                    >
                      {showingCode ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      Code
                    </Button>
                  )}

                  {!isApplied && (
                    <Button
                      variant={
                        suggestion.autoApplicable ? "default" : "outline"
                      }
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApplySuggestion(suggestion);
                      }}
                      className="gap-2"
                    >
                      {suggestion.autoApplicable ? (
                        <>
                          <Zap className="h-4 w-4" />
                          Apply
                        </>
                      ) : (
                        <>
                          <Settings className="h-4 w-4" />
                          Review
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-4">
                {/* Technical Details */}
                <div className="p-3 bg-muted/30 rounded-lg">
                  <h4 className="font-medium text-sm mb-2">
                    Technical Details
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Reasoning:</span>
                      <p className="text-muted-foreground mt-1">
                        {suggestion.technicalDetails.reasoning}
                      </p>
                    </div>
                    <div>
                      <span className="font-medium">Implementation:</span>
                      <p className="text-muted-foreground mt-1">
                        {suggestion.technicalDetails.implementation}
                      </p>
                    </div>
                    {suggestion.technicalDetails.relatedTables && (
                      <div>
                        <span className="font-medium">Related Tables:</span>
                        <div className="flex gap-1 mt-1">
                          {suggestion.technicalDetails.relatedTables.map(
                            (table) => (
                              <Badge key={table} variant="outline">
                                {table}
                              </Badge>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Performance Impact */}
                {suggestion.technicalDetails.estimatedImpact && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <h4 className="font-medium text-sm mb-3">
                      Estimated Impact
                    </h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Performance</span>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Math.abs(
                              suggestion.technicalDetails.estimatedImpact
                                .performance
                            )}
                            className="w-20 h-2"
                          />
                          <span className="text-xs">
                            {suggestion.technicalDetails.estimatedImpact
                              .performance > 0
                              ? "+"
                              : ""}
                            {
                              suggestion.technicalDetails.estimatedImpact
                                .performance
                            }
                            %
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Storage</span>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Math.abs(
                              suggestion.technicalDetails.estimatedImpact
                                .storage
                            )}
                            className="w-20 h-2"
                          />
                          <span className="text-xs">
                            {suggestion.technicalDetails.estimatedImpact
                              .storage > 0
                              ? "+"
                              : ""}
                            {
                              suggestion.technicalDetails.estimatedImpact
                                .storage
                            }
                            %
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Maintenance</span>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Math.abs(
                              suggestion.technicalDetails.estimatedImpact
                                .maintenance
                            )}
                            className="w-20 h-2"
                          />
                          <span className="text-xs">
                            {suggestion.technicalDetails.estimatedImpact
                              .maintenance > 0
                              ? "+"
                              : ""}
                            {
                              suggestion.technicalDetails.estimatedImpact
                                .maintenance
                            }
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Code Display */}
                {suggestion.code && showingCode && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <h4 className="font-medium text-sm mb-2">
                      Implementation Code
                    </h4>
                    <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">
                      <code>{suggestion.code.sql}</code>
                    </pre>
                    <p className="text-xs text-muted-foreground mt-2">
                      {suggestion.code.explanation}
                    </p>
                  </div>
                )}

                {/* Before/After */}
                {suggestion.technicalDetails.beforeAfter && (
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <h4 className="font-medium text-sm mb-2">Before / After</h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="font-medium text-red-600">
                          Before:
                        </span>
                        <pre className="bg-red-50 p-2 rounded mt-1">
                          {suggestion.technicalDetails.beforeAfter.before}
                        </pre>
                      </div>
                      <div>
                        <span className="font-medium text-green-600">
                          After:
                        </span>
                        <pre className="bg-green-50 p-2 rounded mt-1">
                          {suggestion.technicalDetails.beforeAfter.after}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="text-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Analyzing schema with AI...</p>
        </CardContent>
      </Card>
    );
  }

  if (!optimizationResult) {
    return (
      <Card className={className}>
        <CardContent className="text-center py-8">
          <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-medium mb-2">AI Schema Optimization</h3>
          <p className="text-muted-foreground">
            Upload CSV files to get AI-powered schema optimization suggestions.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { summary, suggestions, aiAnalysis } = optimizationResult;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Optimization Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="size-5" />
                  AI Schema Optimization
                  <Badge className="bg-green-100 text-green-800">
                    {summary.confidenceScore}% Confidence
                  </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  AI-powered analysis found {summary.totalSuggestions}{" "}
                  optimization opportunities
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {summary.autoApplicableCount > 0 && (
                <Button onClick={onApplyAllAutoSuggestions} className="gap-2">
                  <Zap className="h-4 w-4" />
                  Apply {summary.autoApplicableCount} Auto-fixes
                </Button>
              )}

              {onExportOptimized && (
                <Button
                  variant="default"
                  onClick={onExportOptimized}
                  className="gap-2"
                >
                  Proceed
                  <ArrowRightIcon className="size-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Summary Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-green-600">
                {summary.estimatedPerformanceGain}%
              </p>
              <p className="text-xs text-muted-foreground">Performance Gain</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">
                {summary.totalSuggestions}
              </p>
              <p className="text-xs text-muted-foreground">Total Suggestions</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">
                {summary.criticalIssues}
              </p>
              <p className="text-xs text-muted-foreground">Critical Issues</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">
                {summary.autoApplicableCount}
              </p>
              <p className="text-xs text-muted-foreground">Auto-fixable</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Optimization Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance" className="relative">
            Performance
            {filterSuggestionsByType("performance").length > 0 && (
              <Badge className="ml-1 bg-blue-600 text-white text-xs">
                {filterSuggestionsByType("performance").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="security" className="relative">
            Security
            {filterSuggestionsByType("security").length > 0 && (
              <Badge className="ml-1 bg-red-600 text-white text-xs">
                {filterSuggestionsByType("security").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="quality" className="relative">
            Quality
            {filterSuggestionsByType("data-quality").length > 0 && (
              <Badge className="ml-1 bg-green-600 text-white text-xs">
                {filterSuggestionsByType("data-quality").length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="structure" className="relative">
            Structure
            {filterSuggestionsByType("normalization").length > 0 && (
              <Badge className="ml-1 bg-purple-600 text-white text-xs">
                {filterSuggestionsByType("normalization").length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-4">
            {/* AI Analysis Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">AI Analysis Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm">{aiAnalysis.reasoning}</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-sm mb-2">
                        Generated Tables
                      </h4>
                      <div className="space-y-1">
                        {aiAnalysis.tables.map((table, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Database className="size-4 text-primary" />
                            <span>{table.name}</span>
                            <Badge
                              variant="outline"
                              className="bg-primary/10 text-primary"
                            >
                              {table.columns.length} columns
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">
                            Refine Schema with AI
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Describe any changes you&apos;d like to make to the
                            schema, and AI will help refine it.
                          </p>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <textarea
                              className="w-full p-3 border rounded-lg resize-none"
                              rows={4}
                              placeholder="E.g., 'Add a user roles system', 'Make email addresses case-insensitive', 'Add soft delete functionality'..."
                              value={refinementFeedback}
                              onChange={(e) =>
                                setRefinementFeedback(e.target.value)
                              }
                            />

                            <div className="flex justify-between items-center">
                              <p className="text-xs text-muted-foreground">
                                💡 Be specific about your requirements for best
                                results
                              </p>
                              <Button
                                onClick={() => {
                                  onRefineSchema?.(refinementFeedback);
                                  setRefinementFeedback("");
                                }}
                                disabled={!refinementFeedback.trim()}
                                className="gap-2"
                              >
                                <Brain className="h-4 w-4" />
                                Refine Schema
                              </Button>
                            </div>

                            <Alert>
                              <Info className="h-4 w-4" />
                              <AlertDescription>
                                AI refinement will analyze your feedback and
                                suggest specific changes to improve the schema.
                              </AlertDescription>
                            </Alert>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Top Priority Suggestions */}
            {suggestions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Top Priority Suggestions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {suggestions
                      .filter(
                        (s) =>
                          s.priority === "critical" || s.priority === "high"
                      )
                      .slice(0, 3)
                      .map(renderSuggestionCard)}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="performance">
          <div className="space-y-4">
            {filterSuggestionsByType("performance").map(renderSuggestionCard)}
            {filterSuggestionsByType("performance").length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No performance optimizations suggested.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="security">
          <div className="space-y-4">
            {filterSuggestionsByType("security").map(renderSuggestionCard)}
            {filterSuggestionsByType("security").length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No security improvements suggested.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="quality">
          <div className="space-y-4">
            {filterSuggestionsByType("data-quality").map(renderSuggestionCard)}
            {filterSuggestionsByType("data-quality").length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No data quality issues found.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="structure">
          <div className="space-y-4">
            {[
              ...filterSuggestionsByType("normalization"),
              ...filterSuggestionsByType("best-practice"),
            ].map(renderSuggestionCard)}
            {filterSuggestionsByType("normalization").length === 0 &&
              filterSuggestionsByType("best-practice").length === 0 && (
                <Card>
                  <CardContent className="text-center py-8">
                    <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      Schema structure looks good!
                    </p>
                  </CardContent>
                </Card>
              )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
