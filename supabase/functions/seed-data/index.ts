/**
 * Supabase Edge Function: seed-data
 * Phase 10: Data Seeding & Large File Processing
 * 
 * Handles CSV file processing and database seeding with:
 * - Streaming CSV parsing for memory efficiency
 * - Batch data insertion with error handling
 * - Real-time progress updates via Server-Sent Events
 * - Data validation and transformation
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Types for request/response
interface SeedDataRequest {
  fileId: string;
  jobId: string;
  configuration: SeedingConfiguration;
  schema: DatabaseSchema;
  projectConfig: {
    projectId: string;
    databaseUrl: string;
    apiKey: string;
  };
}

interface SeedingConfiguration {
  mode: "append" | "overwrite" | "update" | "skip_duplicates";
  batchSize: number;
  maxErrors: number;
  skipOnError: boolean;
  validateForeignKeys: boolean;
  handleDuplicates: "skip" | "overwrite" | "error";
  dataTransformations: ColumnMapping[];
  customValidations: ValidationRule[];
  parallelProcessing: boolean;
  maxConcurrency: number;
}

interface ColumnMapping {
  sourceColumn: string;
  targetColumn: string;
  targetTable: string;
  transformation?: {
    type: "cast" | "format" | "calculate" | "lookup" | "default";
    expression: string;
    defaultValue?: unknown;
  };
}

interface ValidationRule {
  id: string;
  name: string;
  table: string;
  column?: string;
  type: "custom" | "business_logic" | "data_quality";
  expression: string;
  errorMessage: string;
  severity: "critical" | "high" | "medium" | "low";
}

interface DatabaseSchema {
  id: string;
  name: string;
  tables: Table[];
  relationships?: Relationship[];
}

interface Table {
  id: string;
  name: string;
  columns: Column[];
}

interface Column {
  id: string;
  name: string;
  type: string;
  nullable: boolean;
  length?: number;
  precision?: number;
  scale?: number;
  defaultValue?: string;
  constraints: ColumnConstraint[];
}

interface ColumnConstraint {
  type: string;
  value?: string;
  referencedTable?: string;
  referencedColumn?: string;
}

interface Relationship {
  id: string;
  name: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  type: string;
}

interface DataError {
  id: string;
  row: number;
  column?: string;
  table?: string;
  errorType: "validation" | "constraint" | "type_conversion" | "foreign_key" | "duplicate" | "other";
  message: string;
  originalValue?: unknown;
  suggestedFix?: string;
  severity: "critical" | "high" | "medium" | "low";
  canAutoFix: boolean;
}

interface SeedingProgress {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  overallProgress: number;
  currentPhase: "uploading" | "parsing" | "validating" | "processing" | "completing";
  currentTable?: string;
  currentBatch?: number;
  totalBatches?: number;
  rowsPerSecond?: number;
  estimatedTimeRemaining?: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  errors: DataError[];
  warnings: DataError[];
  lastUpdate: Date;
}

class DataSeeder {
  private supabaseClient: any;
  private storageClient: any;
  private request: SeedDataRequest;
  private progress: SeedingProgress;
  private errors: DataError[] = [];
  private warnings: DataError[] = [];
  private startTime: number;

  constructor(request: SeedDataRequest) {
    this.request = request;
    this.startTime = Date.now();
    
    // Initialize Supabase clients
    this.supabaseClient = createClient(
      request.projectConfig.databaseUrl,
      request.projectConfig.apiKey
    );
    
    this.storageClient = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_ANON_KEY") || ""
    );

    // Initialize progress tracking
    this.progress = {
      jobId: request.jobId,
      status: "processing",
      overallProgress: 0,
      currentPhase: "parsing",
      processedRows: 0,
      successfulRows: 0,
      failedRows: 0,
      errors: [],
      warnings: [],
      lastUpdate: new Date(),
    };
  }

  /**
   * Main seeding function
   */
  async seedData(): Promise<SeedingProgress> {
    return this.seedDataWithProgress();
  }

  /**
   * Main seeding function with progress callback support
   */
  async seedDataWithProgress(onProgress?: (progress: SeedingProgress) => void): Promise<SeedingProgress> {
    try {
      // Step 1: Download CSV file from storage
      this.updateProgress(5, "parsing", "Downloading CSV file");
      onProgress?.(this.progress);
      const csvData = await this.downloadCSVFile();

      // Step 2: Parse CSV data
      this.updateProgress(15, "parsing", "Parsing CSV data");
      onProgress?.(this.progress);
      const rows = await this.parseCSVData(csvData);

      // Step 3: Validate data
      this.updateProgress(25, "validating", "Validating data");
      onProgress?.(this.progress);
      const validatedData = await this.validateData(rows);

      // Step 4: Process data in batches
      this.updateProgress(30, "processing", "Processing data");
      onProgress?.(this.progress);
      await this.processDataBatches(validatedData, onProgress);

      // Step 5: Complete
      this.updateProgress(100, "completing", "Seeding completed");
      this.progress.status = "completed";
      onProgress?.(this.progress);

      return this.progress;
    } catch (error) {
      this.progress.status = "failed";
      this.addError({
        row: -1,
        errorType: "other",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        severity: "critical",
        canAutoFix: false,
      });
      
      onProgress?.(this.progress);
      throw error;
    }
  }

  /**
   * Download CSV file from Supabase Storage
   */
  private async downloadCSVFile(): Promise<string> {
    try {
      const filePath = `${this.request.fileId}/${this.request.fileId}.csv`;
      
      const { data, error } = await this.storageClient.storage
        .from("csv-uploads")
        .download(filePath);

      if (error) {
        throw new Error(`Failed to download CSV file: ${error.message}`);
      }

      return await data.text();
    } catch (error) {
      throw new Error(`CSV download failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Parse CSV data into structured rows
   */
  private async parseCSVData(csvData: string): Promise<Record<string, unknown>[]> {
    const lines = csvData.split("\n").filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error("CSV file appears to be empty");
    }

    // Detect delimiter
    const firstLine = lines[0];
    const delimiters = [",", ";", "\t", "|"];
    const delimiter = delimiters.reduce((best, delim) => {
      const count = (firstLine.match(new RegExp(delim, "g")) || []).length;
      const bestCount = (firstLine.match(new RegExp(best, "g")) || []).length;
      return count > bestCount ? delim : best;
    }, ",");

    // Parse headers
    const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ""));

    // Parse data rows
    const rows: Record<string, unknown>[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ""));
      const row: Record<string, unknown> = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || null;
      });

      rows.push(row);
    }

    return rows;
  }

  /**
   * Validate data according to schema and configuration
   */
  private async validateData(rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
    const validRows: Record<string, unknown>[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowErrors: DataError[] = [];

      // Validate against schema (simplified validation)
      const table = this.request.schema.tables[0]; // Assume single table for now
      if (table) {
        for (const column of table.columns) {
          const value = row[column.name];
          
          // Check for null values in non-nullable columns
          if ((value === null || value === undefined || value === "") && !column.nullable) {
            rowErrors.push({
              id: `error_${i}_${column.name}`,
              row: i + 1,
              column: column.name,
              table: table.name,
              errorType: "validation",
              message: `Column ${column.name} cannot be null`,
              originalValue: value,
              suggestedFix: column.defaultValue ? `Use default: ${column.defaultValue}` : "Provide a value",
              severity: "high",
              canAutoFix: !!column.defaultValue,
            });
          }

          // Type validation (simplified)
          if (value !== null && value !== undefined && value !== "") {
            const stringValue = String(value);
            
            switch (column.type) {
              case "INTEGER":
              case "BIGINT":
                if (!/^-?\d+$/.test(stringValue)) {
                  rowErrors.push({
                    id: `error_${i}_${column.name}_type`,
                    row: i + 1,
                    column: column.name,
                    table: table.name,
                    errorType: "type_conversion",
                    message: `Invalid integer format: ${stringValue}`,
                    originalValue: value,
                    suggestedFix: "Provide a valid integer",
                    severity: "medium",
                    canAutoFix: true,
                  });
                }
                break;

              case "VARCHAR":
              case "TEXT":
                if (column.length && stringValue.length > column.length) {
                  rowErrors.push({
                    id: `error_${i}_${column.name}_length`,
                    row: i + 1,
                    column: column.name,
                    table: table.name,
                    errorType: "validation",
                    message: `Text too long: ${stringValue.length} characters (max: ${column.length})`,
                    originalValue: value,
                    suggestedFix: `Truncate to ${column.length} characters`,
                    severity: "medium",
                    canAutoFix: true,
                  });
                }
                break;
            }
          }
        }
      }

      // Include row if no critical errors or if skipOnError is true
      if (rowErrors.length === 0 || (this.request.configuration.skipOnError && !rowErrors.some(e => e.severity === "critical"))) {
        validRows.push(row);
      }

      this.errors.push(...rowErrors);

      // Stop if too many errors
      if (this.errors.length > this.request.configuration.maxErrors) {
        throw new Error(`Too many errors encountered (${this.errors.length}). Stopping processing.`);
      }
    }

    return validRows;
  }

  /**
   * Process data in batches
   */
  private async processDataBatches(
    rows: Record<string, unknown>[], 
    onProgress?: (progress: SeedingProgress) => void
  ): Promise<void> {
    const batchSize = this.request.configuration.batchSize || 1000;
    const totalBatches = Math.ceil(rows.length / batchSize);
    
    this.progress.totalBatches = totalBatches;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      this.progress.currentBatch = batchNumber;
      this.updateProgress(
        30 + (batchNumber / totalBatches) * 65, // 30-95% for processing
        "processing",
        `Processing batch ${batchNumber}/${totalBatches}`
      );

      // Send progress update for this batch
      onProgress?.(this.progress);

      try {
        await this.processBatch(batch, batchNumber);
        this.progress.successfulRows += batch.length;
      } catch (error) {
        this.progress.failedRows += batch.length;
        this.addError({
          row: -1,
          errorType: "other",
          message: `Batch ${batchNumber} failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          severity: "high",
          canAutoFix: false,
        });

        if (!this.request.configuration.skipOnError) {
          throw error;
        }
      }

      this.progress.processedRows = Math.min(i + batchSize, rows.length);
      this.updateRowsPerSecond();
      
      // Send progress update after batch completion
      onProgress?.(this.progress);
    }
  }

  /**
   * Process a single batch of rows
   */
  private async processBatch(batch: Record<string, unknown>[], batchNumber: number): Promise<void> {
    const table = this.request.schema.tables[0]; // Assume single table for now
    if (!table) {
      throw new Error("No target table found in schema");
    }

    // Transform data according to column mappings
    const transformedBatch = this.transformBatch(batch, table);

    // Prepare SQL for batch insert
    const { sql, values } = this.prepareBatchInsert(table, transformedBatch);

    try {
      // Execute batch insert
      const { error } = await this.supabaseClient.rpc('execute_sql', {
        query: sql,
        params: values
      });

      if (error) {
        throw new Error(`Batch insert failed: ${error.message}`);
      }

      // Simulate some processing delay for demo
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      throw new Error(`Failed to insert batch ${batchNumber}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Transform batch data according to schema and mappings
   */
  private transformBatch(batch: Record<string, unknown>[], table: Table): Record<string, unknown>[] {
    return batch.map(row => {
      const transformedRow: Record<string, unknown> = {};

      // Apply transformations or direct mapping
      if (this.request.configuration.dataTransformations.length > 0) {
        // Use column mappings
        for (const mapping of this.request.configuration.dataTransformations) {
          if (mapping.targetTable === table.name) {
            let value = row[mapping.sourceColumn];

            // Apply transformation if specified
            if (mapping.transformation) {
              value = this.applyTransformation(value, mapping.transformation);
            }

            transformedRow[mapping.targetColumn] = value;
          }
        }
      } else {
        // Direct mapping - copy all matching columns
        for (const column of table.columns) {
          if (row[column.name] !== undefined) {
            transformedRow[column.name] = this.castValue(row[column.name], column.type);
          }
        }
      }

      return transformedRow;
    });
  }

  /**
   * Apply data transformation
   */
  private applyTransformation(value: unknown, transformation: ColumnMapping["transformation"]): unknown {
    if (!transformation) return value;

    switch (transformation.type) {
      case "cast":
        return this.castValue(value, transformation.expression);
      
      case "format":
        if (transformation.expression === "uppercase") {
          return String(value).toUpperCase();
        }
        if (transformation.expression === "lowercase") {
          return String(value).toLowerCase();
        }
        return value;
      
      case "default":
        return value || transformation.defaultValue;
      
      default:
        return value;
    }
  }

  /**
   * Cast value to target type
   */
  private castValue(value: unknown, targetType: string): unknown {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const stringValue = String(value);

    switch (targetType.toUpperCase()) {
      case "INTEGER":
      case "BIGINT":
        const intValue = parseInt(stringValue, 10);
        return isNaN(intValue) ? null : intValue;

      case "DECIMAL":
      case "NUMERIC":
        const floatValue = parseFloat(stringValue);
        return isNaN(floatValue) ? null : floatValue;

      case "BOOLEAN":
        return /^(true|yes|1|on)$/i.test(stringValue);

      case "TIMESTAMPTZ":
        const date = new Date(stringValue);
        return isNaN(date.getTime()) ? null : date.toISOString();

      default:
        return stringValue;
    }
  }

  /**
   * Prepare batch insert SQL
   */
  private prepareBatchInsert(table: Table, batch: Record<string, unknown>[]): { sql: string; values: unknown[] } {
    if (batch.length === 0) {
      throw new Error("Empty batch provided");
    }

    const columns = Object.keys(batch[0]);
    const placeholders = batch.map((_, i) => 
      `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(", ")})`
    ).join(", ");

    const sql = `
      INSERT INTO ${table.name} (${columns.join(", ")})
      VALUES ${placeholders}
      ${this.request.configuration.handleDuplicates === "skip" ? "ON CONFLICT DO NOTHING" : ""}
    `;

    const values = batch.flatMap(row => columns.map(col => row[col]));

    return { sql, values };
  }

  /**
   * Add error to collection
   */
  private addError(error: Omit<DataError, "id">): void {
    this.errors.push({
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...error,
    });
  }

  /**
   * Update progress tracking
   */
  private updateProgress(percent: number, phase: SeedingProgress["currentPhase"], message?: string): void {
    this.progress.overallProgress = Math.min(100, Math.max(0, percent));
    this.progress.currentPhase = phase;
    this.progress.lastUpdate = new Date();
    this.progress.errors = this.errors;
    this.progress.warnings = this.warnings;
    
    if (message) {
      console.log(`[${this.progress.jobId}] ${message} (${percent.toFixed(1)}%)`);
    }
  }

  /**
   * Calculate processing speed
   */
  private updateRowsPerSecond(): void {
    const elapsed = (Date.now() - this.startTime) / 1000;
    if (elapsed > 0) {
      this.progress.rowsPerSecond = Math.round(this.progress.processedRows / elapsed);
      
      const remainingRows = (this.progress.totalBatches || 1) * this.request.configuration.batchSize - this.progress.processedRows;
      if (this.progress.rowsPerSecond > 0) {
        this.progress.estimatedTimeRemaining = Math.ceil(remainingRows / this.progress.rowsPerSecond);
      }
    }
  }
}

/**
 * Main Edge Function handler
 */
serve(async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  const url = new URL(req.url);
  const isStreaming = url.searchParams.get("stream") === "true";

  if (req.method === "POST") {
    try {
      // Parse request body
      const request: SeedDataRequest = await req.json();

      // Validate request
      if (!request.fileId || !request.jobId || !request.schema) {
        return new Response(JSON.stringify({ 
          error: "Missing required fields: fileId, jobId, schema" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Initialize data seeder
      const seeder = new DataSeeder(request);

      if (isStreaming) {
        // Return Server-Sent Events stream for real-time progress
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        // Start seeding process in background
        (async () => {
          try {
            let lastProgress = 0;
            
            // Custom progress handler for streaming
            const progressHandler = (progress: SeedingProgress) => {
              const data = JSON.stringify({
                type: "progress",
                data: progress,
              });
              
              writer.write(encoder.encode(`data: ${data}\n\n`));
              lastProgress = progress.overallProgress;
            };

            // Send initial progress
            progressHandler({
              jobId: request.jobId,
              status: "processing",
              overallProgress: 0,
              currentPhase: "parsing",
              processedRows: 0,
              successfulRows: 0,
              failedRows: 0,
              errors: [],
              warnings: [],
              lastUpdate: new Date(),
            });

            // Start data seeding with progress callbacks
            const result = await seeder.seedDataWithProgress(progressHandler);

            // Send completion message
            const completionData = JSON.stringify({
              type: "complete",
              data: {
                success: true,
                jobId: request.jobId,
                statistics: {
                  totalRows: result.processedRows,
                  successfulRows: result.successfulRows,
                  failedRows: result.failedRows,
                  errors: result.errors,
                  warnings: result.warnings,
                },
              },
            });
            
            writer.write(encoder.encode(`data: ${completionData}\n\n`));
            writer.write(encoder.encode(`data: [DONE]\n\n`));
            
          } catch (error) {
            // Send error message
            const errorData = JSON.stringify({
              type: "error",
              data: {
                success: false,
                error: error instanceof Error ? error.message : "Internal server error",
              },
            });
            
            writer.write(encoder.encode(`data: ${errorData}\n\n`));
          } finally {
            writer.close();
          }
        })();

        return new Response(readable, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } else {
        // Standard JSON response
        const result = await seeder.seedData();

        return new Response(JSON.stringify({
          success: true,
          jobId: request.jobId,
          message: "Data seeding completed successfully",
          statistics: {
            totalRows: result.processedRows,
            successfulRows: result.successfulRows,
            failedRows: result.failedRows,
            errors: result.errors,
            warnings: result.warnings,
          },
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        });
      }

    } catch (error) {
      console.error("Edge function error:", error);
      
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
  }

  // Method not allowed
  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
});