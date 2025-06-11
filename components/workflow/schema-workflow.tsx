"use client";

import React, { useState, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import {
  Upload,
  Brain,
  Eye,
  Download,
  Cloud,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Settings,
  RotateCcw,
  Save,
  Share2,
  AlertCircle,
  Info,
  Play,
  FileText,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

// Import our feature components
import { EnhancedCSVDropzone } from "@/components/csv/enhanced-csv-dropzone";
import { SchemaOptimizationPanel } from "@/components/ai/schema-optimization-panel";
import { VisualSchemaEditor } from "@/components/schema/visual-schema-editor";
import { ExportManagerUI } from "@/components/export/export-manager-ui";
import { ProjectSelector } from "@/components/supabase/project-selector";
import { MigrationDeployer } from "@/components/supabase/migration-deployer";
import { FeedbackManager } from "@/components/feedback/feedback-manager";

// Import types and utilities
import type { CSVValidationResult } from "@/lib/csv/validator";
import type {
  DatabaseSchema,
  Table,
  Column,
  PostgresType,
  ColumnConstraint,
  ConstraintType,
} from "@/types/schema.types";
import type { SchemaOptimizationResult } from "@/lib/ai/schema-optimizer";
import type {
  DeploymentResult,
  SupabaseProject,
} from "@/lib/supabase/management";
import { generateId } from "@/lib/utils";
import type { WorkflowState as OAuthWorkflowState } from "@/lib/workflow/state-manager";

interface SchemaWorkflowProps {
  user: User;
}

type WorkflowStep =
  | "upload"
  | "analyze"
  | "optimize"
  | "design"
  | "export"
  | "deploy";

interface WorkflowState {
  currentStep: WorkflowStep;
  csvResults: CSVValidationResult[];
  generatedSchema?: DatabaseSchema | undefined;
  optimizationResult?: SchemaOptimizationResult | undefined;
  isProcessing: boolean;
  completedSteps: Set<WorkflowStep>;
  error?: string | undefined;
  projectData?:
    | {
        projectId: string;
        projectName: string;
        dbUrl: string;
      }
    | undefined;
  analysisProgress?: {
    currentStage: string;
    currentProgress: number;
    stages: Array<{ name: string; weight: number }>;
  };
}

// Add type interfaces for the API response
interface AIAnalysisTable {
  name: string;
  comment?: string;
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    length?: number;
    precision?: number;
    scale?: number;
    defaultValue?: string;
    constraints: string[];
    reasoning?: string;
  }>;
  indexes: Array<{
    name: string;
    columns: string[];
    unique: boolean;
  }>;
}

// Remove unused type
// interface AIAnalysisResponse {
//   analysis: AIAnalysisResult;
// }

const WORKFLOW_STEPS: Array<{
  id: WorkflowStep;
  title: string;
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  estimatedTime: string;
}> = [
  {
    id: "upload",
    title: "Upload CSV Files",
    description: "Upload and validate your CSV data files",
    icon: Upload,
    estimatedTime: "2-3 min",
  },
  {
    id: "analyze",
    title: "AI Analysis",
    description: "AI analyzes your data to generate optimal schema",
    icon: Brain,
    estimatedTime: "3-5 min",
  },
  {
    id: "optimize",
    title: "Optimize Schema",
    description: "Review and apply AI optimization suggestions",
    icon: Sparkles,
    estimatedTime: "5-10 min",
  },
  {
    id: "design",
    title: "Visual Design",
    description: "Fine-tune your schema with visual editor",
    icon: Eye,
    estimatedTime: "10-15 min",
  },
  {
    id: "export",
    title: "Export & Review",
    description: "Export schema to multiple formats",
    icon: Download,
    estimatedTime: "2-3 min",
  },
  {
    id: "deploy",
    title: "Deploy to Supabase",
    description: "Deploy your schema to Supabase project",
    icon: Cloud,
    estimatedTime: "3-5 min",
  },
];

// Add PostgreSQL type mapping
const mapToPostgresType = (type: string): PostgresType => {
  const typeMap: Record<string, PostgresType> = {
    text: "TEXT",
    varchar: "VARCHAR",
    integer: "INTEGER",
    bigint: "BIGINT",
    numeric: "NUMERIC",
    boolean: "BOOLEAN",
    timestamp: "TIMESTAMP",
    date: "DATE",
    time: "TIME",
    json: "JSON",
    jsonb: "JSONB",
    // Add more mappings as needed
  };

  return typeMap[type.toLowerCase()] || "TEXT";
};

// Add constraint type mapping
const mapToConstraintType = (constraint: string): ConstraintType => {
  const constraintMap: Record<string, ConstraintType> = {
    primary_key: "PRIMARY KEY",
    foreign_key: "FOREIGN KEY",
    unique: "UNIQUE",
    not_null: "NOT NULL",
    check: "CHECK",
    default: "DEFAULT",
    // Add more mappings as needed
  };

  return constraintMap[constraint.toLowerCase()] || "CHECK";
};

export function SchemaWorkflow({ user }: SchemaWorkflowProps) {
  const [state, setState] = useState<WorkflowState>({
    currentStep: "upload",
    csvResults: [],
    isProcessing: false,
    completedSteps: new Set(),
  });

  const [showWelcome, setShowWelcome] = useState(true);
  const [activeTab, setActiveTab] = useState("workflow");

  // Calculate overall progress
  const overallProgress =
    (state.completedSteps.size / WORKFLOW_STEPS.length) * 100;

  const updateState = useCallback((updates: Partial<WorkflowState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const markStepComplete = useCallback((step: WorkflowStep) => {
    setState((prev) => ({
      ...prev,
      completedSteps: new Set([...prev.completedSteps, step]),
    }));
  }, []);

  const goToStep = useCallback(
    (step: WorkflowStep) => {
      updateState({ currentStep: step });
    },
    [updateState]
  );

  const nextStep = useCallback(() => {
    const currentIndex = WORKFLOW_STEPS.findIndex(
      (s) => s.id === state.currentStep
    );
    if (currentIndex < WORKFLOW_STEPS.length - 1) {
      const nextStepId = WORKFLOW_STEPS[currentIndex + 1].id;
      goToStep(nextStepId);
    }
  }, [state.currentStep, goToStep]);

  // Handle CSV validation completion
  const handleCSVValidation = useCallback(
    (result: CSVValidationResult) => {
      setState((prev) => ({
        ...prev,
        csvResults: [...prev.csvResults, result],
      }));

      // Auto-advance if this is the first successful validation
      if (state.csvResults.length === 0 && result.isValid) {
        markStepComplete("upload");
        setTimeout(() => nextStep(), 1000);
      }
    },
    [state.csvResults.length, markStepComplete, nextStep]
  );

  // Convert CSV validation results to API format
  const convertToAPIFormat = useCallback(
    (csvResults: CSVValidationResult[]) => {
      return csvResults.map((result) => ({
        id: generateId(),
        fileName: "uploaded_file.csv",
        headers: result.metadata.headers,
        data: result.sampleData.map((row) =>
          result.metadata.headers.map((header) => row[header] || null)
        ),
        totalRows: result.metadata.totalRows,
        sampledRows: result.sampleData.length,
        columns: result.metadata.headers.map((header) => ({
          index: result.metadata.headers.indexOf(header),
          name: header,
          originalName: header,
          sampleValues: result.sampleData
            .slice(0, 5)
            .map((row) => row[header] || null),
          uniqueValues: new Set(
            result.sampleData.map((row) => row[header]).filter(Boolean)
          ),
          nullCount: result.sampleData.filter((row) => !row[header]).length,
          emptyCount: result.sampleData.filter((row) => row[header] === "")
            .length,
          totalCount: result.sampleData.length,
          inferredType: result.metadata.estimatedTypes[header] || "TEXT",
        })),
        config: {
          hasHeader: true,
          skipEmptyLines: true,
          trimWhitespace: true,
        },
        parseErrors: [],
        timestamp: new Date(),
      }));
    },
    []
  );

  // Perform actual AI analysis
  const performAIAnalysis = useCallback(async () => {
    if (!state.csvResults.some((result) => result.isValid)) {
      updateState({ error: "Please upload and validate CSV files first" });
      return;
    }

    updateState({ isProcessing: true, error: undefined });

    try {
      const csvParseResults = convertToAPIFormat(state.csvResults);

      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          csvResults: csvParseResults,
          options: {
            includeOptimizations: true,
            targetUseCase: "web-app",
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || errorData.message || "Analysis failed"
        );
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("Failed to initialize stream reader");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));

              switch (event.type) {
                case "metadata":
                  console.log("Analysis metadata:", event.data);
                  break;

                case "progress":
                  updateState({
                    analysisProgress: {
                      currentStage: event.data.stage,
                      currentProgress: event.data.progress,
                      stages: state.analysisProgress?.stages || [],
                    },
                  });
                  break;

                case "complete":
                  if (event.data.success) {
                    const { analysis, metadata } = event.data;

                    // Convert AI analysis to DatabaseSchema format
                    const generatedSchema: DatabaseSchema = {
                      id: generateId(),
                      name: "AI Generated Schema",
                      version: "1.0.0",
                      createdAt: new Date(),
                      updatedAt: new Date(),
                      tables: analysis.tables.map(
                        (table: AIAnalysisTable): Table => ({
                          id: generateId(),
                          name: table.name,
                          comment: table.comment || "",
                          position: { x: 0, y: 0 },
                          columns: table.columns.map(
                            (col): Column => ({
                              id: generateId(),
                              name: col.name,
                              type: mapToPostgresType(col.type),
                              nullable: col.nullable,
                              length: col.length || 0,
                              precision: col.precision || 0,
                              scale: col.scale || 0,
                              defaultValue: col.defaultValue || "",
                              constraints: col.constraints.map(
                                (c): ColumnConstraint => ({
                                  type: mapToConstraintType(c),
                                })
                              ),
                              comment: col.reasoning || "",
                            })
                          ),
                          indexes: table.indexes.map((idx) => ({
                            id: generateId(),
                            name: idx.name,
                            columns: idx.columns,
                            unique: idx.unique,
                          })),
                        })
                      ),
                      relationships: [],
                      rlsPolicies: [],
                    };

                    // Initialize optimization result with the generated schema
                    const optimizationResult: SchemaOptimizationResult = {
                      originalSchema: generatedSchema,
                      optimizedSchema: generatedSchema,
                      suggestions: [],
                      summary: {
                        totalSuggestions: 0,
                        criticalIssues: 0,
                        autoApplicableCount: 0,
                        estimatedPerformanceGain: 0,
                        confidenceScore: metadata?.confidence || 85,
                      },
                      aiAnalysis: {
                        reasoning:
                          "Initial schema generated successfully. Ready for optimization.",
                        suggestions: [],
                        tables: generatedSchema.tables.map((table) => ({
                          name: table.name,
                          columns: table.columns.map((col) => ({
                            name: col.name,
                            type: col.type,
                            nullable: col.nullable,
                            length: col.length,
                            precision: col.precision,
                            scale: col.scale,
                            defaultValue: col.defaultValue,
                            constraints: col.constraints.map((c) => c.type),
                            reasoning:
                              col.comment ||
                              `Column ${col.name} of type ${col.type}`,
                          })),
                          relationships: [],
                          indexes: [],
                          comment: table.comment,
                          rlsPolicies: [],
                        })),
                        confidence: metadata?.confidence || 0.85,
                      },
                    };

                    updateState({
                      generatedSchema,
                      optimizationResult,
                      isProcessing: false,
                      analysisProgress: metadata.progress,
                    });

                    markStepComplete("analyze");
                    setTimeout(() => nextStep(), 1000);
                  }
                  break;

                case "error":
                  throw new Error(event.data.message || "Analysis failed");
              }
            } catch (e) {
              console.error("Error parsing SSE:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("AI analysis failed:", error);
      updateState({
        isProcessing: false,
        error:
          error instanceof Error
            ? error.message
            : "AI analysis failed. Please try again.",
      });
    }
  }, [
    state.csvResults,
    convertToAPIFormat,
    updateState,
    markStepComplete,
    nextStep,
  ]);

  // Handle AI analysis completion (keeping for potential manual schema input)
  // const handleSchemaGeneration = useCallback((schema: DatabaseSchema) => {
  //   updateState({ generatedSchema: schema });
  //   markStepComplete('analyze');
  //   setTimeout(() => nextStep(), 1000);
  // }, [updateState, markStepComplete, nextStep]);

  // Handle optimization completion
  const handleOptimization = useCallback(
    (result: SchemaOptimizationResult) => {
      updateState({ optimizationResult: result });
      markStepComplete("optimize");
    },
    [updateState, markStepComplete]
  );

  // Handle schema design completion
  const handleDesignComplete = useCallback(
    (schema: DatabaseSchema) => {
      updateState({ generatedSchema: schema });
      markStepComplete("design");
    },
    [updateState, markStepComplete]
  );

  // Handle export completion
  const handleExportComplete = useCallback(() => {
    markStepComplete("export");
  }, [markStepComplete]);

  // Handle deployment completion
  const handleDeployComplete = useCallback(
    (result: DeploymentResult) => {
      updateState({
        projectData: {
          projectId: result.projectId || "",
          projectName: result.projectName || "",
          dbUrl: result.dbUrl || "",
        },
      });
      markStepComplete("deploy");
    },
    [updateState, markStepComplete]
  );

  // Restart workflow
  const restartWorkflow = useCallback(() => {
    setState({
      currentStep: "upload",
      csvResults: [],
      generatedSchema: undefined,
      optimizationResult: undefined,
      isProcessing: false,
      completedSteps: new Set(),
      projectData: undefined,
    });
    setShowWelcome(false);
  }, []);

  const getStepStatus = (stepId: WorkflowStep) => {
    if (state.completedSteps.has(stepId)) return "completed";
    if (state.currentStep === stepId) return "current";
    return "pending";
  };

  // Add function to get workflow state for OAuth
  const getOAuthWorkflowState = (): Omit<
    OAuthWorkflowState,
    "id" | "timestamp"
  > => ({
    step: state.currentStep,
    data: {
      files: state.csvResults.map((result) => ({
        name: `data_${result.metadata.totalRows}.csv`,
        content: result.sampleData
          .map((row) =>
            result.metadata.headers.map((header) => row[header]).join(",")
          )
          .join("\n"),
        type: "text/csv",
      })),
      schema: state.generatedSchema ?? ({} as DatabaseSchema),
      options: {
        optimizationResult: state.optimizationResult,
      },
    },
    returnPath: window.location.pathname + window.location.search,
  });

  if (showWelcome) {
    return (
      <div className="flex-1 w-full max-w-4xl mx-auto p-6">
        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Welcome to Dreamschema</h1>
            <p className="text-xl text-muted-foreground">
              Transform your CSV files into production-ready Postgres schemas
              with AI
            </p>
          </div>

          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                What you can do with Dreamschema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">Upload multiple CSV files</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-purple-600" />
                    <span className="text-sm">
                      AI-powered schema generation
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Visual schema editing</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-orange-600" />
                    <span className="text-sm">Export to 15+ formats</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Cloud className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">Deploy to Supabase</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm">Performance optimization</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-center gap-4">
            <Button
              onClick={() => setShowWelcome(false)}
              size="lg"
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Start Building Schema
            </Button>
            <Button variant="outline" size="lg" className="gap-2">
              <FileText className="h-4 w-4" />
              View Examples
            </Button>
          </div>

          <Alert className="max-w-2xl mx-auto">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Your CSV data is processed entirely client-side. No data is sent
              to external servers during analysis.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Schema Builder</h1>
              <p className="text-muted-foreground">
                Welcome back, {user.email?.split("@")[0]}! Let&apos;s create
                something amazing.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium">
                  {overallProgress.toFixed(0)}% Complete
                </p>
                <Progress value={overallProgress} className="w-32 h-2" />
              </div>
              <Button
                variant="outline"
                onClick={restartWorkflow}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                New Project
              </Button>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {WORKFLOW_STEPS.map((step, index) => {
              const status = getStepStatus(step.id);
              const Icon = step.icon;

              return (
                <React.Fragment key={step.id}>
                  <Button
                    variant={
                      status === "current"
                        ? "default"
                        : status === "completed"
                        ? "secondary"
                        : "outline"
                    }
                    onClick={() => goToStep(step.id)}
                    disabled={
                      status === "pending" &&
                      !state.completedSteps.has(WORKFLOW_STEPS[index - 1]?.id)
                    }
                    className={cn(
                      "flex items-center gap-2 min-w-max",
                      status === "completed" &&
                        "text-green-700 border-green-200 bg-green-50"
                    )}
                  >
                    {status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">{step.title}</span>
                  </Button>

                  {index < WORKFLOW_STEPS.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="workflow">Workflow</TabsTrigger>
            <TabsTrigger value="overview">Project Overview</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="workflow" className="mt-6">
            {/* Current Step Content */}
            <div className="space-y-6">
              {state.currentStep === "upload" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      Upload CSV Files
                    </CardTitle>
                    <p className="text-muted-foreground">
                      Upload your CSV files to begin schema generation.
                      We&apos;ll validate and analyze your data.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <EnhancedCSVDropzone
                      onValidationComplete={handleCSVValidation}
                      maxFiles={5}
                      initialFiles={state.csvResults}
                    />
                  </CardContent>
                </Card>
              )}

              {state.currentStep === "analyze" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-5 w-5" />
                      AI Schema Analysis
                    </CardTitle>
                    <p className="text-muted-foreground">
                      AI is analyzing your CSV data to generate an optimized
                      PostgreSQL schema.
                    </p>
                  </CardHeader>
                  <CardContent>
                    {state.csvResults.length > 0 ? (
                      <div className="space-y-6">
                        {!state.isProcessing &&
                          !state.generatedSchema &&
                          !state.error && (
                            <div className="text-center py-8">
                              <Brain className="h-12 w-12 text-primary mx-auto mb-4" />
                              <h3 className="text-lg font-medium mb-2">
                                Ready to Analyze
                              </h3>
                              <p className="text-muted-foreground mb-4">
                                Click below to start AI-powered schema
                                generation from your uploaded CSV files.
                              </p>
                              <Button
                                onClick={performAIAnalysis}
                                className="gap-2"
                                size="lg"
                              >
                                <Sparkles className="h-4 w-4" />
                                Start AI Analysis
                              </Button>
                            </div>
                          )}

                        {state.isProcessing && (
                          <div className="text-center py-8">
                            <div className="flex flex-col items-center gap-4">
                              <div className="relative">
                                <Brain className="h-12 w-12 text-primary animate-pulse" />
                                <div className="absolute -inset-2 rounded-full border-2 border-primary/20 animate-spin border-t-primary"></div>
                              </div>
                              <div className="space-y-2">
                                <h3 className="text-lg font-medium">
                                  {state.analysisProgress?.currentStage ||
                                    "Analyzing with AI..."}
                                </h3>
                                <p className="text-muted-foreground">
                                  This may take 30-60 seconds depending on data
                                  complexity
                                </p>
                              </div>
                              <div className="w-full max-w-md space-y-4">
                                <Progress
                                  value={
                                    state.analysisProgress?.currentProgress
                                  }
                                  className="h-2"
                                />
                                <div className="text-left bg-muted/50 rounded-lg p-4 h-32 overflow-y-auto space-y-2 text-sm font-mono">
                                  {(state.analysisProgress?.stages || []).map(
                                    (stage, index) => {
                                      const isComplete =
                                        (state.analysisProgress
                                          ?.currentProgress || 0) >=
                                        (state.analysisProgress?.stages || [])
                                          .slice(0, index + 1)
                                          .reduce(
                                            (sum, s) => sum + s.weight,
                                            0
                                          );
                                      const isCurrent =
                                        stage.name ===
                                        state.analysisProgress?.currentStage;

                                      return (
                                        <div
                                          key={stage.name}
                                          className={cn(
                                            "flex items-center gap-2",
                                            isComplete
                                              ? "text-green-600"
                                              : "text-muted-foreground",
                                            isCurrent && "animate-pulse"
                                          )}
                                        >
                                          {isComplete ? (
                                            <CheckCircle2 className="h-4 w-4" />
                                          ) : (
                                            <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
                                          )}
                                          {stage.name}
                                        </div>
                                      );
                                    }
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {state.error && (
                          <div className="text-center py-8">
                            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium mb-2">
                              Analysis Failed
                            </h3>
                            <p className="text-muted-foreground mb-4">
                              {state.error}
                            </p>
                            <div className="flex items-center justify-center gap-3">
                              <Button
                                onClick={() => {
                                  updateState({ error: undefined });
                                  performAIAnalysis();
                                }}
                                className="gap-2"
                              >
                                <RotateCcw className="h-4 w-4" />
                                Try Again
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() =>
                                  updateState({ error: undefined })
                                }
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}

                        {state.generatedSchema && !state.error && (
                          <div className="text-center py-8">
                            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
                            <h3 className="text-lg font-medium mb-2">
                              Analysis Complete!
                            </h3>
                            <p className="text-muted-foreground mb-4">
                              AI has successfully generated a schema with{" "}
                              {state.generatedSchema.tables.length} tables.
                            </p>
                            <div className="flex items-center justify-center gap-3">
                              <Badge variant="outline">
                                {state.generatedSchema.tables.length} Tables
                              </Badge>
                              <Badge variant="outline">
                                {state.generatedSchema.tables.reduce(
                                  (acc, table) => acc + table.columns.length,
                                  0
                                )}{" "}
                                Columns
                              </Badge>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Please upload CSV files first to begin analysis.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              {state.currentStep === "optimize" && (
                <SchemaOptimizationPanel
                  optimizationResult={state.optimizationResult!}
                  onApplySuggestion={(suggestion) => {
                    console.log("Applying suggestion:", suggestion);
                  }}
                  onRefineSchema={async (feedback) => {
                    try {
                      // Reset state and move back to analysis step
                      updateState({
                        currentStep: "analyze",
                        isProcessing: true,
                        error: undefined,
                        analysisProgress: {
                          currentStage: "",
                          currentProgress: 0,
                          stages: [],
                        },
                        generatedSchema: undefined,
                      });

                      const response = await fetch("/api/ai/analyze", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          csvResults: convertToAPIFormat(state.csvResults),
                          options: {
                            includeOptimizations: true,
                            targetUseCase: "web-app",
                          },
                          prompt: feedback,
                          previousSchema: state.generatedSchema, // Send previous schema as reference
                        }),
                      });

                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(
                          errorData.error ||
                            errorData.message ||
                            "Analysis failed"
                        );
                      }

                      const reader = response.body?.getReader();
                      const decoder = new TextDecoder();

                      if (!reader) {
                        throw new Error("Failed to initialize stream reader");
                      }

                      while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value);
                        const lines = chunk.split("\n");

                        for (const line of lines) {
                          if (line.startsWith("data: ")) {
                            try {
                              const event = JSON.parse(line.slice(6));

                              switch (event.type) {
                                case "metadata":
                                  console.log("Analysis metadata:", event.data);
                                  break;

                                case "progress":
                                  updateState({
                                    analysisProgress: {
                                      currentStage: event.data.stage,
                                      currentProgress: event.data.progress,
                                      stages:
                                        state.analysisProgress?.stages || [],
                                    },
                                  });
                                  break;

                                case "complete":
                                  if (event.data.success) {
                                    const { analysis, metadata } = event.data;

                                    // Convert AI analysis to DatabaseSchema format
                                    const refinedSchema: DatabaseSchema = {
                                      id: generateId(),
                                      name: "AI Generated Schema",
                                      version: "1.0.0",
                                      createdAt: new Date(),
                                      updatedAt: new Date(),
                                      tables: analysis.tables.map(
                                        (table: AIAnalysisTable): Table => ({
                                          id: generateId(),
                                          name: table.name,
                                          comment: table.comment || "",
                                          position: { x: 0, y: 0 },
                                          columns: table.columns.map(
                                            (col): Column => ({
                                              id: generateId(),
                                              name: col.name,
                                              type: mapToPostgresType(col.type),
                                              nullable: col.nullable,
                                              length: col.length || 0,
                                              precision: col.precision || 0,
                                              scale: col.scale || 0,
                                              defaultValue:
                                                col.defaultValue || "",
                                              constraints: col.constraints.map(
                                                (c): ColumnConstraint => ({
                                                  type: mapToConstraintType(c),
                                                })
                                              ),
                                              comment: col.reasoning || "",
                                            })
                                          ),
                                          indexes: table.indexes.map((idx) => ({
                                            id: generateId(),
                                            name: idx.name,
                                            columns: idx.columns,
                                            unique: idx.unique,
                                          })),
                                        })
                                      ),
                                      relationships: [],
                                      rlsPolicies: [],
                                    };

                                    // Update optimization result with the refined schema
                                    const updatedOptimizationResult: SchemaOptimizationResult =
                                      {
                                        originalSchema:
                                          state.optimizationResult!
                                            .originalSchema,
                                        optimizedSchema: refinedSchema,
                                        suggestions: [],
                                        summary: {
                                          totalSuggestions: 0,
                                          criticalIssues: 0,
                                          autoApplicableCount: 0,
                                          estimatedPerformanceGain: 0,
                                          confidenceScore:
                                            metadata?.confidence || 85,
                                        },
                                        aiAnalysis: {
                                          reasoning:
                                            analysis.reasoning ||
                                            "Schema refined based on feedback",
                                          suggestions: [],
                                          tables: refinedSchema.tables.map(
                                            (table) => ({
                                              name: table.name,
                                              columns: table.columns.map(
                                                (col) => ({
                                                  name: col.name,
                                                  type: col.type,
                                                  nullable: col.nullable,
                                                  length: col.length,
                                                  precision: col.precision,
                                                  scale: col.scale,
                                                  defaultValue:
                                                    col.defaultValue,
                                                  constraints:
                                                    col.constraints.map(
                                                      (c) => c.type
                                                    ),
                                                  reasoning:
                                                    col.comment ||
                                                    `Column ${col.name} of type ${col.type}`,
                                                })
                                              ),
                                              relationships: [],
                                              indexes: [],
                                              comment: table.comment,
                                              rlsPolicies: [],
                                            })
                                          ),
                                          confidence:
                                            metadata?.confidence || 0.85,
                                        },
                                      };

                                    updateState({
                                      generatedSchema: refinedSchema,
                                      optimizationResult:
                                        updatedOptimizationResult,
                                      isProcessing: false,
                                      analysisProgress: metadata.progress,
                                      currentStep: "optimize", // Return to optimize step after completion
                                    });

                                    // Mark analyze step as completed again
                                    markStepComplete("analyze");
                                  }
                                  break;

                                case "error":
                                  throw new Error(
                                    event.data.message || "Analysis failed"
                                  );
                              }
                            } catch (e) {
                              console.error("Error parsing SSE:", e);
                            }
                          }
                        }
                      }
                    } catch (error) {
                      console.error("Schema refinement failed:", error);
                      updateState({
                        isProcessing: false,
                        error:
                          error instanceof Error
                            ? error.message
                            : "Schema refinement failed. Please try again.",
                        currentStep: "optimize", // Return to optimize step on error
                      });
                    }
                  }}
                  onExportOptimized={() => {
                    handleOptimization({
                      originalSchema: state.generatedSchema!,
                      optimizedSchema: state.generatedSchema!,
                      suggestions: [],
                      summary: {
                        totalSuggestions: 0,
                        criticalIssues: 0,
                        autoApplicableCount: 0,
                        estimatedPerformanceGain: 0,
                        confidenceScore: 85,
                      },
                      aiAnalysis: {
                        reasoning:
                          "Initial schema generated successfully. Ready for optimization.",
                        suggestions: [],
                        tables: state.generatedSchema!.tables.map((table) => ({
                          name: table.name,
                          columns: table.columns.map((col) => ({
                            name: col.name,
                            type: col.type,
                            nullable: col.nullable,
                            length: col.length,
                            precision: col.precision,
                            scale: col.scale,
                            defaultValue: col.defaultValue,
                            constraints: col.constraints.map((c) => c.type),
                            reasoning:
                              col.comment ||
                              `Column ${col.name} of type ${col.type}`,
                          })),
                          relationships: [],
                          indexes: [],
                          comment: table.comment,
                          rlsPolicies: [],
                        })),
                        confidence: 0.85,
                      },
                    });
                  }}
                />
              )}

              {state.currentStep === "design" && state.generatedSchema && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      Visual Schema Design
                    </CardTitle>
                    <p className="text-muted-foreground">
                      Fine-tune your schema with our visual editor. Drag tables,
                      edit relationships, and customize properties.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <VisualSchemaEditor
                      schema={state.generatedSchema}
                      onSchemaChange={handleDesignComplete}
                      className="h-[600px]"
                    />
                  </CardContent>
                </Card>
              )}

              {state.currentStep === "export" && state.generatedSchema && (
                <div>
                  <ExportManagerUI schema={state.generatedSchema} />
                  <div className="mt-6 text-center">
                    <Button onClick={handleExportComplete} className="gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Continue to Deployment
                    </Button>
                  </div>
                </div>
              )}

              {state.currentStep === "deploy" && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Cloud className="h-5 w-5" />
                        Deploy to Supabase
                      </CardTitle>
                      <p className="text-muted-foreground">
                        Choose a Supabase project and deploy your schema with
                        one click.
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <ProjectSelector
                          onProjectSelect={(project) => {
                            handleDeployComplete({
                              success: true,
                              projectId: project.id,
                              projectName: project.name,
                              dbUrl: project.database?.host || "",
                            });
                          }}
                          onCreateProject={(project: SupabaseProject) => {
                            handleDeployComplete({
                              success: true,
                              projectId: project.id,
                              projectName: project.name,
                              dbUrl: project.database?.host || "",
                            });
                          }}
                          workflowState={getOAuthWorkflowState()}
                        />

                        {state.generatedSchema && (
                          <MigrationDeployer
                            schema={state.generatedSchema}
                            onDeploymentComplete={handleDeployComplete}
                          />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Project Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Project Statistics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CSV Files</span>
                      <Badge>{state.csvResults.length}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tables</span>
                      <Badge>{state.generatedSchema?.tables.length || 0}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Relationships
                      </span>
                      <Badge>
                        {state.generatedSchema?.relationships?.length || 0}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Progress</span>
                      <Badge>{overallProgress.toFixed(0)}%</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {Array.from(state.completedSteps).map((step) => {
                      const stepInfo = WORKFLOW_STEPS.find(
                        (s) => s.id === step
                      );
                      return (
                        <div
                          key={step}
                          className="flex items-center gap-2 text-muted-foreground"
                        >
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          {stepInfo?.title} completed
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2"
                    >
                      <Save className="h-4 w-4" />
                      Save Progress
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2"
                    >
                      <Share2 className="h-4 w-4" />
                      Share Project
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2"
                      onClick={restartWorkflow}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Start Over
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Workflow Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Settings and preferences will be available in the next
                      update.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Global Feedback Manager */}
      <FeedbackManager />
    </div>
  );
}
