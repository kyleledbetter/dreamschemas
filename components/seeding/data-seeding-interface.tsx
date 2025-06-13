/**
 * Data Seeding Interface for Phase 10
 * Integrates seamlessly with existing workflow without breaking changes
 */

"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSeedingStream } from "@/hooks/use-seeding-stream";
import { StorageManager } from "@/lib/seeding/storage-manager";
import { ProjectData, ProjectStorage } from "@/lib/storage/project-storage";
import { getSupabaseOAuth, type OAuthState } from "@/lib/supabase/oauth";
import { cn } from "@/lib/utils";
import type { DatabaseSchema } from "@/types/schema.types";
import type {
  FileUpload,
  SeedingConfiguration,
  SeedingJob,
  SeedingProgress,
} from "@/types/seeding.types";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileText,
  Info,
  Loader2,
  Plus,
  TrendingUp,
  Upload,
  Users,
  X,
  Zap,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

interface DataSeedingInterfaceProps {
  schema: DatabaseSchema;
  projectId: string;
  onSeedingComplete?: (result: {
    success: boolean;
    statistics?: unknown;
  }) => void;
  onSeedingProgress?: (progress: SeedingProgress) => void;
  className?: string;
}

export function DataSeedingInterface({
  schema,
  projectId,
  onSeedingComplete,
  onSeedingProgress,
  className = "",
}: DataSeedingInterfaceProps) {
  const [activeTab, setActiveTab] = useState<
    "upload" | "configure" | "progress"
  >("upload");
  const [files, setFiles] = useState<FileUpload[]>([]);
  const [seedingJobs, setSeedingJobs] = useState<SeedingJob[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>(
    {}
  );
  const [seedingProgress, setSeedingProgress] =
    useState<SeedingProgress | null>(null);
  const [debugInfo, setDebugInfo] = useState<{
    storedProject: ProjectData | null;
    passedProject: string;
  }>({
    storedProject: null,
    passedProject: projectId,
  });

  // OAuth state for accessing user's Supabase project
  const [oauthState, setOauthState] = useState<OAuthState>({
    isConnected: false,
    isLoading: false,
  });

  // Debug project data availability
  const projectData = ProjectStorage.getProjectId(projectId);
  console.log("DataSeedingInterface - Project data:", {
    projectData,
    passedProject: projectId,
  });

  // Default seeding configuration
  const [configuration, setConfiguration] = useState<SeedingConfiguration>({
    mode: "append",
    batchSize: 1000,
    maxErrors: 100,
    skipOnError: true,
    validateForeignKeys: true,
    handleDuplicates: "skip",
    dataTransformations: [],
    customValidations: [],
    parallelProcessing: false,
    maxConcurrency: 2,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize StorageManager
  const storageManager = new StorageManager();

  // Subscribe to OAuth state
  useEffect(() => {
    const oauth = getSupabaseOAuth();
    const unsubscribe = oauth.subscribe(setOauthState);
    return unsubscribe;
  }, []);

  // Debug project data availability
  useEffect(() => {
    const storedProject = ProjectStorage.retrieve();
    setDebugInfo({
      storedProject,
      passedProject: projectId,
    });
  }, [projectId]);

  // Streaming seeding hook
  const {
    isProcessing: isStreamingSeeding,
    error: streamError,
    startSeeding: startStreamSeeding,
    stopSeeding: stopStreamSeeding,
    reset: resetStream,
  } = useSeedingStream({
    onProgress: (progress) => {
      setSeedingProgress(progress);
      onSeedingProgress?.(progress);

      // Update seeding job status
      setSeedingJobs((prev) =>
        prev.map((job) => ({
          ...job,
          processedRows: progress.statistics?.processedRows || 0,
          successfulRows: progress.statistics?.successfulRows || 0,
          failedRows: progress.statistics?.failedRows || 0,
          status: progress.status,
          updatedAt: new Date(),
        }))
      );
    },
    onComplete: (result) => {
      if (result.success) {
        setSeedingJobs((prev) =>
          prev.map((job) => ({
            ...job,
            status: "completed" as const,
            completedAt: new Date(),
          }))
        );

        onSeedingComplete?.({
          success: true,
          statistics: result.data,
        });
      }
    },
    onError: (error) => {
      console.error("Seeding stream error:", error);
      setSeedingJobs((prev) =>
        prev.map((job) => ({
          ...job,
          status: "failed" as const,
          error: error.message,
          updatedAt: new Date(),
        }))
      );

      onSeedingComplete?.({
        success: false,
      });
    },
  });

  // Initialize storage on component mount
  useEffect(() => {
    const initStorage = async () => {
      // Only proceed if we have OAuth connection and project ID
      if (!oauthState.isConnected || !oauthState.accessToken || !projectId) {
        console.log("Waiting for OAuth connection and project ID...");
        return;
      }

      try {
        console.log("Creating csv-uploads bucket for user's project...");
        await createBucket();
      } catch (error) {
        console.error("Storage initialization failed:", error);
      }
    };

    const createBucket = async () => {
      if (!oauthState.accessToken) {
        throw new Error("No OAuth access token available");
      }

      try {
        console.log("Creating csv-uploads bucket via API...");
        const response = await fetch("/api/storage/create-bucket", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${oauthState.accessToken}`,
          },
          body: JSON.stringify({
            projectId: projectId,
          }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          console.log("✅ Bucket created successfully:", result.message);
        } else {
          console.error("❌ Failed to create bucket:", result.error);
        }
      } catch (error) {
        console.error("❌ Error creating bucket:", error);
      }
    };

    initStorage();
  }, [oauthState.isConnected, oauthState.accessToken, projectId]);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files || []);

      if (selectedFiles.length === 0) return;

      // Validate files
      const validFiles = selectedFiles.filter((file) => {
        const isCSV =
          file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");
        const isValidSize = file.size <= 150 * 1024 * 1024; // 150MB
        return isCSV && isValidSize;
      });

      if (validFiles.length !== selectedFiles.length) {
        console.warn("Some files were invalid and skipped");
      }

      if (validFiles.length === 0) return;

      setIsUploading(true);

      // Ensure bucket exists before uploading files
      console.log("Ensuring csv-uploads bucket exists before file upload...");
      try {
        const bucketResponse = await fetch("/api/storage/create-bucket", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${oauthState.accessToken}`,
          },
          body: JSON.stringify({
            projectId: projectId,
          }),
        });

        const bucketResult = await bucketResponse.json();
        if (!bucketResponse.ok) {
          console.error("Failed to ensure bucket exists:", bucketResult.error);
          setIsUploading(false);
          return;
        }
        console.log("Bucket ready:", bucketResult.message);
      } catch (error) {
        console.error("Error ensuring bucket exists:", error);
        setIsUploading(false);
        return;
      }

      // Upload files to user's Supabase project using API route
      for (const file of validFiles) {
        try {
          if (!oauthState.accessToken) {
            console.error("No OAuth access token available for upload");
            continue;
          }

          const fileId = `file_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          const filePath = `current_user/${projectId}/${fileId}/${file.name}`;

          console.log(`Uploading file to user's project: ${filePath}`);

          // Create FormData for file upload
          const formData = new FormData();
          formData.append("file", file);
          formData.append("projectId", projectId);
          formData.append("filePath", filePath);

          // Upload to user's Supabase project via API
          const response = await fetch("/api/storage/upload", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${oauthState.accessToken}`,
            },
            body: formData,
          });

          if (!response.ok) {
            const error = await response.text();
            console.error(`Failed to upload ${file.name}:`, error);
            continue;
          }

          const result = await response.json();
          console.log(`Successfully uploaded ${file.name}:`, result);

          // Create FileUpload object for state management
          const fileUpload: FileUpload = {
            id: fileId,
            userId: "current_user",
            projectId,
            filename: file.name,
            originalName: file.name,
            size: file.size,
            mimeType: file.type || "text/csv",
            storagePath: filePath,
            uploadStatus: "completed",
            chunks: [],
            totalChunks: 0,
            completedChunks: 0,
            uploadProgress: 100,
            metadata: {
              headers: [],
              totalRows: 0,
              sampleRows: [],
              estimatedTypes: {},
              encoding: "utf-8",
              delimiter: ",",
              hasHeader: true,
              fileSize: file.size,
              checksums: { md5: "", sha256: "" },
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          setFiles((prev) => [...prev, fileUpload]);
          setUploadProgress((prev) => ({
            ...prev,
            [fileId]: 100,
          }));

          // Update configuration with the uploaded file info
          setConfiguration((prev) => ({
            ...prev,
            // Store the file info for the seeding process
          }));
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
        }
      }

      setIsUploading(false);
    },
    [projectId, storageManager, oauthState.accessToken]
  );

  const removeFile = useCallback((fileId: string) => {
    setFiles((prev: FileUpload[]) => prev.filter((f) => f.id !== fileId));
    setUploadProgress((prev) => {
      const updated = { ...prev };
      delete updated[fileId];
      return updated;
    });
  }, []);

  const startSeeding = useCallback(async () => {
    if (files.length === 0) return;

    setActiveTab("progress");
    setIsUploading(true);

    try {
      // Simulate file upload progress
      for (let progress = 0; progress <= 100; progress += 10) {
        setUploadProgress((prev) => ({
          ...prev,
          [files[0].id]: progress,
        }));
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      setIsUploading(false);

      // Create seeding job
      const seedingJob: SeedingJob = {
        id: `job_${Date.now()}`,
        userId: "current_user",
        projectId,
        fileId: files[0].id,
        fileUpload: files[0],
        schemaId: schema.id,
        schema: {
          ...schema,
          projectId: projectId, // Ensure schema has project ID
        },
        status: "processing",
        totalRows: files[0].metadata.totalRows || 0,
        processedRows: 0,
        successfulRows: 0,
        failedRows: 0,
        errors: [],
        warnings: [],
        statistics: {
          totalFiles: files.length,
          totalRows: files[0].metadata.totalRows || 0,
          processedRows: 0,
          successfulRows: 0,
          failedRows: 0,
          skippedRows: 0,
          duplicatesFound: 0,
          duplicatesResolved: 0,
          tablesProcessed: [],
          averageRowsPerSecond: 0,
          peakRowsPerSecond: 0,
          memoryUsage: { peak: 0, average: 0, current: 0 },
          processingTime: { total: 0, parsing: 0, validation: 0, insertion: 0 },
        },
        configuration,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setSeedingJobs([seedingJob]);

      // Start streaming seeding process
      await startStreamSeeding(seedingJob);
    } catch (error) {
      setIsUploading(false);
      console.error("Seeding failed:", error);
    }
  }, [files, projectId, schema, configuration, startStreamSeeding]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Seeding
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Upload CSV files to populate your {schema.name} schema with data
              </p>
            </div>

            <div className="flex items-center gap-2">
              {files.length > 0 && !isStreamingSeeding && (
                <Button
                  onClick={startSeeding}
                  disabled={
                    isUploading ||
                    seedingJobs.some((j) => j.status === "processing")
                  }
                  className="gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Seed Data
                </Button>
              )}
              {isStreamingSeeding && (
                <Button
                  onClick={stopStreamSeeding}
                  variant="destructive"
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Stop Seeding
                </Button>
              )}
              {streamError && (
                <Button
                  onClick={resetStream}
                  variant="outline"
                  className="gap-2"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Debug Info - Development only */}
          {process.env.NODE_ENV === "development" && (
            <Alert className="mt-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Debug Info:</strong>
                Passed: &quot;{debugInfo.passedProject || "missing"}&quot; |
                Stored: &quot;{debugInfo.storedProject?.projectId || "missing"}
                &quot; | Schema: &quot;{schema.projectId || "missing"}&quot; |
                Final: &quot;
                {ProjectStorage.getProjectId(
                  schema.projectId || debugInfo.passedProject
                ) || "missing"}
                &quot;
              </AlertDescription>
            </Alert>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">
                {schema.tables.length}
              </p>
              <p className="text-xs text-muted-foreground">Target Tables</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-green-600">
                {files.length}
              </p>
              <p className="text-xs text-muted-foreground">Files Ready</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">
                {formatBytes(files.reduce((sum, f) => sum + f.size, 0))}
              </p>
              <p className="text-xs text-muted-foreground">Total Size</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">
                {seedingJobs.filter((j) => j.status === "completed").length}
              </p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Main Content */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as typeof activeTab)}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">Upload Files</TabsTrigger>
          <TabsTrigger value="configure">Configure</TabsTrigger>
          <TabsTrigger value="progress" className="relative">
            Progress
            {seedingJobs.some((j) => j.status === "processing") && (
              <Badge className="ml-2 bg-orange-600 text-white text-xs">
                Running
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>Upload CSV Files</CardTitle>
              <p className="text-sm text-muted-foreground">
                Select CSV files to upload. Files can be up to 150MB each.
              </p>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* OAuth Connection Check */}
              {!oauthState.isConnected && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please connect to your Supabase account first to upload
                    files to your project.
                  </AlertDescription>
                </Alert>
              )}

              {/* File Upload Area */}
              <div
                className={cn(
                  "border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center transition-colors",
                  oauthState.isConnected
                    ? "cursor-pointer hover:border-muted-foreground/50"
                    : "opacity-50 cursor-not-allowed"
                )}
                onClick={() =>
                  oauthState.isConnected && fileInputRef.current?.click()
                }
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">Upload CSV Files</h3>
                <p className="text-muted-foreground mb-4">
                  {oauthState.isConnected
                    ? "Click to select files or drag and drop"
                    : "Connect to Supabase to upload files"}
                </p>
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={!oauthState.isConnected}
                >
                  <Plus className="h-4 w-4" />
                  Select Files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".csv,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={!oauthState.isConnected}
                />
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Selected Files</h4>
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{file.originalName}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatBytes(file.size)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {file.uploadStatus}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(file.id)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configure">
          <Card>
            <CardHeader>
              <CardTitle>Seeding Configuration</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure how your data should be processed and inserted
              </p>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Seeding Mode */}
              <div>
                <h4 className="font-medium mb-3">Seeding Mode</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      value: "append",
                      label: "Append",
                      desc: "Add new rows without modifying existing data",
                    },
                    {
                      value: "overwrite",
                      label: "Overwrite",
                      desc: "Replace all existing data",
                    },
                    {
                      value: "update",
                      label: "Update",
                      desc: "Update existing rows and add new ones",
                    },
                    {
                      value: "skip_duplicates",
                      label: "Skip Duplicates",
                      desc: "Skip duplicate entries",
                    },
                  ].map((mode) => (
                    <div
                      key={mode.value}
                      className={cn(
                        "p-3 border rounded-lg cursor-pointer transition-colors",
                        configuration.mode === mode.value
                          ? "border-primary bg-primary/5"
                          : "hover:border-muted-foreground"
                      )}
                      onClick={() =>
                        setConfiguration((prev) => ({
                          ...prev,
                          mode: mode.value as SeedingConfiguration["mode"],
                        }))
                      }
                    >
                      <h5 className="font-medium">{mode.label}</h5>
                      <p className="text-xs text-muted-foreground">
                        {mode.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Batch Configuration */}
              <div>
                <h4 className="font-medium mb-3">Processing Options</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Batch Size</label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Number of rows to process at once
                    </p>
                    <select
                      value={configuration.batchSize}
                      onChange={(e) =>
                        setConfiguration((prev) => ({
                          ...prev,
                          batchSize: parseInt(e.target.value),
                        }))
                      }
                      className="w-full p-2 border rounded"
                    >
                      <option value={500}>500 (Fast)</option>
                      <option value={1000}>1,000 (Balanced)</option>
                      <option value={2000}>2,000 (Memory Efficient)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Max Errors</label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Stop processing after this many errors
                    </p>
                    <select
                      value={configuration.maxErrors}
                      onChange={(e) =>
                        setConfiguration((prev) => ({
                          ...prev,
                          maxErrors: parseInt(e.target.value),
                        }))
                      }
                      className="w-full p-2 border rounded"
                    >
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={500}>500</option>
                      <option value={-1}>Unlimited</option>
                    </select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="progress">
          <div className="space-y-4">
            {streamError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Seeding Error:</strong> {streamError.message}
                </AlertDescription>
              </Alert>
            )}

            {isUploading && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Uploading Files
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Progress
                    value={uploadProgress[files[0]?.id] || 0}
                    className="h-2"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    {uploadProgress[files[0]?.id]}% complete
                  </p>
                </CardContent>
              </Card>
            )}

            {seedingJobs.map((job) => (
              <Card key={job.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {job.status === "processing" && (
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                      )}
                      {job.status === "completed" && (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      )}
                      {job.status === "failed" && (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                      )}
                      <CardTitle className="text-base">
                        Seeding Job {job.id.slice(-8)}
                      </CardTitle>
                    </div>

                    <Badge
                      className={cn(
                        job.status === "completed" &&
                          "bg-green-100 text-green-800",
                        job.status === "processing" &&
                          "bg-blue-100 text-blue-800",
                        job.status === "failed" && "bg-red-100 text-red-800"
                      )}
                    >
                      {job.status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent>
                  {seedingProgress && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Overall Progress</span>
                          <span>
                            {Math.round(seedingProgress.overallProgress)}%
                          </span>
                        </div>
                        <Progress
                          value={seedingProgress.overallProgress}
                          className="h-2"
                        />
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <p className="text-lg font-bold text-green-600">
                            {job.successfulRows.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Successful
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-red-600">
                            {job.failedRows.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Failed
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-blue-600">
                            {seedingProgress.rowsPerSecond || 0}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Rows/sec
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-purple-600">
                            {seedingProgress.estimatedTimeRemaining
                              ? formatDuration(
                                  seedingProgress.estimatedTimeRemaining
                                )
                              : "--"}
                          </p>
                          <p className="text-xs text-muted-foreground">ETA</p>
                        </div>
                      </div>

                      {seedingProgress.currentTable && (
                        <Alert>
                          <TrendingUp className="h-4 w-4" />
                          <AlertDescription>
                            Currently processing table:{" "}
                            <strong>{seedingProgress.currentTable}</strong>
                            {seedingProgress.currentBatch && (
                              <> (Batch {seedingProgress.currentBatch})</>
                            )}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {!isUploading && seedingJobs.length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    No seeding jobs started yet. Upload files and configure
                    settings to begin.
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
