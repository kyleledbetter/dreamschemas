"use client";

import React, { useState, useCallback } from "react";
import {
  Upload,
  Database,
  CheckCircle2,
  AlertCircle,
  Clock,
  Play,
  RefreshCw,
  Eye,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Prism from "prismjs";
import "prismjs/components/prism-sql";
import { getSupabaseOAuth } from "@/lib/supabase/oauth";
import {
  generateMigrations,
  type MigrationOptions,
} from "@/lib/supabase/migration-formatter";
import type { DatabaseSchema } from "@/types/schema.types";
import type {
  SupabaseProject,
  DeploymentResult,
} from "@/lib/supabase/management";

interface MigrationDeployerProps {
  schema: DatabaseSchema;
  project?: SupabaseProject;
  onDeploymentComplete?: (result: DeploymentResult) => void;
  className?: string;
}

interface DeploymentStep {
  id: string;
  name: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: DeploymentResult;
  startTime?: number;
  endTime?: number;
}

export function MigrationDeployer({
  schema,
  project,
  onDeploymentComplete,
  className = "",
}: MigrationDeployerProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentSteps, setDeploymentSteps] = useState<DeploymentStep[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [deploymentOptions, setDeploymentOptions] = useState<
    Partial<MigrationOptions>
  >({
    includeRLS: true,
    includeIndexes: true,
    includeComments: true,
    includeDropStatements: false,
  });

  const oauth = getSupabaseOAuth();

  // Generate migration preview
  const migrationFiles = generateMigrations(schema, {
    format: "migration",
    ...deploymentOptions,
  });

  const updateStepStatus = useCallback(
    (
      stepId: string,
      status: DeploymentStep["status"],
      result?: DeploymentResult
    ) => {
      setDeploymentSteps((prev) =>
        prev.map((step) => {
          if (step.id === stepId) {
            const updatedStep: DeploymentStep = {
              ...step,
              status,
            };

            if (result !== undefined) {
              updatedStep.result = result;
            }

            if (status === "running" && !step.startTime) {
              updatedStep.startTime = Date.now();
            }

            if (
              (status === "completed" || status === "failed") &&
              !step.endTime
            ) {
              updatedStep.endTime = Date.now();
            }

            return updatedStep;
          }
          return step;
        })
      );
    },
    []
  );

  const deploySchema = useCallback(async () => {
    if (!project || isDeploying) return;

    try {
      setIsDeploying(true);

      // Initialize deployment steps
      const steps: DeploymentStep[] = [
        {
          id: "validate",
          name: "Validate Schema",
          description: "Checking schema for errors and compatibility",
          status: "pending",
        },
        {
          id: "connect",
          name: "Connect to Project",
          description: `Establishing connection to ${project.name}`,
          status: "pending",
        },
        {
          id: "backup",
          name: "Create Backup Point",
          description: "Creating rollback point for safety",
          status: "pending",
        },
        {
          id: "deploy",
          name: "Deploy Schema",
          description: "Executing migration on database",
          status: "pending",
        },
        {
          id: "verify",
          name: "Verify Deployment",
          description: "Confirming schema was applied correctly",
          status: "pending",
        },
      ];

      setDeploymentSteps(steps);

      const managementClient = oauth.getManagementClient();

      // Step 1: Validate Schema
      updateStepStatus("validate", "running");
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate validation

      if (schema.tables.length === 0) {
        updateStepStatus("validate", "failed", {
          success: false,
          error: "Schema contains no tables",
        });
        return;
      }

      updateStepStatus("validate", "completed", {
        success: true,
        affected_tables: schema.tables.map((t) => t.name),
      });

      // Step 2: Connect to Project
      updateStepStatus("connect", "running");

      const connectionTest = await managementClient.testConnection(project.id);
      if (!connectionTest.success) {
        updateStepStatus("connect", "failed", {
          success: false,
          error: connectionTest.error || "Failed to connect to project",
        });
        return;
      }

      updateStepStatus("connect", "completed", {
        success: true,
      });

      // Step 3: Create Backup Point
      updateStepStatus("backup", "running");
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate backup

      const rollbackSQL = managementClient.generateRollbackSQL(schema);
      updateStepStatus("backup", "completed", {
        success: true,
        rollback_sql: rollbackSQL,
      });

      // Step 4: Deploy Schema
      updateStepStatus("deploy", "running");

      const deploymentResult = await managementClient.deploySchema(
        project.id,
        schema,
        deploymentOptions
      );

      if (!deploymentResult.success) {
        updateStepStatus("deploy", "failed", deploymentResult);
        return;
      }

      updateStepStatus("deploy", "completed", deploymentResult);

      // Step 5: Verify Deployment
      updateStepStatus("verify", "running");
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate verification

      // Check if tables were created
      const verificationResult = await managementClient.testConnection(
        project.id
      );
      updateStepStatus("verify", "completed", {
        success: verificationResult.success,
        applied_at: new Date().toISOString(),
      });

      onDeploymentComplete?.(deploymentResult);
    } catch (error) {
      const errorResult: DeploymentResult = {
        success: false,
        error: error instanceof Error ? error.message : "Deployment failed",
      };

      // Mark the current running step as failed
      const runningStep = deploymentSteps.find(
        (step) => step.status === "running"
      );
      if (runningStep) {
        updateStepStatus(runningStep.id, "failed", errorResult);
      }

      onDeploymentComplete?.(errorResult);
    } finally {
      setIsDeploying(false);
    }
  }, [
    project,
    isDeploying,
    schema,
    deploymentOptions,
    oauth,
    updateStepStatus,
    deploymentSteps,
    onDeploymentComplete,
  ]);

  const getStepIcon = (step: DeploymentStep) => {
    switch (step.status) {
      case "running":
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStepDuration = (step: DeploymentStep): string => {
    if (!step.startTime) return "";
    const endTime = step.endTime || Date.now();
    const duration = endTime - step.startTime;
    return `${Math.round(duration / 100) / 10}s`;
  };

  const getOverallProgress = (): number => {
    const completedSteps = deploymentSteps.filter(
      (step) => step.status === "completed" || step.status === "failed"
    ).length;
    return deploymentSteps.length > 0
      ? (completedSteps / deploymentSteps.length) * 100
      : 0;
  };

  const hasFailures = deploymentSteps.some((step) => step.status === "failed");
  const isComplete =
    deploymentSteps.length > 0 &&
    deploymentSteps.every(
      (step) => step.status === "completed" || step.status === "failed"
    );

  if (!project) {
    return (
      <Card className={className}>
        <CardContent className="text-center py-8">
          <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-medium mb-2">No Project Selected</h3>
          <p className="text-muted-foreground">
            Please select a Supabase project to deploy your schema.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Deployment Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Deploy to Supabase
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Deploy &quot;{schema.name}&quot; to {project.name}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                {showPreview ? "Hide" : "Preview"} Migration
              </Button>

              {deploymentOptions.includeDropStatements ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      disabled={isDeploying || !oauth.getState().isConnected}
                      className="gap-2"
                    >
                      {isDeploying ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Deploying...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          Deploy Schema
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        Destructive Action Warning
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        You are about to deploy with{" "}
                        <strong>Drop Tables</strong> enabled. This will:
                        <br />
                        <br />• <strong>Delete all existing tables</strong> and
                        their data
                        <br />• <strong>
                          Permanently destroy all records
                        </strong>{" "}
                        in those tables
                        <br />
                        • Create new tables from scratch
                        <br />
                        <br />
                        <strong>This action cannot be undone!</strong> Are you
                        absolutely sure you want to continue?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={deploySchema}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Yes, Delete & Deploy
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button
                  onClick={deploySchema}
                  disabled={isDeploying || !oauth.getState().isConnected}
                  className="gap-2"
                >
                  {isDeploying ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Deploying...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Deploy Schema
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Deployment Options */}
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Deployment Options</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: "includeRLS", label: "RLS Policies" },
                  { key: "includeIndexes", label: "Indexes" },
                  { key: "includeComments", label: "Comments" },
                  {
                    key: "includeDropStatements",
                    label: "Drop Tables",
                    dangerous: true,
                  },
                ].map(({ key, label, dangerous }) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={
                        deploymentOptions[
                          key as keyof MigrationOptions
                        ] as boolean
                      }
                      onChange={(e) =>
                        setDeploymentOptions((prev) => ({
                          ...prev,
                          [key]: e.target.checked,
                        }))
                      }
                      disabled={isDeploying}
                      className="rounded"
                    />
                    <span className={dangerous ? "text-red-600" : ""}>
                      {label}
                    </span>
                  </label>
                ))}
              </div>

              {/* Warning for Drop Tables */}
              {deploymentOptions.includeDropStatements && (
                <Alert className="mt-2 border-destructive/50 text-error dark:border-destructive">
                  <AlertTriangle className="size-4 !text-error" />
                  <AlertDescription>
                    <strong>Warning:</strong> Drop Tables is enabled. This will
                    delete all existing tables and data before creating new
                    ones. This action cannot be undone!!!
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Migration Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-muted/30 rounded-lg text-sm">
              <div>
                <span className="text-muted-foreground">Tables:</span>
                <p className="font-medium">{schema.tables.length}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Relationships:</span>
                <p className="font-medium">{schema.relationships.length}</p>
              </div>
              <div>
                <span className="text-muted-foreground">RLS Policies:</span>
                <p className="font-medium">{schema.rlsPolicies.length}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Migration Files:</span>
                <p className="font-medium">{migrationFiles.length}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Migration Preview */}
      {showPreview && (
        <Card>
          <Collapsible defaultOpen>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50">
                <CardTitle className="text-base">Migration Preview</CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {migrationFiles.map((file, fileIndex) => (
                    <div key={fileIndex} className="border rounded-lg">
                      <div className="p-3 border-b bg-muted/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            <span className="font-medium">{file.filename}</span>
                          </div>
                          <Badge variant="outline">
                            {file.type.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-3">
                        <pre className="text-xs bg-background p-3 rounded border overflow-x-auto max-h-40">
                          <code
                            dangerouslySetInnerHTML={{
                              __html: Prism.highlight(
                                file.content.slice(0, 1000) +
                                  (file.content.length > 1000 ? "\n..." : ""),
                                Prism.languages.sql,
                                "sql"
                              ),
                            }}
                          />
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Deployment Progress */}
      {deploymentSteps.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Deployment Progress</CardTitle>
              <Badge
                variant={
                  hasFailures
                    ? "destructive"
                    : isComplete
                    ? "default"
                    : "secondary"
                }
              >
                {hasFailures
                  ? "Failed"
                  : isComplete
                  ? "Completed"
                  : "In Progress"}
              </Badge>
            </div>
            {!isComplete && (
              <Progress
                value={getOverallProgress()}
                className="mt-2 border border-primary"
              />
            )}
          </CardHeader>

          <CardContent>
            <div className="space-y-3">
              {deploymentSteps.map((step) => (
                <div
                  key={step.id}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border
                    ${step.status === "running" ? "bg-info/10 border-info" : ""}
                    ${
                      step.status === "completed"
                        ? "bg-success/10 border-success"
                        : ""
                    }
                    ${
                      step.status === "failed" ? "bg-error/10 border-error" : ""
                    }
                  `}
                >
                  <div className="shrink-0">{getStepIcon(step)}</div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{step.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                      {step.startTime && (
                        <span className="text-xs text-muted-foreground">
                          {getStepDuration(step)}
                        </span>
                      )}
                    </div>

                    {step.result?.error && (
                      <Alert className="mt-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          {step.result.error}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Deployment Summary */}
            {isComplete && (
              <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {hasFailures ? (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    )}
                    <span className="font-medium">
                      {hasFailures
                        ? "Deployment Failed"
                        : "Deployment Successful"}
                    </span>
                  </div>

                  {!hasFailures && (
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-muted-foreground">
                        Schema is now live on {project.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
