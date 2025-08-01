"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { User } from "@supabase/supabase-js";
import {
  AlertCircle,
  ArrowRight,
  ArrowRightIcon,
  Brain,
  CheckCircle2,
  Cloud,
  Download,
  Eye,
  Info,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";

// Import our feature components
import { SchemaOptimizationPanel } from "@/components/ai/schema-optimization-panel";
import { EnhancedCSVDropzone } from "@/components/csv/enhanced-csv-dropzone";
import { ExportManagerUI } from "@/components/export/export-manager-ui";
import { FeedbackManager } from "@/components/feedback/feedback-manager";
import { VisualSchemaEditor } from "@/components/schema/visual-schema-editor";
import { DataSeedingInterface } from "@/components/seeding/data-seeding-interface";
import { MigrationDeployer } from "@/components/supabase/migration-deployer";
import { ProjectSelector } from "@/components/supabase/project-selector";

// Import types and utilities
import type { SchemaOptimizationResult } from "@/lib/ai/schema-optimizer";
import type { CSVValidationResult } from "@/lib/csv/validator";
import { ProjectStorage } from "@/lib/storage/project-storage";
import { SchemaStorage } from "@/lib/storage/schema-storage";
import type {
  DeploymentResult,
  SupabaseProject,
} from "@/lib/supabase/management";
import { getSupabaseOAuth, type OAuthState } from "@/lib/supabase/oauth";
import { generateId } from "@/lib/utils";
import type { WorkflowState as OAuthWorkflowState } from "@/lib/workflow/state-manager";
import type {
  Column,
  ColumnConstraint,
  ConstraintType,
  DatabaseSchema,
  PostgresType,
  Table,
} from "@/types/schema.types";
import { SupabaseLogoMark, SupabaseLogoMarkRed } from "../supabase-logo";
import { postProcessSchemaTypes } from "@/lib/utils/schema-type-processor";

interface SchemaWorkflowProps {
  user: User;
}

type WorkflowStep =
  | "upload"
  | "analyze"
  | "optimize"
  | "design"
  | "export"
  | "deploy"
  | "seed";

interface WorkflowState {
  currentStep: WorkflowStep;
  csvResults: CSVValidationResult[];
  generatedSchema?: DatabaseSchema | undefined;
  optimizationResult?: SchemaOptimizationResult | undefined;
  isProcessing: boolean;
  completedSteps: Set<WorkflowStep>;
  error?: string | undefined;
  selectedProject?: SupabaseProject | undefined;
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
  relationships?: AIAnalysisRelationship[];
  rlsPolicies?: AIAnalysisRLSPolicy[];
}

interface AIAnalysisRelationship {
  name: string;
  type: "one-to-one" | "one-to-many" | "many-to-many";
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
}

interface AIAnalysisRLSPolicy {
  name: string;
  operation: "SELECT" | "INSERT" | "UPDATE" | "DELETE";
  using?: string;
  with_check?: string;
  definition?: string;
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
    title: "Upload CSVs",
    description: "Upload and validate your CSV data files",
    icon: Upload,
    estimatedTime: "2-3 min",
  },
  {
    id: "analyze",
    title: "Analysis",
    description: "AI analyzes your data to generate optimal schema",
    icon: Brain,
    estimatedTime: "3-5 min",
  },
  {
    id: "optimize",
    title: "Review",
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
    icon: Cloud, // Using Cloud icon instead of SupabaseLogoMark to avoid type mismatch
    estimatedTime: "3-5 min",
  },
  {
    id: "seed",
    title: "Seed Data",
    description: "Upload CSV files to populate your tables",
    icon: Upload,
    estimatedTime: "5-15 min",
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

// Add constraint type mapping - handle AI-generated constraint strings properly
const mapToConstraintType = (constraint: string): ConstraintType => {
  const normalized = constraint.toLowerCase().trim();

  // Handle exact matches first
  if (normalized === "primary key" || normalized.includes("primary key")) {
    return "PRIMARY KEY";
  }
  if (normalized === "foreign key" || normalized.includes("foreign key")) {
    return "FOREIGN KEY";
  }
  if (normalized === "unique") {
    return "UNIQUE";
  }
  if (normalized === "not null") {
    return "NOT NULL";
  }
  if (normalized.startsWith("default")) {
    return "DEFAULT";
  }
  if (normalized.startsWith("check") || normalized.includes("check")) {
    return "CHECK";
  }

  // Fallback patterns for common constraint formats
  const constraintMap: Record<string, ConstraintType> = {
    primary_key: "PRIMARY KEY",
    foreign_key: "FOREIGN KEY",
    unique: "UNIQUE",
    not_null: "NOT NULL",
    check: "CHECK",
    default: "DEFAULT",
  };

  return constraintMap[normalized] || "DEFAULT"; // Better fallback than CHECK
};

export function SchemaWorkflow({ user }: SchemaWorkflowProps) {
  const [state, setState] = useState<WorkflowState>({
    currentStep: "upload",
    csvResults: [],
    isProcessing: false,
    completedSteps: new Set(),
  });

  const [showWelcome, setShowWelcome] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [schemaRecovered, setSchemaRecovered] = useState(false);
  const [hasStoredSchema, setHasStoredSchema] = useState(false);

  // Calculate overall progress
  const overallProgress =
    (state.completedSteps.size / WORKFLOW_STEPS.length) * 100;

  // Celebration function
  const triggerCelebration = useCallback(() => {
    setShowCelebration(true);
    // Auto-hide celebration after 5 seconds
    setTimeout(() => setShowCelebration(false), 5000);
  }, []);

  // Watch for 100% completion (only trigger once)
  const [hasTriggeredCelebration, setHasTriggeredCelebration] = useState(false);

  // Schema Recovery and detection on component mount
  useEffect(() => {
    const recoverSchema = () => {
      try {
        setHasStoredSchema(SchemaStorage.exists());
        const storedData = SchemaStorage.load();
        if (storedData && !schemaRecovered) {
          console.log("🔄 Recovering stored schema:", storedData.schema.name);

          // Generate default optimization result for recovered schema
          const optimizationResult: SchemaOptimizationResult = {
            originalSchema: storedData.schema,
            optimizedSchema: storedData.schema,
            suggestions: [],
            summary: {
              totalSuggestions: 0,
              criticalIssues: 0,
              autoApplicableCount: 0,
              estimatedPerformanceGain: 0,
              confidenceScore: 85,
            },
            aiAnalysis:
              storedData.originalAnalysis &&
              typeof storedData.originalAnalysis === "object" &&
              "confidence" in storedData.originalAnalysis
                ? (storedData.originalAnalysis as SchemaOptimizationResult["aiAnalysis"])
                : {
                    reasoning: "Schema recovered from browser storage",
                    suggestions: [],
                    tables: storedData.schema.tables.map((table) => ({
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
                    confidence:
                      storedData.originalAnalysis &&
                      typeof storedData.originalAnalysis === "object" &&
                      "confidence" in storedData.originalAnalysis
                        ? (
                            storedData.originalAnalysis as {
                              confidence: number;
                            }
                          ).confidence
                        : 0.85,
                  },
          };

          setState((prevState) => ({
            ...prevState,
            generatedSchema: storedData.schema,
            optimizationResult,
            completedSteps: new Set(["upload", "analyze", "optimize"]),
            currentStep: "design",
          }));

          setSchemaRecovered(true);
          setShowWelcome(false); // Skip welcome if we have a recovered schema
        }
      } catch (error) {
        console.error("❌ Failed to recover schema:", error);
        SchemaStorage.clear(); // Clear corrupted data
      }
    };

    recoverSchema();
  }, [schemaRecovered]);

  useEffect(() => {
    if (
      overallProgress === 100 &&
      !hasTriggeredCelebration &&
      !showCelebration
    ) {
      setHasTriggeredCelebration(true);
      // Small delay to let the progress bar animate to 100%
      setTimeout(() => triggerCelebration(), 300);
    }
  }, [
    overallProgress,
    hasTriggeredCelebration,
    showCelebration,
    triggerCelebration,
  ]);

  const updateState = useCallback((updates: Partial<WorkflowState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  // Load project data from localStorage on mount
  useEffect(() => {
    const projectData = ProjectStorage.retrieve();
    if (projectData) {
      updateState({ projectData });
    }
  }, [updateState]);

  // Add OAuth state management
  const [oauthState, setOauthState] = useState<OAuthState>({
    isConnected: false,
    isLoading: false,
  });

  useEffect(() => {
    const oauth = getSupabaseOAuth();
    const unsubscribe = oauth.subscribe(setOauthState);
    return unsubscribe;
  }, []);

  const oauth = getSupabaseOAuth();

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

    // Initialize analysis progress with stages - matches what the server defines
    const stages = [
      { name: "Initializing analysis", weight: 10 },
      { name: "Processing CSV data", weight: 20 },
      { name: "Analyzing data patterns", weight: 25 },
      { name: "Generating schema structure", weight: 25 },
      { name: "Optimizing relationships", weight: 10 },
      { name: "Finalizing schema", weight: 10 },
    ];

    updateState({
      isProcessing: true,
      error: undefined,
      analysisProgress: {
        currentStage: "",
        currentProgress: 0,
        stages: stages,
      },
    });

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
            const jsonData = line.slice(6);
            // Skip empty data lines
            if (!jsonData.trim()) {
              continue;
            }

            try {
              const event = JSON.parse(jsonData);

              switch (event.type) {
                case "metadata":
                  console.log("Analysis metadata:", event.data);
                  break;

                case "progress":
                  setState((prevState) => ({
                    ...prevState,
                    analysisProgress: {
                      currentStage: event.data.stage,
                      currentProgress: event.data.progress,
                      stages: prevState.analysisProgress?.stages || stages,
                    },
                  }));
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
                                (c): ColumnConstraint => {
                                  const constraintType = mapToConstraintType(c);
                                  const constraint: ColumnConstraint = {
                                    type: constraintType,
                                  };

                                  // Extract constraint values
                                  if (
                                    constraintType === "DEFAULT" &&
                                    c.toLowerCase().startsWith("default ")
                                  ) {
                                    constraint.value = c.substring(8).trim(); // Remove "DEFAULT " prefix
                                  } else if (
                                    constraintType === "CHECK" &&
                                    c.toLowerCase().includes("check")
                                  ) {
                                    // Extract check condition from "CHECK (condition)" format
                                    const checkMatch =
                                      c.match(/check\s*\((.+)\)/i);
                                    if (checkMatch) {
                                      constraint.value = checkMatch[1];
                                    }
                                  } else if (
                                    constraintType === "FOREIGN KEY" &&
                                    c.toLowerCase().includes("references")
                                  ) {
                                    // Extract foreign key reference
                                    const refMatch = c.match(
                                      /references\s+(\w+)\s*\((\w+)\)/i
                                    );
                                    if (refMatch) {
                                      constraint.referencedTable = refMatch[1];
                                      constraint.referencedColumn = refMatch[2];
                                    }
                                  }

                                  return constraint;
                                }
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
                      relationships: analysis.tables.flatMap(
                        (table: AIAnalysisTable) =>
                          (table.relationships || []).map(
                            (rel: AIAnalysisRelationship) => ({
                              id: generateId(),
                              name: `${table.name}_${rel.sourceColumn}_fk`,
                              type: rel.type as
                                | "one-to-one"
                                | "one-to-many"
                                | "many-to-many",
                              sourceTable: table.name,
                              sourceColumn: rel.sourceColumn,
                              targetTable: rel.targetTable,
                              targetColumn: rel.targetColumn,
                              onDelete: "CASCADE" as const,
                              onUpdate: "CASCADE" as const,
                            })
                          )
                      ),
                      rlsPolicies: analysis.tables.flatMap(
                        (table: AIAnalysisTable) =>
                          (table.rlsPolicies || []).map(
                            (policy: AIAnalysisRLSPolicy) => ({
                              id: generateId(),
                              tableName: table.name,
                              name: policy.name,
                              command: policy.operation as
                                | "SELECT"
                                | "INSERT"
                                | "UPDATE"
                                | "DELETE",
                              using: policy.using || "",
                              withCheck: policy.with_check || "",
                              roles: ["authenticated"],
                            })
                          )
                      ),
                    };

                    // CRITICAL: Apply post-processing to fix type issues (TEXT -> UUID, DECIMAL, etc.)
                    const optimizedSchema =
                      postProcessSchemaTypes(generatedSchema);

                    // Initialize optimization result with the optimized schema
                    const optimizationResult: SchemaOptimizationResult = {
                      originalSchema: generatedSchema,
                      optimizedSchema: optimizedSchema,
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
                        tables: optimizedSchema.tables.map((table) => ({
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

                    // Save schema to localStorage for persistence
                    try {
                      SchemaStorage.save({
                        schema: optimizedSchema,
                        originalAnalysis: analysis,
                        csvFileNames: state.csvResults.map(
                          (r, index) => `file_${index + 1}.csv`
                        ),
                      });
                    } catch (error) {
                      console.warn(
                        "⚠️ Failed to save schema to localStorage:",
                        error
                      );
                    }

                    updateState({
                      generatedSchema: optimizedSchema,
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
              console.log("Failed JSON data length:", jsonData.length);
              console.log("First 200 chars:", jsonData.substring(0, 200));
              console.log(
                "Last 200 chars:",
                jsonData.substring(Math.max(0, jsonData.length - 200))
              );

              // If it's a very large JSON payload, it might be getting truncated
              if (jsonData.length > 50000) {
                console.warn(
                  "Large JSON payload detected - may be truncated by browser/server limits"
                );
                // Try to continue processing other events
                continue;
              }
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
      // Update schema in localStorage when design changes
      try {
        SchemaStorage.updateSchema(schema);
      } catch (error) {
        console.warn("⚠️ Failed to update stored schema:", error);
      }

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
      const projectData = {
        projectId: result.projectId || "",
        projectName: result.projectName || "",
        dbUrl: result.dbUrl || "",
      };

      // Store project data in localStorage for persistence
      ProjectStorage.store(projectData);

      updateState({ projectData });
      markStepComplete("deploy");
    },
    [updateState, markStepComplete]
  );

  // Handle project selection
  const handleProjectSelect = useCallback(
    (project: SupabaseProject) => {
      updateState({ selectedProject: project });
    },
    [updateState]
  );

  // Handle OAuth connection
  const handleConnect = async () => {
    try {
      await oauth.startOAuth(getOAuthWorkflowState());
    } catch (error) {
      console.error("Failed to start OAuth:", error);
    }
  };

  // Restart workflow
  const restartWorkflow = useCallback(() => {
    // Clear project data from localStorage
    ProjectStorage.clear();
    // Clear stored schema
    SchemaStorage.clear();

    setState({
      currentStep: "upload",
      csvResults: [],
      generatedSchema: undefined,
      optimizationResult: undefined,
      isProcessing: false,
      completedSteps: new Set(),
      projectData: undefined,
      selectedProject: undefined,
    });
    setShowWelcome(false);
    setShowCelebration(false);
    setHasTriggeredCelebration(false);
    setSchemaRecovered(false);
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
        {/* Schema Recovery Banner */}
        {hasStoredSchema && !schemaRecovered && (
          <Alert className="mb-6 border-accent/20 bg-accent/10">
            <Info className="size-5 mt-1 !mr-2 !text-accent" />
            <AlertDescription className="text-accent">
              <div className="flex items-center justify-between">
                <div>
                  <strong>Previous session detected!</strong> We found a saved
                  schema from your last session.
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      SchemaStorage.clear();
                      setShowWelcome(true);
                    }}
                    className="text-accent border-accent/20 bg-accent/10"
                  >
                    Start Fresh
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => window.location.reload()}
                    className="bg-accent/10 hover:bg-accent/20"
                  >
                    <RefreshCw className="size-3" />
                    Recover Schema
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <div className="text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
              CSV <ArrowRight className="size-5" /> to{" "}
              <ArrowRight className="size-5" /> Supabase
            </h1>
            <p className="text-xl text-muted-foreground">
              Transform your CSV files into production-ready Postgres schemas
              with AI
            </p>
          </div>

          {/* Supabase Connection Status */}
          {oauthState.isConnected && (
            <Card className="max-w-2xl mx-auto">
              <CardContent className="py-4">
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <SupabaseLogoMark />
                  <span className="font-medium">Connected to Supabase</span>
                  {oauthState.user?.email && (
                    <span className="text-sm text-muted-foreground">
                      ({oauthState.user.email})
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

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

          <div className="flex justify-center gap-4 flex-wrap">
            <Button
              onClick={() => setShowWelcome(false)}
              size="lg"
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              Start Building Schema
            </Button>

            {!oauthState.isConnected ? (
              <Button
                onClick={handleConnect}
                disabled={oauthState.isLoading}
                variant="outline"
                size="lg"
                className="gap-2"
              >
                {oauthState.isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <SupabaseLogoMark />
                )}
                Connect Supabase
              </Button>
            ) : (
              <Button
                onClick={() => oauth.disconnect()}
                variant="outline"
                size="lg"
                className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-500/10"
              >
                <SupabaseLogoMarkRed />
                Disconnect Supabase
              </Button>
            )}
          </div>

          <Alert className="max-w-2xl mx-auto">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Your CSV data is processed client-side and the schema and sample
              rows are scanned by Google Gemini. No data is saved to external
              servers during analysis.
            </AlertDescription>
          </Alert>

          {oauthState.error && (
            <Alert className="max-w-2xl mx-auto" variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{oauthState.error}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 size-full flex flex-col">
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Supabase Schema Builder</h1>
              <p className="text-muted-foreground">
                Welcome back,{" "}
                {user.email &&
                  user.email?.split("@")[0]?.charAt(0).toUpperCase() +
                    user.email?.split("@")[0]?.slice(1)}
                ! Let&apos;s create something amazing.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right flex flex-col gap-1">
                <p className="text-xs font-medium">
                  {overallProgress.toFixed(0)}% Complete
                </p>
                <Progress
                  value={overallProgress}
                  className="w-32 h-2 border border-accent/50"
                />
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
                        "text-primary dark:text-accent border border-accent/20 bg-accent/10"
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

      <div className="w-full max-w-7xl mx-auto p-6 grow flex flex-col">
        {/* Current Step Content */}
        <div className="space-y-6 grow flex flex-col">
          {state.currentStep === "upload" && (
            <Card className="grow flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload CSV Files
                </CardTitle>
                <p className="text-muted-foreground">
                  Upload your CSV files to begin schema generation. We&apos;ll
                  validate and analyze your data.
                </p>
              </CardHeader>
              <CardContent className="grow flex flex-col">
                <EnhancedCSVDropzone
                  className="grow"
                  onValidationComplete={handleCSVValidation}
                  maxFiles={5}
                  initialFiles={state.csvResults}
                />
              </CardContent>
            </Card>
          )}

          {state.currentStep === "analyze" && (
            <Card className="grow flex flex-col">
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
              <CardContent className="grow flex flex-col">
                {state.csvResults.length > 0 ? (
                  <div className="space-y-6 grow flex flex-col">
                    {!state.isProcessing &&
                      !state.generatedSchema &&
                      !state.error && (
                        <div className="text-center py-8">
                          <Brain className="size-12 text-primary mx-auto mb-4" />
                          <h3 className="text-lg font-medium mb-2">
                            Ready to Analyze
                          </h3>
                          <p className="text-muted-foreground mb-4">
                            Click below to start AI-powered schema generation
                            from your uploaded CSV files.
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
                      <div className="text-center py-8 grow flex flex-col">
                        <div className="flex flex-col items-center gap-4">
                          <div className="relative">
                            <Brain className="size-12 text-primary dark:text-accent animate-pulse" />
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
                              value={state.analysisProgress?.currentProgress}
                              className="h-2"
                            />
                            <div className="text-left bg-muted/50 rounded-lg p-4 h-32 overflow-y-auto space-y-2 text-sm font-mono">
                              {(state.analysisProgress?.stages || []).map(
                                (stage, index) => {
                                  const isComplete =
                                    (state.analysisProgress?.currentProgress ||
                                      0) >=
                                    (state.analysisProgress?.stages || [])
                                      .slice(0, index + 1)
                                      .reduce((sum, s) => sum + s.weight, 0);
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
                      <div className="text-center py-8 grow flex flex-col">
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
                            onClick={() => updateState({ error: undefined })}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {state.generatedSchema && !state.error && (
                      <div className="text-center py-8 grow flex flex-col">
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
              className="grow flex flex-col"
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
                                          defaultValue: col.defaultValue || "",
                                          constraints: col.constraints.map(
                                            (c): ColumnConstraint => {
                                              const constraintType =
                                                mapToConstraintType(c);
                                              const constraint: ColumnConstraint =
                                                { type: constraintType };

                                              // Extract constraint values
                                              if (
                                                constraintType === "DEFAULT" &&
                                                c
                                                  .toLowerCase()
                                                  .startsWith("default ")
                                              ) {
                                                constraint.value = c
                                                  .substring(8)
                                                  .trim(); // Remove "DEFAULT " prefix
                                              } else if (
                                                constraintType === "CHECK" &&
                                                c
                                                  .toLowerCase()
                                                  .includes("check")
                                              ) {
                                                // Extract check condition from "CHECK (condition)" format
                                                const checkMatch =
                                                  c.match(/check\s*\((.+)\)/i);
                                                if (checkMatch) {
                                                  constraint.value =
                                                    checkMatch[1];
                                                }
                                              } else if (
                                                constraintType ===
                                                  "FOREIGN KEY" &&
                                                c
                                                  .toLowerCase()
                                                  .includes("references")
                                              ) {
                                                // Extract foreign key reference
                                                const refMatch = c.match(
                                                  /references\s+(\w+)\s*\((\w+)\)/i
                                                );
                                                if (refMatch) {
                                                  constraint.referencedTable =
                                                    refMatch[1];
                                                  constraint.referencedColumn =
                                                    refMatch[2];
                                                }
                                              }

                                              return constraint;
                                            }
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
                                  relationships: (
                                    analysis.tables as AIAnalysisTable[]
                                  ).flatMap(
                                    (table: AIAnalysisTable) =>
                                      table.relationships?.map(
                                        (rel: AIAnalysisRelationship) => ({
                                          id: generateId(),
                                          name: `${table.name}_${rel.sourceColumn}_fk`,
                                          type: rel.type,
                                          sourceTable: table.name,
                                          sourceColumn: rel.sourceColumn,
                                          targetTable: rel.targetTable,
                                          targetColumn: rel.targetColumn,
                                          onDelete: "CASCADE",
                                          onUpdate: "CASCADE",
                                        })
                                      ) || []
                                  ),
                                  rlsPolicies: (
                                    analysis.tables as AIAnalysisTable[]
                                  ).flatMap(
                                    (table: AIAnalysisTable) =>
                                      table.rlsPolicies?.map(
                                        (policy: AIAnalysisRLSPolicy) => ({
                                          id: generateId(),
                                          tableName: table.name,
                                          name: policy.name,
                                          command: policy.operation,
                                          using: policy.using || "",
                                          withCheck: policy.with_check || "",
                                          roles: ["authenticated"],
                                        })
                                      ) || []
                                  ),
                                };

                                // Update optimization result with the refined schema
                                const updatedOptimizationResult: SchemaOptimizationResult =
                                  {
                                    originalSchema:
                                      state.optimizationResult!.originalSchema,
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
                                          columns: table.columns.map((col) => ({
                                            name: col.name,
                                            type: col.type,
                                            nullable: col.nullable,
                                            length: col.length,
                                            precision: col.precision,
                                            scale: col.scale,
                                            defaultValue: col.defaultValue,
                                            constraints: col.constraints.map(
                                              (c) => c.type
                                            ),
                                            reasoning:
                                              col.comment ||
                                              `Column ${col.name} of type ${col.type}`,
                                          })),
                                          relationships: [],
                                          indexes: [],
                                          comment: table.comment,
                                          rlsPolicies: [],
                                        })
                                      ),
                                      confidence: metadata?.confidence || 0.85,
                                    },
                                  };

                                // Apply post-processing to fix type issues (TEXT -> UUID, DECIMAL, etc.)
                                const optimizedRefinedSchema =
                                  postProcessSchemaTypes(refinedSchema);

                                // Save refined schema to localStorage for persistence
                                try {
                                  SchemaStorage.save({
                                    schema: optimizedRefinedSchema,
                                    originalAnalysis: analysis,
                                    csvFileNames: state.csvResults.map(
                                      (r, index) => `file_${index + 1}.csv`
                                    ),
                                  });
                                  console.log(
                                    "✅ Refined schema saved to localStorage"
                                  );
                                } catch (error) {
                                  console.warn(
                                    "⚠️ Failed to save refined schema to localStorage:",
                                    error
                                  );
                                }

                                updateState({
                                  generatedSchema: optimizedRefinedSchema,
                                  optimizationResult: {
                                    ...updatedOptimizationResult,
                                    optimizedSchema: optimizedRefinedSchema,
                                  },
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
                // Simply mark the step as complete and proceed without overwriting the optimization result
                handleOptimization(state.optimizationResult!);
                nextStep();
              }}
            />
          )}

          {state.currentStep === "design" && state.generatedSchema && (
            <Card className="grow flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="grow">
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      Visual Schema Design
                    </CardTitle>
                    <p className="text-muted-foreground">
                      Fine-tune your schema with our visual editor. Drag tables,
                      edit relationships, and customize properties.
                    </p>
                  </div>
                  <Button
                    variant="default"
                    onClick={() => {
                      if (state.generatedSchema) {
                        handleDesignComplete(state.generatedSchema);
                      }
                      nextStep();
                    }}
                  >
                    Proceed
                    <ArrowRightIcon className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grow flex flex-col">
                <VisualSchemaEditor
                  schema={state.generatedSchema}
                  onSchemaChange={handleDesignComplete}
                  className="min-h-[600px] grow"
                />
              </CardContent>
            </Card>
          )}

          {state.currentStep === "export" && state.generatedSchema && (
            <div className="relative">
              <Button
                onClick={() => {
                  handleExportComplete();
                  nextStep();
                }}
                className="gap-2 absolute right-6 top-6"
              >
                Proceed
                <ArrowRightIcon className="size-4" />
              </Button>
              <ExportManagerUI schema={state.generatedSchema} />
            </div>
          )}

          {state.currentStep === "deploy" && (
            <div className="space-y-6 grow flex flex-col">
              <Card className="grow flex flex-col">
                <CardHeader className="flex flex-row gap-2 items-center">
                  <div className="grow">
                    <CardTitle className="flex items-center gap-2">
                      <Cloud className="h-5 w-5" />
                      Deploy to Supabase
                    </CardTitle>
                    <p className="text-muted-foreground">
                      Choose a Supabase project and deploy your schema with one
                      click.
                      {schemaRecovered && state.projectData && (
                        <span className="block mt-1 text-sm text-accent">
                          ✓ Recovered schema detected with saved project data.
                          You can proceed directly to seeding.
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      markStepComplete("deploy");
                      goToStep("seed");
                    }}
                    className="gap-2"
                    disabled={
                      (!state.completedSteps.has("deploy") &&
                        !schemaRecovered) ||
                      !state.projectData
                    }
                  >
                    Proceed
                    <ArrowRightIcon className="size-4" />
                  </Button>
                </CardHeader>
                <CardContent className="grow flex flex-col">
                  <div className="space-y-6 grow flex flex-col">
                    <ProjectSelector
                      onProjectSelect={handleProjectSelect}
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
                        {...(state.selectedProject && {
                          project: state.selectedProject,
                        })}
                        onDeploymentComplete={handleDeployComplete}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {state.currentStep === "seed" &&
            state.generatedSchema &&
            state.projectData && (
              <DataSeedingInterface
                schema={state.generatedSchema}
                projectId={state.projectData.projectId}
                userEmail={user.email || null}
                onSeedingComplete={(result) => {
                  if (result.success) {
                    console.log(
                      "Seeding completed successfully:",
                      result.statistics
                    );
                    markStepComplete("seed");
                  }
                }}
                onSeedingProgress={(progress) => {
                  console.log("Seeding progress:", progress);
                  // Could update UI with seeding progress
                }}
                className="grow"
              />
            )}
        </div>
      </div>

      {/* Global Feedback Manager */}
      <FeedbackManager />

      {/* Celebration Modal */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="relative">
            {/* Confetti Animation */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <style>{`
                @keyframes confetti-fall {
                  0% {
                    transform: translateY(-10px) rotate(0deg);
                    opacity: 1;
                  }
                  100% {
                    transform: translateY(calc(100vh + 20px)) rotate(360deg);
                    opacity: 0;
                  }
                }
              `}</style>
              {Array.from({ length: 50 }, (_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: "-10px",
                    backgroundColor: [
                      "#3CCE8E",
                      "#10b981",
                      "#00623A",
                      "#4D8B70",
                      "#90E2B9",
                      "#06b6d4",
                    ][Math.floor(Math.random() * 6)],
                    animation: `confetti-fall ${
                      2 + Math.random() * 3
                    }s linear ${Math.random() * 2}s infinite`,
                    transform: `rotate(${Math.random() * 360}deg)`,
                  }}
                />
              ))}
            </div>

            {/* Celebration Card */}
            <Card className="mx-4 w-full max-w-md text-center">
              <CardContent className="p-8">
                <div className="mb-4">
                  <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto animate-pulse" />
                </div>
                <h2 className="text-2xl font-bold mb-2">🎉 Congratulations!</h2>
                <p className="text-muted-foreground mb-4">
                  You&apos;ve successfully completed your entire database schema
                  workflow!
                </p>
                <div className="space-y-2 mb-6">
                  <p className="text-sm font-medium">✅ Schema Generated</p>
                  <p className="text-sm font-medium">✅ Optimized & Designed</p>
                  <p className="text-sm font-medium">✅ Deployed to Supabase</p>
                  <p className="text-sm font-medium">✅ Data Seeded</p>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={() => setShowCelebration(false)}
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    View Project
                  </Button>
                  <Button
                    variant="outline"
                    onClick={restartWorkflow}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    New Project
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
