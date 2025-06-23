/**
 * Data Processor for Phase 10: Data Seeding
 * Handles data transformation, validation, and batch processing
 */

import type {
  SeedingJob,
  SeedingConfiguration,
  DataError,
  DataWarning,
  SeedingProgress,
  ColumnMapping,
  SeedingStatistics,
  SeedingAPIResponse,
} from "@/types/seeding.types";
import type { DatabaseSchema, Column } from "@/types/schema.types";
import { generateId } from "@/lib/utils";
import { TYPE_VALIDATORS } from "./constants";

export class DataProcessor {
  private job: SeedingJob;
  private schema: DatabaseSchema;
  private configuration: SeedingConfiguration;
  private statistics: SeedingStatistics;
  private errors: DataError[] = [];
  private warnings: DataWarning[] = [];

  constructor(job: SeedingJob) {
    this.job = job;
    this.schema = job.schema;
    this.configuration = job.configuration;
    this.statistics = {
      totalFiles: 1,
      totalRows: 0,
      processedRows: 0,
      successfulRows: 0,
      failedRows: 0,
      skippedRows: 0,
      duplicatesFound: 0,
      duplicatesResolved: 0,
      tablesProcessed: [],
      averageRowsPerSecond: 0,
      peakRowsPerSecond: 0,
      memoryUsage: {
        peak: 0,
        average: 0,
        current: 0,
      },
      processingTime: {
        total: 0,
        parsing: 0,
        validation: 0,
        insertion: 0,
      },
    };
  }

  /**
   * Process CSV data in batches
   */
  async processData(
    csvData: string,
    onProgress?: (progress: SeedingProgress) => void
  ): Promise<SeedingAPIResponse<SeedingStatistics>> {
    const startTime = Date.now();

    try {
      // Parse CSV data
      const parseStart = Date.now();
      const rows = await this.parseCSVData(csvData);
      this.statistics.processingTime.parsing = Date.now() - parseStart;
      this.statistics.totalRows = rows.length;

      onProgress?.(this.createProgress("parsing", 20));

      // Group rows by target table
      const tableRows = this.groupRowsByTable(rows);
      
      onProgress?.(this.createProgress("validating", 30));

      // Process each table
      let processedCount = 0;
      const totalRows = rows.length;

      for (const [tableName, tableData] of Object.entries(tableRows)) {
        this.statistics.currentTable = tableName;
        this.statistics.tablesProcessed.push(tableName);

        // Validate data for this table
        const validationStart = Date.now();
        const { validRows, errors, warnings } = await this.validateTableData(
          tableName,
          tableData
        );
        this.statistics.processingTime.validation += Date.now() - validationStart;

        this.errors.push(...errors);
        this.warnings.push(...warnings);

        // Process in batches
        const batches = this.createBatches(validRows, this.configuration.batchSize);
        
        for (let i = 0; i < batches.length; i++) {
          const batch = batches[i];
          this.job.currentBatch = i + 1;

          try {
            // Transform data
            const transformedBatch = await this.transformBatch(tableName, batch);

            // Insert batch (this would be done by the Edge Function)
            const insertStart = Date.now();
            const insertResult = await this.simulateInsertBatch(tableName, transformedBatch);
            this.statistics.processingTime.insertion += Date.now() - insertStart;

            this.statistics.successfulRows += insertResult.successfulRows;
            this.statistics.failedRows += insertResult.failedRows;

            processedCount += batch.length;
            this.statistics.processedRows = processedCount;

            // Calculate processing speed
            const elapsed = (Date.now() - startTime) / 1000;
            this.statistics.averageRowsPerSecond = processedCount / elapsed;

            // Update progress
            const progressPercent = 30 + (processedCount / totalRows) * 60; // 30-90% range
            onProgress?.(this.createProgress("processing", progressPercent));

          } catch (error) {
            this.addError({
              row: -1,
              table: tableName,
              errorType: "other",
              message: error instanceof Error ? error.message : "Batch processing failed",
              severity: "critical",
              canAutoFix: false,
            });

            if (!this.configuration.skipOnError) {
              throw error;
            }
          }
        }
      }

      this.statistics.processingTime.total = Date.now() - startTime;
      onProgress?.(this.createProgress("completing", 100));

      return {
        success: true,
        data: this.statistics,
      };

    } catch (error) {
      return {
        success: false,
        error: {
          code: "DATA_PROCESSING_FAILED",
          message: error instanceof Error ? error.message : "Data processing failed",
          details: {
            errors: this.errors,
            warnings: this.warnings,
            statistics: this.statistics,
          },
        },
      };
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

    // Detect delimiter (reuse logic from storage manager)
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
   * Group rows by target table based on column mappings
   */
  private groupRowsByTable(rows: Record<string, unknown>[]): Record<string, Record<string, unknown>[]> {
    const tableRows: Record<string, Record<string, unknown>[]> = {};

    // If no column mappings are specified, assume single table
    if (!this.configuration.dataTransformations || this.configuration.dataTransformations.length === 0) {
      const primaryTable = this.schema.tables[0]?.name || "data";
      tableRows[primaryTable] = rows;
      return tableRows;
    }

    // Group by table based on column mappings
    const tablesByColumn: Record<string, string> = {};
    this.configuration.dataTransformations.forEach(mapping => {
      tablesByColumn[mapping.sourceColumn] = mapping.targetTable;
    });

    // For now, put all rows in the first table (simplification)
    const primaryTable = this.schema.tables[0]?.name || "data";
    tableRows[primaryTable] = rows;

    return tableRows;
  }

  /**
   * Validate data for a specific table
   */
  private async validateTableData(
    tableName: string,
    rows: Record<string, unknown>[]
  ): Promise<{
    validRows: Record<string, unknown>[];
    errors: DataError[];
    warnings: DataWarning[];
  }> {
    const table = this.schema.tables.find(t => t.name === tableName);
    if (!table) {
      throw new Error(`Table ${tableName} not found in schema`);
    }

    const validRows: Record<string, unknown>[] = [];
    const errors: DataError[] = [];
    const warnings: DataWarning[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowErrors: DataError[] = [];
      const rowWarnings: DataWarning[] = [];

      // Validate each column
      for (const column of table.columns) {
        const value = row[column.name];
        const validation = this.validateColumnValue(column, value, i + 1);

        if (validation.errors.length > 0) {
          rowErrors.push(...validation.errors);
        }
        if (validation.warnings.length > 0) {
          rowWarnings.push(...validation.warnings);
        }
      }

      // Check if row should be included
      if (rowErrors.length === 0 || (this.configuration.skipOnError && rowErrors.every(e => e.severity !== "critical"))) {
        validRows.push(row);
      }

      errors.push(...rowErrors);
      warnings.push(...rowWarnings);

      // Stop if too many errors
      if (errors.length > this.configuration.maxErrors) {
        throw new Error(`Too many errors encountered (${errors.length}). Stopping processing.`);
      }
    }

    return { validRows, errors, warnings };
  }

  /**
   * Validate a single column value
   */
  private validateColumnValue(
    column: Column,
    value: unknown,
    rowNumber: number
  ): { errors: DataError[]; warnings: DataWarning[] } {
    const errors: DataError[] = [];
    const warnings: DataWarning[] = [];

    // Check for null values
    if ((value === null || value === undefined || value === "") && !column.nullable) {
      errors.push({
        id: generateId(),
        row: rowNumber,
        column: column.name,
        errorType: "validation",
        message: `Column ${column.name} cannot be null`,
        originalValue: value,
        suggestedFix: column.defaultValue ? `Use default value: ${column.defaultValue}` : "Provide a value",
        severity: "high",
        canAutoFix: !!column.defaultValue,
      });
      return { errors, warnings };
    }

    // Skip validation for null values in nullable columns
    if ((value === null || value === undefined || value === "") && column.nullable) {
      return { errors, warnings };
    }

    // Type-specific validation
    const stringValue = String(value);
    
    switch (column.type) {
      case "UUID":
        if (!TYPE_VALIDATORS.UUID.test(stringValue)) {
          errors.push({
            id: generateId(),
            row: rowNumber,
            column: column.name,
            errorType: "type_conversion",
            message: `Invalid UUID format: ${stringValue}`,
            originalValue: value,
            suggestedFix: "Provide a valid UUID or use uuid_generate_v4()",
            severity: "high",
            canAutoFix: true,
          });
        }
        break;

      case "INTEGER":
      case "BIGINT":
        if (!TYPE_VALIDATORS.INTEGER.test(stringValue)) {
          errors.push({
            id: generateId(),
            row: rowNumber,
            column: column.name,
            errorType: "type_conversion",
            message: `Invalid integer format: ${stringValue}`,
            originalValue: value,
            suggestedFix: "Provide a valid integer number",
            severity: "medium",
            canAutoFix: true,
          });
        }
        break;

      case "DECIMAL":
      case "NUMERIC":
        if (!TYPE_VALIDATORS.DECIMAL.test(stringValue)) {
          errors.push({
            id: generateId(),
            row: rowNumber,
            column: column.name,
            errorType: "type_conversion",
            message: `Invalid decimal format: ${stringValue}`,
            originalValue: value,
            suggestedFix: "Provide a valid decimal number",
            severity: "medium",
            canAutoFix: true,
          });
        }
        break;

      case "BOOLEAN":
        if (!TYPE_VALIDATORS.BOOLEAN.test(stringValue)) {
          errors.push({
            id: generateId(),
            row: rowNumber,
            column: column.name,
            errorType: "type_conversion",
            message: `Invalid boolean format: ${stringValue}`,
            originalValue: value,
            suggestedFix: "Use true/false, yes/no, 1/0, or on/off",
            severity: "medium",
            canAutoFix: true,
          });
        }
        break;

      case "VARCHAR":
      case "TEXT":
        if (column.length && stringValue.length > column.length) {
          errors.push({
            id: generateId(),
            row: rowNumber,
            column: column.name,
            errorType: "validation",
            message: `Text too long: ${stringValue.length} characters (max: ${column.length})`,
            originalValue: value,
            suggestedFix: `Truncate to ${column.length} characters`,
            severity: "medium",
            canAutoFix: true,
          });
        }
        break;

      case "TIMESTAMPTZ":
        if (!TYPE_VALIDATORS.TIMESTAMP.test(stringValue) && isNaN(Date.parse(stringValue))) {
          errors.push({
            id: generateId(),
            row: rowNumber,
            column: column.name,
            errorType: "type_conversion",
            message: `Invalid timestamp format: ${stringValue}`,
            originalValue: value,
            suggestedFix: "Use ISO 8601 format (YYYY-MM-DD HH:MM:SS)",
            severity: "medium",
            canAutoFix: false,
          });
        }
        break;
    }

    // Length validation warnings
    if (column.type === "VARCHAR" && column.length && stringValue.length > column.length * 0.8) {
      warnings.push({
        id: generateId(),
        row: rowNumber,
        column: column.name,
        warningType: "data_quality",
        message: `Value is close to maximum length (${stringValue.length}/${column.length} characters)`,
        originalValue: value,
      });
    }

    return { errors, warnings };
  }

  /**
   * Transform a batch of data according to column mappings
   */
  private async transformBatch(
    tableName: string,
    batch: Record<string, unknown>[]
  ): Promise<Record<string, unknown>[]> {
    const transformedBatch: Record<string, unknown>[] = [];

    for (const row of batch) {
      const transformedRow: Record<string, unknown> = {};

      // Apply transformations based on column mappings
      for (const mapping of this.configuration.dataTransformations || []) {
        if (mapping.targetTable === tableName) {
          let value = row[mapping.sourceColumn];

          // Apply transformation if specified
          if (mapping.transformation) {
            value = this.applyTransformation(value, mapping.transformation);
          }

          transformedRow[mapping.targetColumn] = value;
        }
      }

      // If no mappings, copy all columns
      if (!this.configuration.dataTransformations || this.configuration.dataTransformations.length === 0) {
        Object.assign(transformedRow, row);
      }

      transformedBatch.push(transformedRow);
    }

    return transformedBatch;
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
        return this.formatValue(value, transformation.expression);
      
      case "default":
        return value || transformation.defaultValue;
      
      case "calculate":
        // For now, return original value (would implement expression evaluation)
        return value;
      
      case "lookup":
        // For now, return original value (would implement lookup table)
        return value;
      
      default:
        return value;
    }
  }

  /**
   * Cast value to specified type
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

      case "UUID":
        return TYPE_VALIDATORS.UUID.test(stringValue) ? stringValue : null;

      case "TIMESTAMPTZ":
        const date = new Date(stringValue);
        return isNaN(date.getTime()) ? null : date.toISOString();

      default:
        return stringValue;
    }
  }

  /**
   * Format value according to pattern
   */
  private formatValue(value: unknown, pattern: string): unknown {
    // Simple formatting - would expand in production
    if (pattern === "uppercase") {
      return String(value).toUpperCase();
    }
    if (pattern === "lowercase") {
      return String(value).toLowerCase();
    }
    if (pattern === "trim") {
      return String(value).trim();
    }
    return value;
  }

  /**
   * Create batches for processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Simulate batch insert (actual implementation would be in Edge Function)
   */
  private async simulateInsertBatch(
    tableName: string,
    batch: Record<string, unknown>[]
  ): Promise<{ successfulRows: number; failedRows: number }> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Simulate some failures (5% failure rate)
    const failureRate = 0.05;
    const failedRows = Math.floor(batch.length * failureRate);
    const successfulRows = batch.length - failedRows;

    // Add some simulated errors for failed rows
    for (let i = 0; i < failedRows; i++) {
      this.addError({
        row: -1,
        table: tableName,
        errorType: "constraint",
        message: "Simulated constraint violation",
        severity: "medium",
        canAutoFix: false,
      });
    }

    return { successfulRows, failedRows };
  }

  /**
   * Add error to collection
   */
  private addError(error: Omit<DataError, "id">): void {
    this.errors.push({
      id: generateId(),
      ...error,
    });
  }

  /**
   * Create progress update
   */
  private createProgress(phase: SeedingProgress["currentPhase"], percent: number): SeedingProgress {
    return {
      jobId: this.job.id,
      status: this.job.status,
      overallProgress: Math.min(100, Math.max(0, percent)),
      currentPhase: phase,
      currentTable: this.statistics.currentTable || "",
      currentBatch: this.job.currentBatch || 0,
      rowsPerSecond: this.statistics.averageRowsPerSecond,
      estimatedTimeRemaining: this.calculateETA(),
      statistics: this.statistics,
      errors: this.errors,
      warnings: this.warnings,
      lastUpdate: new Date(),
    };
  }

  /**
   * Calculate estimated time to completion
   */
  private calculateETA(): number {
    if (this.statistics.averageRowsPerSecond === 0) return 0;
    
    const remainingRows = this.statistics.totalRows - this.statistics.processedRows;
    return Math.ceil(remainingRows / this.statistics.averageRowsPerSecond);
  }
}
