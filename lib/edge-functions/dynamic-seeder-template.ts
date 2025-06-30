/**
 * Dynamic Edge Function Template for CSV Data Seeding
 * This template contains the reusable infrastructure and will be populated
 * with AI-generated schema-specific logic
 */

export interface SeedingLogic {
  tableProcessors: string;
  columnMappers: string;
  relationshipResolvers: string;
  validationRules: string;
  constants: string;
}

export function generateDynamicSeederFunction(seedingLogic: SeedingLogic): string {
  return `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

interface SeedDataRequest {
  fileId: string;
  jobId: string;
  configuration: any;
  schema: any;
  fileUpload?: {
    storagePath: string;
    filename: string;
    size: number;
  };
  projectConfig?: {
    projectId: string;
    databaseUrl: string;
    apiKey: string;
  };
  chunkIndex?: number;
  totalChunks?: number;
  processedRows?: number;
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
  errors: any[];
  warnings: any[];
  lastUpdate: Date;
  needsContinuation?: boolean;
  continuationData?: {
    processedRows: number;
    totalRows: number;
    nextChunkIndex: number;
  };
}

// AI-Generated Schema-Specific Logic - MUST BE FIRST
${seedingLogic.constants};

${seedingLogic.tableProcessors};

${seedingLogic.columnMappers};

${seedingLogic.relationshipResolvers};

${seedingLogic.validationRules};

// Export all functions for the edge function template
export {
  TABLE_PROCESSING_ORDER,
  filterDataForTable,
  mapCSVToTableColumns,
  resolveForeignKeys,
  validateBatch,
  SCHEMA_CONFIG,
  SESSION_FK_CACHE
};

class DynamicCSVProcessor {
  private supabaseClient: any;
  private request: SeedDataRequest;
  private progress: SeedingProgress;
  private errors: any[] = [];
  private warnings: any[] = [];
  private startTime: number;
  private serviceKey: string;

  // Processing constants from schema config - use fallback if SCHEMA_CONFIG not available
  private static readonly CHUNK_SIZE = (typeof SCHEMA_CONFIG !== 'undefined' ? SCHEMA_CONFIG.batchSize : null) || 50;
  private static readonly MAX_CPU_TIME = (typeof SCHEMA_CONFIG !== 'undefined' ? SCHEMA_CONFIG.timeoutMs : null) || 1200;
  
  // Dynamic caches for FK resolution
  private fkResolver: any; // Use any type to avoid dependency issues
  private processedRowsCache = new Map<string, string>();

  constructor(request: SeedDataRequest, supabaseUrl: string, supabaseKey: string) {
    try {
      console.log('🔍 CONSTRUCTOR: Starting - absolutely bulletproof version');
      console.log('🔍 CONSTRUCTOR: Request type:', typeof request);
      console.log('🔍 CONSTRUCTOR: Request null check:', request === null);
      console.log('🔍 CONSTRUCTOR: Request undefined check:', request === undefined);
      console.log('🔍 CONSTRUCTOR: URL type:', typeof supabaseUrl);
      console.log('🔍 CONSTRUCTOR: URL null check:', supabaseUrl === null);
      console.log('🔍 CONSTRUCTOR: Key type:', typeof supabaseKey);
      console.log('🔍 CONSTRUCTOR: Key null check:', supabaseKey === null);
      
      // BULLETPROOF parameter validation
      if (request === null || request === undefined) {
        throw new Error('Request parameter is null or undefined');
      }
      
      if (typeof request !== 'object') {
        throw new Error(\`Request must be an object, got: \${typeof request}\`);
      }
      
      if (supabaseUrl === null || supabaseUrl === undefined) {
        throw new Error('supabaseUrl parameter is null or undefined');
      }
      
      if (typeof supabaseUrl !== 'string') {
        throw new Error(\`supabaseUrl must be a string, got: \${typeof supabaseUrl}\`);
      }
      
      if (supabaseKey === null || supabaseKey === undefined) {
        throw new Error('supabaseKey parameter is null or undefined');
      }
      
      if (typeof supabaseKey !== 'string') {
        throw new Error(\`supabaseKey must be a string, got: \${typeof supabaseKey}\`);
      }
      
      console.log('✅ CONSTRUCTOR: Parameter validation passed');
      
      // Safe assignment with additional checks
      this.request = request;
      this.startTime = Date.now();
      this.serviceKey = supabaseKey;
      
      console.log('✅ CONSTRUCTOR: Basic properties assigned');
      
      // BULLETPROOF FK resolver initialization
      this.fkResolver = null;
      try {
        if (typeof ForeignKeyResolver !== 'undefined' && ForeignKeyResolver !== null) {
          this.fkResolver = new ForeignKeyResolver();
          console.log('✅ CONSTRUCTOR: ForeignKeyResolver created');
        } else {
          console.log('⚠️ CONSTRUCTOR: ForeignKeyResolver not available');
        }
      } catch (resolverError) {
        console.log('⚠️ CONSTRUCTOR: ForeignKeyResolver creation failed:', resolverError.message);
        this.fkResolver = null;
      }
      
      // BULLETPROOF Supabase client creation
      console.log('🔧 CONSTRUCTOR: Creating Supabase client...');
      console.log('🔧 CONSTRUCTOR: URL length:', supabaseUrl.length);
      console.log('🔧 CONSTRUCTOR: Key length:', supabaseKey.length);
      console.log('🔧 CONSTRUCTOR: URL first 20 chars:', supabaseUrl.substring(0, 20));
      console.log('🔧 CONSTRUCTOR: Key first 20 chars:', supabaseKey.substring(0, 20));
      
      try {
        this.supabaseClient = createClient(supabaseUrl, supabaseKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          },
          global: {
            headers: {
              'Authorization': \`Bearer \${supabaseKey}\`
            }
          }
        });
        console.log('✅ CONSTRUCTOR: Supabase client created successfully');
      } catch (clientError) {
        console.error('❌ CONSTRUCTOR: Supabase client creation failed:', clientError.message);
        throw new Error(\`Failed to create Supabase client: \${clientError.message}\`);
      }
      
      // BULLETPROOF progress object creation
      try {
        const jobId = (request && typeof request === 'object' && request.jobId) ? request.jobId : 'unknown';
        const processedRows = (request && typeof request === 'object' && typeof request.processedRows === 'number') ? request.processedRows : 0;
        
        this.progress = {
          jobId: jobId,
          status: "processing",
          overallProgress: 0,
          currentPhase: "parsing",
          processedRows: processedRows,
          successfulRows: 0,
          failedRows: 0,
          errors: [],
          warnings: [],
          lastUpdate: new Date(),
          needsContinuation: false,
          continuationData: undefined,
        };
        console.log('✅ CONSTRUCTOR: Progress object created');
      } catch (progressError) {
        console.error('❌ CONSTRUCTOR: Progress object creation failed:', progressError.message);
        throw new Error(\`Failed to create progress object: \${progressError.message}\`);
      }
      
      // SAFE database access test - don't let this crash the constructor
      try {
        this.testDatabaseAccess().catch(testError => {
          console.log('⚠️ CONSTRUCTOR: Database access test failed (non-fatal):', testError.message);
        });
      } catch (testSetupError) {
        console.log('⚠️ CONSTRUCTOR: Could not set up database test (non-fatal):', testSetupError.message);
      }
      
      console.log('✅ CONSTRUCTOR: Completed successfully');
      
    } catch (constructorError) {
      console.error('❌ CONSTRUCTOR: FATAL ERROR:', constructorError.message);
      console.error('❌ CONSTRUCTOR: Error stack:', constructorError.stack);
      console.error('❌ CONSTRUCTOR: This error will crash the Edge Function');
      throw constructorError;
    }
  }

  async processCSVChunk(onProgress?: (progress: SeedingProgress) => void): Promise<SeedingProgress> {
    try {
      console.log('🚀 DYNAMIC SEEDING ENGINE - Starting processing');
      
      if (onProgress) {
        return await this.processOneChunkWithContinuation(onProgress);
      } else {
        return await this.processSingleChunk();
      }

    } catch (error) {
      console.error('❌ FATAL Processing error:', error);
      console.error('❌ Error stack:', error.stack);
      this.progress.status = "failed";
      this.errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date(),
      });
      this.progress.errors = this.errors;
      throw error;
    }
  }

  private async processOneChunkWithContinuation(onProgress: (progress: SeedingProgress) => void): Promise<SeedingProgress> {
    console.log('📋 DYNAMIC CHUNK MODE: Processing one chunk per invocation');
    
    try {
      // Get CSV data
      this.updateProgress(10, "parsing", "Downloading CSV...");
      onProgress(this.progress);
      
      const csvContent = await this.getCSVContentFromStorage();
      const lines = csvContent.split('\\n').filter(line => line.trim());
      
      if (lines.length <= 1) {
        this.progress.status = "completed";
        this.progress.overallProgress = 100;
        this.updateProgress(100, "completing", "No data to process");
        onProgress(this.progress);
        return this.progress;
      }

      // Parse headers with better CSV parsing
      this.updateProgress(15, "parsing", "Parsing CSV structure...");
      onProgress(this.progress);
      
      const headers = this.parseCSVLine(lines[0]);
      const dataLines = lines.slice(1);
      const totalRows = dataLines.length;
      
      console.log(\`📊 Total rows to process: \${totalRows}\`);
      console.log(\`📋 CSV Headers (\${headers.length}): \${headers.slice(0, 10).join(', ')}\${headers.length > 10 ? '...' : ''}\`);

      // Process chunk using dynamic table processing order
      const processedRows = this.request.processedRows || 0;
      const chunkSize = DynamicCSVProcessor.CHUNK_SIZE;
      const startIdx = processedRows;
      const endIdx = Math.min(startIdx + chunkSize, totalRows);
      
      if (startIdx >= totalRows) {
        this.progress.status = "completed";
        this.progress.overallProgress = 100;
        this.updateProgress(100, "completing", "All data processed");
        onProgress(this.progress);
        return this.progress;
      }
      
      const chunkLines = dataLines.slice(startIdx, endIdx);
      let newProcessedRows = processedRows;
      
      if (chunkLines.length > 0) {
        // Parse chunk data with better CSV parsing
        const chunkData = chunkLines.map((line, index) => {
          try {
            const values = this.parseCSVLine(line);
            const row: any = {};
            headers.forEach((header, headerIndex) => {
              row[header] = values[headerIndex] || '';
            });
            return row;
          } catch (error) {
            console.warn(\`⚠️ Failed to parse CSV line \${startIdx + index + 1}: \${error.message}\`);
            return null;
          }
        }).filter(row => row !== null);

        console.log(\`📦 Processing chunk: rows \${startIdx + 1}-\${endIdx} of \${totalRows}\`);

        const progressPercent = Math.min(95, 25 + ((startIdx + chunkData.length) / totalRows) * 70);
        this.updateProgress(
          progressPercent,
          "processing",
          \`Processing rows \${startIdx + 1}-\${endIdx} of \${totalRows} (\${Math.round(progressPercent)}%)\`
        );
        onProgress(this.progress);

        // Process chunk data with timeout protection using dynamic logic
        await this.processChunkDataWithDynamicLogic(chunkData);

        newProcessedRows = processedRows + chunkLines.length;
        this.progress.processedRows = newProcessedRows;
        this.progress.successfulRows = Math.max(this.progress.successfulRows, newProcessedRows);

        console.log(\`✅ Completed chunk, total processed: \${newProcessedRows}/\${totalRows}\`);
      }
      
      // Check if we need continuation
      if (newProcessedRows < totalRows) {
        console.log(\`🔄 Need continuation: \${newProcessedRows}/\${totalRows} completed\`);
        this.progress.status = "processing";
        this.progress.needsContinuation = true;
        this.progress.continuationData = {
          processedRows: newProcessedRows,
          totalRows: totalRows,
          nextChunkIndex: Math.ceil(newProcessedRows / chunkSize),
        };
        
        const continuationPercent = Math.min(95, (newProcessedRows / totalRows) * 95);
        this.updateProgress(
          continuationPercent,
          "processing",
          \`Chunk complete: \${newProcessedRows}/\${totalRows} rows (\${Math.round(continuationPercent)}%)\`
        );
        onProgress(this.progress);
        
        // Schedule next chunk
        this.scheduleNextChunk(newProcessedRows, totalRows, chunkSize);
        
        return this.progress;
      }

      // All done
      console.log(\`🎉 ALL DATA PROCESSED: \${newProcessedRows}/\${totalRows} rows\`);
      this.progress.status = "completed";
      this.progress.overallProgress = 100;
      this.progress.needsContinuation = false;
      this.updateProgress(100, "completing", "Data seeding completed successfully");
      onProgress(this.progress);
      
      return this.progress;
      
    } catch (error) {
      console.error('❌ Error in processOneChunkWithContinuation:', error);
      this.progress.status = "failed";
      this.errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date(),
      });
      this.progress.errors = this.errors;
      onProgress(this.progress);
      throw error;
    }
  }

  // Enhanced CSV parsing to handle quoted fields and commas within quotes
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < line.length) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current.trim());
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }
    
    // Add the last field
    result.push(current.trim());
    
    return result;
  }

  private async processChunkDataWithDynamicLogic(chunkData: any[]): Promise<void> {
    if (!chunkData || chunkData.length === 0) return;
    
    const startTime = Date.now();
    
    try {
      // Safely get table processing order with fallback
      const tableOrder = typeof TABLE_PROCESSING_ORDER !== 'undefined' ? TABLE_PROCESSING_ORDER : ['properties', 'permits', 'sales', 'property_assessments'];
      
      console.log(\`🚀 Processing \${tableOrder.length} tables in order: \${tableOrder.join(' → ')}\`);
      
      // Process each table using the AI-generated order
      for (const tableName of tableOrder) {
        // Check CPU time before processing each table
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime > DynamicCSVProcessor.MAX_CPU_TIME) {
          console.log(\`⏰ CPU timeout reached (\${elapsedTime}ms), stopping table processing\`);
          break;
        }
        
        console.log(\`📋 Processing table: \${tableName} (CPU time: \${elapsedTime}ms)\`);
        
        try {
          // Use AI-generated filtering logic
          const relevantData = filterDataForTable(chunkData, tableName);
          
          if (relevantData.length === 0) {
            console.log(\`⏭️ No data for \${tableName}, skipping\`);
            continue;
          }
          
          console.log(\`📊 \${tableName}: \${relevantData.length} rows to process\`);
          
          // Apply AI-generated validation
          const { validRows, invalidRows } = validateBatch(relevantData, tableName);
          
          if (invalidRows.length > 0) {
            console.log(\`⚠️ \${tableName}: \${invalidRows.length} invalid rows found\`);
            this.warnings.push(...invalidRows);
          }
          
          if (validRows.length === 0) {
            console.log(\`⏭️ No valid rows for \${tableName}, skipping\`);
            continue;
          }
          
          // Map data using AI-generated column mappers
          const mappedData = validRows.map(row => {
            try {
              return mapCSVToTableColumns(row, tableName);
            } catch (error) {
              console.warn(\`⚠️ Mapping failed for row in \${tableName}: \${error.message}\`);
              return null;
            }
          }).filter(row => row !== null && typeof row === 'object'); // Filter out failed mappings and ensure valid objects
          
          if (mappedData.length === 0) {
            console.log(\`⏭️ No valid mapped data for \${tableName}, skipping\`);
            continue;
          }
          
          // Resolve foreign keys using AI-generated resolvers
          let resolvedData;
          try {
            resolvedData = await resolveForeignKeys(mappedData, tableName, this.supabaseClient);
            // Additional safety check for FK resolution results
            if (!Array.isArray(resolvedData)) {
              console.warn(\`⚠️ FK resolution returned non-array for \${tableName}, using original data\`);
              resolvedData = mappedData;
            }
          } catch (error) {
            console.warn(\`⚠️ FK resolution failed for \${tableName}: \${error.message}\`);
            resolvedData = mappedData; // Fall back to mapped data without FK resolution
          }
          
          // Additional null check and filtering for resolved data
          const validResolvedData = resolvedData.filter(row => row !== null && typeof row === 'object');
          
          if (validResolvedData.length === 0) {
            console.log(\`⏭️ No valid resolved data for \${tableName}, skipping\`);
            continue;
          }
          
          // Insert the data
          console.log(\`💾 Inserting \${validResolvedData.length} rows into \${tableName}\`);
          
          // Prepare data for insertion - remove client-generated IDs to let PostgreSQL generate them
          const insertData = validResolvedData.map((row, index) => {
            try {
              // DIAGNOSTIC: Log problematic rows for debugging
              console.log(\`🔍 DIAG: Processing row \${index}, type: \${typeof row}, is null: \${row === null}, is undefined: \${row === undefined}\`);
              
              // BULLETPROOF null safety - multiple checks
              if (row === null) {
                console.warn(\`⚠️ NULL row at index \${index} in \${tableName}, skipping\`);
                return null;
              }
              if (row === undefined) {
                console.warn(\`⚠️ UNDEFINED row at index \${index} in \${tableName}, skipping\`);
                return null;
              }
              if (typeof row !== 'object') {
                console.warn(\`⚠️ NON-OBJECT row at index \${index} (type: \${typeof row}) in \${tableName}, skipping\`);
                return null;
              }
              if (Array.isArray(row)) {
                console.warn(\`⚠️ ARRAY row at index \${index} in \${tableName}, skipping\`);
                return null;
              }
              
              // SAFE destructuring - create new object without risky destructuring
              const rowWithoutId = {};
              for (const [key, value] of Object.entries(row)) {
                if (key !== 'id' && key !== '_addressKey') {
                  rowWithoutId[key] = value;
                }
              }
              
              console.log(\`✅ DIAG: Successfully processed row \${index}, keys: \${Object.keys(rowWithoutId).length}\`);
              return rowWithoutId;
            } catch (error) {
              console.error(\`❌ CRITICAL ERROR preparing row \${index} in \${tableName}: \${error.message}\`);
              console.error(\`🔍 DIAG: Row data: \${JSON.stringify(row, null, 2)}\`);
              console.error(\`🔍 DIAG: Error stack: \${error.stack}\`);
              return null;
            }
                     }).filter(row => row !== null); // Remove any failed preparations
          
          // Final safety check - ensure we have valid data to insert
          if (insertData.length === 0) {
            console.log(\`⏭️ No valid insert data prepared for \${tableName}, skipping\`);
            continue;
          }
          
          // Log sample data for debugging
          if (insertData.length > 0) {
            console.log(\`🔍 Sample row for \${tableName}:\`, Object.keys(insertData[0]).slice(0, 5).join(', '), '...');
            console.log(\`🔍 Sample values:\`, Object.values(insertData[0]).slice(0, 3).map(v => String(v).substring(0, 20)).join(', '), '...');
          }
          
          try {
            const { data, error } = await this.supabaseClient
              .from(tableName)
              .insert(insertData) // Use insert instead of upsert since we're not providing IDs
              .select();
              
            if (error) {
              console.log(\`❌ \${tableName} insert error:\`, error.message);
              console.log(\`🔍 Error details:\`, JSON.stringify(error, null, 2));
              
              // Enhanced error analysis
              if (error.message.includes('owner') || error.message.includes('permission') || error.message.includes('policy')) {
                console.log(\`⚠️  This looks like a Row Level Security (RLS) issue. The table \${tableName} may have RLS enabled without proper policies for the service role.\`);
              }
              
              if (error.message.includes('column') || error.message.includes('schema cache') || error.message.includes('does not exist')) {
                console.log(\`⚠️  This looks like a column schema issue. The mapped columns may not match the actual table schema.\`);
                console.log(\`🔍 Available columns in insert data:\`, Object.keys(insertData[0] || {}).join(', '));
              }
              
              if (error.message.includes('violates') || error.message.includes('constraint')) {
                console.log(\`⚠️  This looks like a constraint violation. Check foreign key references and data types.\`);
              }
              
              this.errors.push({
                table: tableName,
                error: error.message,
                errorCode: error.code,
                errorDetails: error.details,
                timestamp: new Date(),
              });
            } else {
              console.log(\`✅ \${tableName}: Successfully inserted \${insertData.length} rows\`);
              if (data) {
                console.log(\`📊 \${tableName}: Confirmed \${data.length} rows in database\`);
                
                // Store inserted records in session cache for FK resolution
                try {
                  if (typeof SESSION_FK_CACHE !== 'undefined' && SESSION_FK_CACHE.storeInsertedRecords) {
                    SESSION_FK_CACHE.storeInsertedRecords(tableName, data);
                  }
                } catch (cacheError) {
                  console.warn(\`⚠️  Failed to cache \${tableName} records for FK resolution:\`, cacheError.message);
                }
              }
              this.progress.successfulRows += insertData.length;
            }
          } catch (e) {
            console.log(\`❌ \${tableName} INSERTION CRASH:\`, e ? e.message : 'Unknown error');
            console.log(\`🔍 Raw error:\`, e);
            console.log(\`🔍 Data sample that caused crash:\`, JSON.stringify(insertData.slice(0, 2), null, 2));
            this.errors.push({
              table: tableName,
              error: e ? e.message : 'Unknown insertion crash',
              errorType: 'insertion_crash',
              timestamp: new Date(),
            });
          }
          
        } catch (error) {
          console.log(\`❌ Error processing \${tableName}:\`, error.message);
          console.log(\`🔍 Error stack:\`, error.stack);
          this.errors.push({
            table: tableName,
            error: error.message,
            errorType: 'processing_error',
            timestamp: new Date(),
          });
        }
      }
    } catch (error) {
      console.error('❌ Fatal error in processChunkDataWithDynamicLogic:', error);
      throw error;
    }
  }

  private async processSingleChunk(): Promise<SeedingProgress> {
    console.log('🔄 CHUNK MODE: Processing chunk', this.request.chunkIndex || 0);
    
    try {
      // Get the chunk of data to process
      const chunkData = await this.getCSVChunk();
      
      if (!chunkData || chunkData.length === 0) {
        this.progress.status = "completed";
        this.progress.overallProgress = 100;
        this.updateProgress(100, "completing", "Seeding completed successfully");
        return this.progress;
      }

      this.updateProgress(10, "processing", \`Processing chunk \${(this.request.chunkIndex || 0) + 1}\`);
      
      // Process this chunk using dynamic logic
      await this.processChunkDataWithDynamicLogic(chunkData);
      
      // Update progress
      const totalRows = await this.getTotalRowCount();
      this.progress.processedRows += chunkData.length;
      const progressPercent = Math.min(95, (this.progress.processedRows / totalRows) * 100);
      this.updateProgress(progressPercent, "processing", \`Processed \${this.progress.processedRows}/\${totalRows} rows\`);

      // Check if we need to continue or if we're done
      if (this.progress.processedRows < totalRows) {
        this.progress.status = "processing";
        await this.scheduleNextChunk(this.progress.processedRows, totalRows, DynamicCSVProcessor.CHUNK_SIZE);
      } else {
        this.progress.status = "completed";
        this.progress.overallProgress = 100;
        this.updateProgress(100, "completing", "Seeding completed successfully");
      }

      return this.progress;
    } catch (error) {
      console.error('❌ Error in processSingleChunk:', error);
      this.progress.status = "failed";
      this.errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: new Date(),
      });
      this.progress.errors = this.errors;
      throw error;
    }
  }

  private async getCSVContentFromStorage(): Promise<string> {
    try {
      const filePath = this.request.fileUpload?.storagePath;
      if (!filePath) {
        throw new Error('No file path provided');
      }

      console.log('📥 Downloading CSV from storage:', filePath);

      const { data, error } = await this.supabaseClient.storage
        .from('csv-uploads')
        .download(filePath);

      if (error) {
        throw new Error(\`Storage download failed: \${error.message}\`);
      }

      const csvContent = await data.text();
      console.log(\`📄 Downloaded CSV: \${csvContent.length} characters\`);
      return csvContent;

    } catch (error) {
      console.error('❌ Error downloading CSV:', error);
      throw error;
    }
  }

  private async getCSVChunk(): Promise<any[]> {
    try {
      const chunkIndex = this.request.chunkIndex || 0;
      const startRow = chunkIndex * DynamicCSVProcessor.CHUNK_SIZE;
      const endRow = startRow + DynamicCSVProcessor.CHUNK_SIZE;

      console.log(\`Getting CSV chunk: rows \${startRow} to \${endRow}\`);

      const csvContent = await this.getCSVContentFromStorage();
      const lines = csvContent.split('\\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        return [];
      }

      // Get headers and slice the data for this chunk
      const headers = this.parseCSVLine(lines[0]);
      const dataLines = lines.slice(1);
      const chunkLines = dataLines.slice(startRow, endRow);

      if (chunkLines.length === 0) {
        return [];
      }

      // Parse chunk into objects
      const chunkData = chunkLines.map((line, index) => {
        try {
          const values = this.parseCSVLine(line);
          const row: any = {};
          headers.forEach((header, headerIndex) => {
            row[header] = values[headerIndex] || '';
          });
          return row;
        } catch (error) {
          console.warn(\`⚠️ Failed to parse CSV line \${startRow + index + 1}: \${error.message}\`);
          return null;
        }
      }).filter(row => row !== null);

      console.log(\`Parsed \${chunkData.length} rows for chunk \${chunkIndex}\`);
      return chunkData;

    } catch (error) {
      console.error('❌ Error getting CSV chunk:', error);
      throw new Error(\`Failed to get CSV chunk: \${error.message}\`);
    }
  }

  private async getTotalRowCount(): Promise<number> {
    try {
      const csvContent = await this.getCSVContentFromStorage();
      const lines = csvContent.split('\\n').filter(line => line.trim());
      return Math.max(0, lines.length - 1); // Subtract header
    } catch (error) {
      console.log('Could not get total row count:', error);
      return 1000; // Fallback estimate
    }
  }

  private scheduleNextChunk(processedRows: number, totalRows: number, chunkSize: number): void {
    const nextChunkIndex = Math.floor(processedRows / chunkSize);
    
    console.log(\`🚀 Scheduling next chunk: \${nextChunkIndex} (rows \${processedRows}/\${totalRows})\`);
    
    const nextRequest = {
      fileId: this.request.fileId,
      jobId: this.request.jobId,
      schema: this.request.schema,
      configuration: this.request.configuration,
      fileUpload: this.request.fileUpload,
      projectConfig: this.request.projectConfig,
      processedRows: processedRows
    };

    // Fire-and-forget continuation request
    setTimeout(async () => {
      try {
        const projectId = this.request.schema?.projectId || this.request.projectConfig?.projectId;
        const response = await fetch(\`https://\${projectId}.supabase.co/functions/v1/seed-data\`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': \`Bearer \${this.serviceKey}\`
          },
          body: JSON.stringify(nextRequest)
        });
        
        console.log(\`📤 Next chunk scheduled: \${response.ok ? 'success' : 'failed'}\`);
      } catch (error) {
        console.log(\`❌ Error scheduling next chunk:\`, error.message);
      }
    }, 100);
  }

  private async testDatabaseAccess(): Promise<void> {
    try {
      console.log('🧪 Testing database access with service role key...');
      
      const tableOrder = typeof TABLE_PROCESSING_ORDER !== 'undefined' ? TABLE_PROCESSING_ORDER : [];
      if (tableOrder.length === 0) {
        console.log("⚠️ No tables found in TABLE_PROCESSING_ORDER for testing.");
        return;
      }
      
      const testTable = tableOrder[0];
      console.log(\`🧪 Testing select permission on table: \${testTable}\`);
      
      const { error } = await this.supabaseClient
        .from(testTable)
        .select('id')
        .limit(1);
        
      if (error) {
        console.log(\`❌ Select test failed on \${testTable}:\`, error.message);
        if (error.message.includes('permission') || error.message.includes('policy')) {
          console.log(\`⚠️  This looks like a Row Level Security (RLS) issue. The table \${testTable} may need RLS disabled or service role policies for the service role to write to it.\`);
        } else {
          console.log(\`⚠️  CRITICAL: The service role key appears to be invalid or lacks permissions to read from table \${testTable}.\`);
        }
      } else {
        console.log(\`✅ Select test succeeded on \${testTable}. Service role key has read permissions.\`);
      }
    } catch (error) {
      console.log('❌ Database test exception:', error.message);
    }
  }

  private updateProgress(percent: number, phase: SeedingProgress["currentPhase"], message?: string): void {
    this.progress.overallProgress = Math.min(100, Math.max(0, percent));
    this.progress.currentPhase = phase;
    this.progress.lastUpdate = new Date();
    this.progress.errors = this.errors;
    this.progress.warnings = this.warnings;
    
    if (message) {
      console.log('[' + this.progress.jobId + ']', message, '(' + percent.toFixed(1) + '%)');
    }
  }
}

serve(async (req: Request) => {
  // BULLETPROOF ERROR HANDLING - CANNOT CRASH WITH NULL
  try {
    console.log('🔍 SERVE: Handler started - BULLETPROOF version');
    console.log('🔍 SERVE: Request type:', typeof req);
    console.log('🔍 SERVE: Request null check:', req === null);
    console.log('🔍 SERVE: Request undefined check:', req === undefined);
    
    // BULLETPROOF request validation
    if (req === null || req === undefined) {
      console.error('❌ SERVE: Request is null or undefined');
      return new Response(JSON.stringify({
        success: false,
        error: "Request object is null or undefined",
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Handle CORS with null safety
    let method = 'UNKNOWN';
    try {
      method = req.method || 'UNKNOWN';
      console.log('🔍 SERVE: HTTP method:', method);
    } catch (methodError) {
      console.error('❌ SERVE: Cannot read req.method:', methodError.message);
      return new Response(JSON.stringify({
        success: false,
        error: "Cannot determine HTTP method",
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    if (method === "OPTIONS") {
      console.log('🔍 SERVE: Handling CORS OPTIONS request');
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      });
    }

    // BULLETPROOF URL parsing
    let url = null;
    let isStreaming = false;
    try {
      url = new URL(req.url);
      isStreaming = url.searchParams.get("stream") === "true";
      console.log('🔍 SERVE: URL parsed, streaming:', isStreaming);
    } catch (urlError) {
      console.error('❌ SERVE: URL parsing failed:', urlError.message);
      isStreaming = false; // Default to non-streaming
    }

    if (method === "POST") {
      try {
        console.log('🔍 SERVE: Processing POST request');
        
        // BULLETPROOF JSON parsing
        let request = null;
        try {
          if (!req.json || typeof req.json !== 'function') {
            throw new Error('req.json is not a function');
          }
          request = await req.json();
          console.log('🔍 SERVE: JSON parsed successfully');
          console.log('🔍 SERVE: Request type:', typeof request);
          console.log('🔍 SERVE: Request null check:', request === null);
        } catch (jsonError) {
          console.error('❌ SERVE: JSON parsing failed:', jsonError.message);
          return new Response(JSON.stringify({
            success: false,
            error: \`Failed to parse JSON request: \${jsonError.message}\`,
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // BULLETPROOF request validation
        if (request === null || request === undefined) {
          console.error('❌ SERVE: Parsed request is null or undefined');
          return new Response(JSON.stringify({
            success: false,
            error: "Request data is null or undefined",
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        
        if (typeof request !== 'object') {
          console.error('❌ SERVE: Request is not an object, type:', typeof request);
          return new Response(JSON.stringify({
            success: false,
            error: \`Request must be an object, got: \${typeof request}\`,
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        
        // Check required fields with null safety
        const fileId = request.fileId;
        const jobId = request.jobId;
        const schema = request.schema;
        
        if (!fileId || !jobId || !schema) {
          console.error('❌ SERVE: Missing required fields');
          console.error('🔍 SERVE: fileId:', !!fileId);
          console.error('🔍 SERVE: jobId:', !!jobId);
          console.error('🔍 SERVE: schema:', !!schema);
          return new Response(JSON.stringify({
            success: false,
            error: "Missing required fields: fileId, jobId, or schema",
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // BULLETPROOF Supabase credentials extraction
        console.log('🔍 SERVE: Extracting Supabase credentials...');
        
        let supabaseUrl = '';
        try {
          // Try multiple sources for URL
          supabaseUrl = request.supabaseUrl || 
                       (request.schema && request.schema.projectId ? ('https://' + request.schema.projectId + '.supabase.co') : '') ||
                       Deno.env.get("SUPABASE_URL") || 
                       '';
          console.log('🔍 SERVE: Supabase URL extracted:', supabaseUrl ? 'present' : 'missing');
        } catch (urlExtractionError) {
          console.error('❌ SERVE: Error extracting Supabase URL:', urlExtractionError.message);
          supabaseUrl = '';
        }
        
        let supabaseKey = '';
        try {
          // Try multiple possible sources for the service key
          supabaseKey = request.supabaseServiceKey || 
                       (request.projectConfig && request.projectConfig.apiKey) || 
                       request.serviceRoleKey ||
                       request.apiKey ||
                       Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
                       '';
          console.log('🔍 SERVE: Supabase key extracted:', supabaseKey ? 'present' : 'missing');
        } catch (keyExtractionError) {
          console.error('❌ SERVE: Error extracting Supabase key:', keyExtractionError.message);
          supabaseKey = '';
        }
      
      console.log('🔍 Service key source check:');
      console.log('- request.supabaseServiceKey:', !!request.supabaseServiceKey);
      console.log('- request.projectConfig?.apiKey:', !!request.projectConfig?.apiKey);
      console.log('- request.serviceRoleKey:', !!request.serviceRoleKey);
      console.log('- request.apiKey:', !!request.apiKey);
      console.log('- ENV variable:', !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
      
      console.log('🔍 Edge Function received credentials:');
      console.log('- URL:', supabaseUrl);
      console.log('- Service Key (truncated):', supabaseKey ? \`\${supabaseKey.slice(0, 20)}...\${supabaseKey.slice(-4)}\` : 'NOT PROVIDED');
      console.log('- From request.supabaseServiceKey:', !!request.supabaseServiceKey);
      console.log('- From ENV:', !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
      console.log('🔍 Request object keys:', Object.keys(request));
      console.log('🔍 Request supabaseServiceKey type:', typeof request.supabaseServiceKey);
      console.log('🔍 Request supabaseServiceKey value:', request.supabaseServiceKey ? 'HAS VALUE' : 'NULL/UNDEFINED');
      
      if (!supabaseKey || supabaseKey === "your-service-role-key") {
        throw new Error("Service role key is required for data seeding. Please ensure SUPABASE_SERVICE_ROLE_KEY is set in your Edge Function environment.");
      }
      
        // BULLETPROOF validation before creating processor
        if (!supabaseUrl) {
          console.error('❌ SERVE: No Supabase URL available');
          return new Response(JSON.stringify({
            success: false,
            error: "Supabase URL is required",
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        
        if (!supabaseKey) {
          console.error('❌ SERVE: No Supabase key available');
          return new Response(JSON.stringify({
            success: false,
            error: "Supabase service key is required",
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        
        console.log('🔍 SERVE: Processing', isStreaming ? 'streaming request' : 'chunk', request.chunkIndex || 0, 'for job', request.jobId);

        // BULLETPROOF processor creation
        let processor = null;
        try {
          console.log('🔍 SERVE: Creating DynamicCSVProcessor...');
          processor = new DynamicCSVProcessor(request, supabaseUrl, supabaseKey);
          console.log('✅ SERVE: DynamicCSVProcessor created successfully');
        } catch (processorError) {
          console.error('❌ SERVE: Failed to create processor:', processorError.message);
          console.error('❌ SERVE: Processor error stack:', processorError.stack);
          return new Response(JSON.stringify({
            success: false,
            error: \`Failed to initialize processor: \${processorError.message}\`,
            stack: processorError.stack,
          }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

      if (isStreaming) {
        // Return Server-Sent Events stream for real-time progress updates
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        const encoder = new TextEncoder();

        // Start processing in background with streaming progress
        (async () => {
          try {
            // Custom progress handler for streaming
            const progressHandler = (progress) => {
              const data = JSON.stringify({
                type: "progress",
                data: progress,
              });
              
              writer.write(encoder.encode(\`data: \${data}\\n\\n\`));
            };

            // Send initial progress
            progressHandler({
              jobId: request.jobId,
              status: "processing",
              overallProgress: 0,
              currentPhase: "parsing",
              successfulRows: 0,
              failedRows: 0,
              errors: [],
              warnings: [],
              lastUpdate: new Date(),
            });

            // Process data with progress callbacks
            const result = await processor.processCSVChunk(progressHandler);

            // Send completion if truly completed
            if (result.status === "completed" && !result.needsContinuation) {
              const completionData = JSON.stringify({
                type: "complete",
                data: {
                  success: true,
                  jobId: request.jobId,
                  statistics: {
                    totalRows: result.successfulRows + result.failedRows,
                    successfulRows: result.successfulRows,
                    failedRows: result.failedRows,
                    errors: result.errors,
                    warnings: result.warnings,
                  },
                },
              });
              
              writer.write(encoder.encode(\`data: \${completionData}\\n\\n\`));
              writer.write(encoder.encode(\`data: [DONE]\\n\\n\`));
            }
            
          } catch (error) {
            console.error('❌ Streaming processing error:', error);
            // Send error message
            const errorData = JSON.stringify({
              type: "error",
              data: {
                success: false,
                error: error.message || "Internal server error",
                stack: error.stack,
              },
            });
            
            writer.write(encoder.encode(\`data: \${errorData}\\n\\n\`));
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
        // Standard JSON response for non-streaming
        const result = await processor.processCSVChunk();

        return new Response(JSON.stringify({
          success: true,
          jobId: request.jobId,
          chunkIndex: request.chunkIndex || 0,
          status: result.status,
          message: result.status === 'completed' ? "Data seeding completed successfully" : "Chunk processed successfully",
          progress: result,
        }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      } catch (error) {
        console.error('❌ SERVE: Processing error:', error);
        console.error('❌ SERVE: Error stack:', error.stack);
        return new Response(JSON.stringify({
          success: false,
          error: error.message,
          stack: error.stack,
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    console.log('🔍 SERVE: Method not POST, returning 405');
    return new Response("Method not allowed", {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
    
  } catch (outerError) {
    // ULTIMATE SAFETY NET - THIS MUST NEVER THROW
    console.error('❌ SERVE: FATAL OUTER ERROR - This should never happen:', outerError);
    console.error('❌ SERVE: FATAL ERROR STACK:', outerError.stack);
    
    try {
      return new Response(JSON.stringify({
        success: false,
        error: "Fatal edge function error: " + (outerError.message || "Unknown error"),
        stack: outerError.stack || "No stack available",
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    } catch (responseError) {
      // If even creating the error response fails, return a basic response
      console.error('❌ SERVE: Cannot even create error response:', responseError.message);
      return new Response("Internal server error", {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      });
    }
  }
});`;
} 