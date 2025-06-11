"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Play,
  Database,
  Clock,
  AlertCircle,
  CheckCircle2,
  TestTube,
  RefreshCw,
  FileText,
  BarChart3,
  Zap,
  Link,
  Info,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { QueryInterface } from "./query-interface";
import {
  getPGLiteManager,
  type SchemaTestResult,
  type PGLiteTestResult,
} from "@/lib/db/pglite-instance";
import {
  generateSchemaTestSuites,
  type TestSuite,
  type ValidationTest,
} from "@/lib/db/test-queries";
import type { DatabaseSchema } from "@/types/schema.types";
import type { CSVParseResult } from "@/types/csv.types";

interface SchemaTestingInterfaceProps {
  schema: DatabaseSchema;
  csvData?: CSVParseResult[];
  onSchemaUpdate?: (schema: DatabaseSchema) => void;
  className?: string;
}

interface TestExecution {
  testId: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: PGLiteTestResult;
  startTime?: number;
}

export function SchemaTestingInterface({
  schema,
  csvData,
  className = "",
}: SchemaTestingInterfaceProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [schemaTestResult, setSchemaTestResult] =
    useState<SchemaTestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testSuites] = useState(() =>
    generateSchemaTestSuites(schema, csvData)
  );
  const [activeTab, setActiveTab] = useState<"overview" | "suites" | "query">(
    "overview"
  );
  const [testExecutions, setTestExecutions] = useState<
    Map<string, TestExecution>
  >(new Map());
  const [expandedSuites, setExpandedSuites] = useState<Set<string>>(
    new Set(["structure_tests"])
  );

  const pgliteManager = getPGLiteManager();

  const initializeDatabase = useCallback(async () => {
    if (isInitializing) return;

    setIsInitializing(true);
    try {
      await pgliteManager.ensureInitialized();
      setIsInitialized(true);
    } catch (error) {
      console.error("Failed to initialize database:", error);
    } finally {
      setIsInitializing(false);
    }
  }, [pgliteManager, isInitializing]);

  const runSchemaTest = useCallback(async () => {
    if (!isInitialized || isTesting) return;

    setIsTesting(true);
    setSchemaTestResult(null);

    try {
      const result = await pgliteManager.testSchema(schema, csvData);
      setSchemaTestResult(result);
    } catch (error) {
      console.error("Schema test failed:", error);
    } finally {
      setIsTesting(false);
    }
  }, [isInitialized, isTesting, pgliteManager, schema, csvData]);

  const runTestSuite = useCallback(
    async (testSuite: TestSuite) => {
      if (!isInitialized) return;

      // Mark all tests in suite as running
      const newExecutions = new Map(testExecutions);
      testSuite.tests.forEach((test) => {
        newExecutions.set(test.id, {
          testId: test.id,
          status: "running",
          startTime: Date.now(),
        });
      });
      setTestExecutions(newExecutions);

      // Execute tests sequentially
      for (const test of testSuite.tests) {
        try {
          const result = await pgliteManager.execute(test.query);

          const currentExecution = newExecutions.get(test.id);
          const updatedExecution: TestExecution = {
            testId: test.id,
            status: result.success ? "completed" : "failed",
            result,
          };
          if (currentExecution?.startTime !== undefined) {
            updatedExecution.startTime = currentExecution.startTime;
          }
          newExecutions.set(test.id, updatedExecution);
          setTestExecutions(new Map(newExecutions));
        } catch (error) {
          const errorResult: PGLiteTestResult = {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            executionTime: 0,
            query: test.query,
          };

          const currentExecution = newExecutions.get(test.id);
          const updatedExecution: TestExecution = {
            testId: test.id,
            status: "failed",
            result: errorResult,
          };
          if (currentExecution?.startTime !== undefined) {
            updatedExecution.startTime = currentExecution.startTime;
          }
          newExecutions.set(test.id, updatedExecution);
          setTestExecutions(new Map(newExecutions));
        }
      }
    },
    [isInitialized, testExecutions, pgliteManager]
  );

  const runSingleTest = useCallback(
    async (test: ValidationTest) => {
      if (!isInitialized) return;

      const newExecutions = new Map(testExecutions);
      newExecutions.set(test.id, {
        testId: test.id,
        status: "running",
        startTime: Date.now(),
      });
      setTestExecutions(newExecutions);

      try {
        const result = await pgliteManager.execute(test.query);

        const currentExecution = newExecutions.get(test.id);
        const updatedExecution: TestExecution = {
          testId: test.id,
          status: result.success ? "completed" : "failed",
          result,
        };
        if (currentExecution?.startTime !== undefined) {
          updatedExecution.startTime = currentExecution.startTime;
        }
        newExecutions.set(test.id, updatedExecution);
        setTestExecutions(new Map(newExecutions));
      } catch (error) {
        const errorResult: PGLiteTestResult = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          executionTime: 0,
          query: test.query,
        };

        const currentExecution = newExecutions.get(test.id);
        const updatedExecution: TestExecution = {
          testId: test.id,
          status: "failed",
          result: errorResult,
        };
        if (currentExecution?.startTime !== undefined) {
          updatedExecution.startTime = currentExecution.startTime;
        }
        newExecutions.set(test.id, updatedExecution);
        setTestExecutions(new Map(newExecutions));
      }
    },
    [isInitialized, testExecutions, pgliteManager]
  );

  const executeCustomQuery = useCallback(
    async (query: string): Promise<PGLiteTestResult> => {
      if (!isInitialized) {
        throw new Error("Database not initialized");
      }

      return pgliteManager.execute(query);
    },
    [isInitialized, pgliteManager]
  );

  const toggleSuiteExpansion = useCallback((suiteId: string) => {
    setExpandedSuites((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(suiteId)) {
        newSet.delete(suiteId);
      } else {
        newSet.add(suiteId);
      }
      return newSet;
    });
  }, []);

  useEffect(() => {
    initializeDatabase();
  }, [initializeDatabase]);

  const getCategoryIcon = (category: ValidationTest["category"]) => {
    switch (category) {
      case "structure":
        return <Database className="h-4 w-4" />;
      case "data":
        return <FileText className="h-4 w-4" />;
      case "constraints":
        return <Link className="h-4 w-4" />;
      case "relationships":
        return <Link className="h-4 w-4" />;
      case "performance":
        return <Zap className="h-4 w-4" />;
      default:
        return <TestTube className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: ValidationTest["severity"]) => {
    switch (severity) {
      case "error":
        return "text-red-600";
      case "warning":
        return "text-yellow-600";
      case "info":
        return "text-blue-600";
      default:
        return "text-gray-600";
    }
  };

  const getTestStatusIcon = (testId: string) => {
    const execution = testExecutions.get(testId);

    if (!execution) {
      return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
    }

    switch (execution.status) {
      case "running":
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case "completed":
        return execution.result?.success ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : (
          <XCircle className="h-4 w-4 text-red-600" />
        );
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return (
          <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
        );
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TestTube className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Schema Testing</h2>
              <p className="text-sm text-muted-foreground">
                Validate your schema with browser-based PostgreSQL testing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={isInitialized ? "default" : "secondary"}>
              {isInitialized ? "Ready" : "Initializing..."}
            </Badge>

            <Button
              onClick={runSchemaTest}
              disabled={!isInitialized || isTesting}
              className="gap-2"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Full Test
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1">
          {[
            { id: "overview", label: "Overview", icon: BarChart3 },
            { id: "suites", label: "Test Suites", icon: TestTube },
            { id: "query", label: "Query Console", icon: Database },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className="gap-2"
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="p-4 space-y-4">
            {!isInitialized && (
              <Card>
                <CardContent className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Initializing PGLite database...
                  </p>
                </CardContent>
              </Card>
            )}

            {isInitialized && !schemaTestResult && (
              <Card>
                <CardContent className="text-center py-8">
                  <TestTube className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-medium mb-2">Ready to Test</h3>
                  <p className="text-muted-foreground mb-4">
                    Run a full schema test to validate your database structure
                  </p>
                  <Button onClick={runSchemaTest} className="gap-2">
                    <Play className="h-4 w-4" />
                    Run Full Test
                  </Button>
                </CardContent>
              </Card>
            )}

            {schemaTestResult && (
              <div className="space-y-4">
                {/* Test Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {schemaTestResult.schemaValid ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                      Test Results Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {schemaTestResult.tablesCreated}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Tables Created
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">
                          {schemaTestResult.relationshipsCreated}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Relationships
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-600">
                          {schemaTestResult.indexesCreated}
                        </p>
                        <p className="text-sm text-muted-foreground">Indexes</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-600">
                          {schemaTestResult.sampleDataInserted}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Sample Rows
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {schemaTestResult.executionTime}ms
                      </div>
                      <div className="flex items-center gap-1">
                        <TestTube className="h-3 w-3" />
                        {schemaTestResult.testQueries.length} queries executed
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Errors and Warnings */}
                {(schemaTestResult.errors.length > 0 ||
                  schemaTestResult.warnings.length > 0) && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Issues Found</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {schemaTestResult.errors.map((error, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded"
                        >
                          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-red-800">
                              Error
                            </p>
                            <p className="text-sm text-red-700">{error}</p>
                          </div>
                        </div>
                      ))}

                      {schemaTestResult.warnings.map((warning, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded"
                        >
                          <Info className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-yellow-800">
                              Warning
                            </p>
                            <p className="text-sm text-yellow-700">{warning}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {/* Test Suites Tab */}
        {activeTab === "suites" && (
          <div className="p-4 space-y-4">
            {testSuites.map((testSuite) => (
              <Card key={testSuite.id}>
                <Collapsible
                  open={expandedSuites.has(testSuite.id)}
                  onOpenChange={() => toggleSuiteExpansion(testSuite.id)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {getCategoryIcon(
                              testSuite.tests[0]?.category || "structure"
                            )}
                            {testSuite.name}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {testSuite.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {testSuite.tests.length} tests
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              runTestSuite(testSuite);
                            }}
                            disabled={!isInitialized}
                            className="gap-2"
                          >
                            <Play className="h-4 w-4" />
                            Run Suite
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {testSuite.tests.map((test) => {
                          const execution = testExecutions.get(test.id);

                          return (
                            <div
                              key={test.id}
                              className="flex items-center justify-between p-3 border rounded hover:bg-muted/30"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                {getTestStatusIcon(test.id)}
                                <div className="flex-1">
                                  <p className="font-medium text-sm">
                                    {test.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {test.description}
                                  </p>
                                  {execution?.result?.error && (
                                    <p className="text-xs text-red-600 mt-1">
                                      {execution.result.error}
                                    </p>
                                  )}
                                </div>
                                <Badge
                                  variant="outline"
                                  className={getSeverityColor(test.severity)}
                                >
                                  {test.severity}
                                </Badge>
                              </div>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => runSingleTest(test)}
                                disabled={
                                  !isInitialized ||
                                  execution?.status === "running"
                                }
                                className="gap-2 ml-2"
                              >
                                {execution?.status === "running" ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Play className="h-3 w-3" />
                                )}
                                Run
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))}
          </div>
        )}

        {/* Query Console Tab */}
        {activeTab === "query" && isInitialized && (
          <QueryInterface
            onExecuteQuery={executeCustomQuery}
            isExecuting={false}
          />
        )}

        {activeTab === "query" && !isInitialized && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Initializing database for query execution...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
