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
  SCHEMA_CONFIG
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
  private static readonly CHUNK_SIZE = (typeof SCHEMA_CONFIG !== 'undefined' ? SCHEMA_CONFIG.batchSize : null) || 100;
  private static readonly MAX_CPU_TIME = (typeof SCHEMA_CONFIG !== 'undefined' ? SCHEMA_CONFIG.timeoutMs : null) || 1400;
  
  // Dynamic caches for FK resolution
  private fkResolver: any; // Use any type to avoid dependency issues
  private processedRowsCache = new Map<string, string>();

  constructor(request: SeedDataRequest, supabaseUrl: string, supabaseKey: string) {
    this.request = request;
    this.startTime = Date.now();
    this.serviceKey = supabaseKey;
    
    // Safely instantiate FK resolver if available
    try {
      this.fkResolver = typeof ForeignKeyResolver !== 'undefined' ? new ForeignKeyResolver() : null;
    } catch (error) {
      console.log('⚠️ ForeignKeyResolver not available, using fallback');
      this.fkResolver = null;
    }
    
    // CRITICAL: Ensure service role key authentication
    console.log('🔧 Creating Supabase client...');
    console.log('🔧 URL:', supabaseUrl);
    console.log('🔧 Key length:', supabaseKey?.length || 0);
    console.log('🔧 Key starts with:', supabaseKey?.substring(0, 15) || 'NO KEY');
    
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
    
    console.log('✅ Supabase client created with service role key');
    
    // Test database connectivity and permissions
    this.testDatabaseAccess().catch(error => {
      console.log('❌ Database access test failed:', error.message);
    });
    
    this.progress = {
      jobId: request.jobId,
      status: "processing",
      overallProgress: 0,
      currentPhase: "parsing",
      processedRows: request.processedRows || 0,
      successfulRows: 0,
      failedRows: 0,
      errors: [],
      warnings: [],
      lastUpdate: new Date(),
      needsContinuation: false,
      continuationData: undefined,
    };
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
      console.error('Processing error:', error);
      this.progress.status = "failed";
      this.errors.push({
        message: error.message,
        timestamp: new Date(),
      });
      this.progress.errors = this.errors;
      throw error;
    }
  }

  private async processOneChunkWithContinuation(onProgress: (progress: SeedingProgress) => void): Promise<SeedingProgress> {
    console.log('📋 DYNAMIC CHUNK MODE: Processing one chunk per invocation');
    
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

    // Parse headers
    this.updateProgress(15, "parsing", "Parsing CSV structure...");
    onProgress(this.progress);
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const dataLines = lines.slice(1);
    const totalRows = dataLines.length;
    
    console.log(\`📊 Total rows to process: \${totalRows}\`);

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
      // Parse chunk data
      const chunkData = chunkLines.map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });

      console.log(\`📦 Processing chunk: rows \${startIdx + 1}-\${endIdx} of \${totalRows}\`);

      const progressPercent = Math.min(95, 25 + ((startIdx + chunkLines.length) / totalRows) * 70);
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
  }

  private async processChunkDataWithDynamicLogic(chunkData: any[]): Promise<void> {
    if (!chunkData || chunkData.length === 0) return;
    
    const startTime = Date.now();
    
    // Safely get table processing order with fallback
    const tableOrder = typeof TABLE_PROCESSING_ORDER !== 'undefined' ? TABLE_PROCESSING_ORDER : ['properties', 'users', 'categories'];
    
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
        const mappedData = validRows.map(row => mapCSVToTableColumns(row, tableName));
        
        // Resolve foreign keys using AI-generated resolvers
        const resolvedData = await resolveForeignKeys(mappedData, tableName, this.supabaseClient);
        
        // Insert the data
        console.log(\`💾 Inserting \${resolvedData.length} rows into \${tableName}\`);
        
        // Log sample data for debugging
        if (resolvedData.length > 0) {
          console.log(\`🔍 Sample row for \${tableName}:\`, Object.keys(resolvedData[0]).slice(0, 5).join(', '), '...');
        }
        
        try {
          const { data, error } = await this.supabaseClient
            .from(tableName)
            .upsert(resolvedData, { 
              onConflict: 'id',
              ignoreDuplicates: false 
            })
            .select();
            
          if (error) {
            console.log(\`❌ \${tableName} insert error:\`, error.message);
            console.log(\`🔍 Error details:\`, JSON.stringify(error, null, 2));
            
            // Check if it's an RLS issue
            if (error.message.includes('owner') || error.message.includes('permission')) {
              console.log(\`⚠️  This looks like a Row Level Security (RLS) issue. The table \${tableName} may have RLS enabled without proper policies for the service role.\`);
            }
            
            // Check if it's a column issue
            if (error.message.includes('column') || error.message.includes('schema cache')) {
              console.log(\`⚠️  This looks like a column schema issue. The mapped columns may not match the actual table schema.\`);
            }
            
            this.errors.push({
              table: tableName,
              error: error.message,
              timestamp: new Date(),
            });
          } else {
            console.log(\`✅ \${tableName}: Successfully inserted \${resolvedData.length} rows\`);
            if (data) {
              console.log(\`📊 \${tableName}: Confirmed \${data.length} rows in database\`);
            }
            this.progress.successfulRows += resolvedData.length;
          }
        } catch (e) {
          console.log(\`❌ \${tableName} INSERTION CRASH:\`, e ? e.message : 'Unknown error');
          console.log(\`🔍 Raw error:\`, e);
          console.log(\`🔍 Data sample that caused crash:\`, JSON.stringify(resolvedData.slice(0, 2), null, 2));
          this.errors.push({
            table: tableName,
            error: e ? e.message : 'Unknown insertion crash',
            timestamp: new Date(),
          });
        }
        
      } catch (error) {
        console.log(\`❌ Error processing \${tableName}:\`, error.message);
      }
    }
  }

  private async processSingleChunk(): Promise<SeedingProgress> {
    console.log('🔄 CHUNK MODE: Processing chunk', this.request.chunkIndex || 0);
    
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
  }

  private async getCSVContentFromStorage(): Promise<string> {
    try {
      const filePath = this.request.fileUpload?.storagePath;
      if (!filePath) {
        throw new Error('No file path provided');
      }

      console.log('Downloading CSV from storage:', filePath);

      const { data, error } = await this.supabaseClient.storage
        .from('csv-uploads')
        .download(filePath);

      if (error) {
        throw new Error(\`Storage download failed: \${error.message}\`);
      }

      const csvContent = await data.text();
      return csvContent;

    } catch (error) {
      console.error('Error downloading CSV:', error);
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
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const dataLines = lines.slice(1);
      const chunkLines = dataLines.slice(startRow, endRow);

      if (chunkLines.length === 0) {
        return [];
      }

      // Parse chunk into objects
      const chunkData = chunkLines.map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });

      console.log(\`Parsed \${chunkData.length} rows for chunk \${chunkIndex}\`);
      return chunkData;

    } catch (error) {
      console.error('Error getting CSV chunk:', error);
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
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  const url = new URL(req.url);
  const isStreaming = url.searchParams.get("stream") === "true";

  if (req.method === "POST") {
    try {
      const request = await req.json();

      if (!request.fileId || !request.jobId || !request.schema) {
        return new Response(JSON.stringify({
          success: false,
          error: "Missing required fields: fileId, jobId, or schema",
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get Supabase credentials - MUST use service role key for database writes
      const supabaseUrl = request.supabaseUrl || ('https://' + request.schema.projectId + '.supabase.co') || Deno.env.get("SUPABASE_URL");
      
      // Try multiple possible sources for the service key
      let supabaseKey = request.supabaseServiceKey || 
                        request.projectConfig?.apiKey || 
                        request.serviceRoleKey ||
                        request.apiKey ||
                        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      
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
      
      console.log('Processing', isStreaming ? 'streaming request' : 'chunk', request.chunkIndex || 0, 'for job', request.jobId);

      const processor = new DynamicCSVProcessor(request, supabaseUrl, supabaseKey);

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
            // Send error message
            const errorData = JSON.stringify({
              type: "error",
              data: {
                success: false,
                error: error.message || "Internal server error",
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
      console.error('Processing error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: { "Content-Type": "application/json" },
  });
});`;
} 