/**
 * API Route: Create seed-data Edge Function in user's Supabase project
 * Phase 10: Data Seeding & Large File Processing
 */

import { NextRequest, NextResponse } from "next/server";

const EDGE_FUNCTION_SOURCE = `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

interface SeedDataRequest {
  fileId: string;
  jobId: string;
  configuration: any;
  schema: any;
  projectConfig?: {
    projectId: string;
    databaseUrl: string;
    apiKey: string;
  };
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
}

class CSVProcessor {
  private supabaseClient: any;
  private request: SeedDataRequest;
  private progress: SeedingProgress;
  private errors: any[] = [];
  private warnings: any[] = [];
  private startTime: number;

  constructor(request: SeedDataRequest, supabaseUrl: string, supabaseKey: string) {
    this.request = request;
    this.startTime = Date.now();
    
    // Use service role key to bypass RLS policies for data seeding
    this.supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
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

  async processCSVData(onProgress?: (progress: SeedingProgress) => void): Promise<SeedingProgress> {
    try {
      this.updateProgress(5, "parsing", "Downloading CSV file");
      onProgress?.(this.progress);
      
      // Get CSV data from the file upload
      const csvData = await this.downloadAndParseCSV();
      
      this.updateProgress(15, "parsing", "Parsing CSV data");
      onProgress?.(this.progress);
      
      const rows = this.parseCSV(csvData);
      
      this.updateProgress(25, "validating", "Validating data structure");
      onProgress?.(this.progress);
      
      // Validate against schema
      const validatedData = await this.validateData(rows);
      
      this.updateProgress(35, "processing", "Processing data into tables");
      onProgress?.(this.progress);
      
      // Process data into schema tables
      await this.insertDataIntoTables(validatedData, onProgress);
      
      this.updateProgress(100, "completing", "Seeding completed");
      this.progress.status = "completed";
      onProgress?.(this.progress);

      return this.progress;
    } catch (error) {
      this.progress.status = "failed";
      this.errors.push({
        message: error.message,
        timestamp: new Date(),
      });
      this.progress.errors = this.errors;
      throw error;
    }
  }

  /**
   * Download and parse CSV file from storage
   */
  async downloadAndParseCSV(): Promise<any[]> {
    try {
      this.updateProgress({ currentPhase: "parsing", overallProgress: 5 });
      
      // Try multiple path formats to find the file
      const possiblePaths = [
        // New simplified format: current_user/projectId/fileId/filename
        \`current_user/\${this.request.configuration.projectId}/\${this.request.fileId}/\${this.request.configuration.filename || 'data.csv'}\`,
        // Alternative format: just fileId
        \`\${this.request.fileId}\`,
        // Legacy format if it exists
        \`\${this.request.configuration.userId || 'current_user'}/\${this.request.configuration.projectId}/\${this.request.fileId}/\${this.request.configuration.filename || 'data.csv'}\`,
      ];
      
      let fileData: Blob | null = null;
      let successfulPath = '';
      
      for (const filePath of possiblePaths) {
        console.log(\`Attempting to download CSV file from path: \${filePath}\`);
        
        const { data, error } = await this.supabaseClient.storage
          .from('csv-uploads')
          .download(filePath);
        
        if (!error && data) {
          fileData = data;
          successfulPath = filePath;
          console.log(\`Successfully downloaded file from: \${filePath}\`);
          break;
        } else {
          console.log(\`Failed to download from \${filePath}:\`, error?.message);
        }
      }
      
      if (!fileData) {
        throw new Error(\`Failed to download CSV file from any of the attempted paths: \${possiblePaths.join(', ')}\`);
      }
      
      console.log(\`Processing file downloaded from: \${successfulPath}\`);
      return this.parseCSVData(fileData);
      
    } catch (error) {
      console.error('Error downloading CSV:', error);
      this.errors.push({
        phase: 'download',
        error: error instanceof Error ? error.message : 'Failed to download CSV file',
        timestamp: new Date(),
      });
      
      // Return empty array to prevent complete failure
      return [];
    }
  }

  /**
   * Parse CSV data from blob
   */
  async parseCSVData(fileBlob: Blob): Promise<any[]> {
    try {
      const text = await fileBlob.text();
      const lines = text.split('\\\\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        throw new Error('CSV file is empty');
      }
      
      // Parse CSV (simple implementation - in production you'd use a proper CSV parser)
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const rows = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        if (values.length === headers.length) {
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index];
          });
          rows.push(row);
        }
      }
      
      console.log(\\\`Parsed \\\${rows.length} rows from CSV with headers:\\\`, headers);
      return rows;
      
    } catch (error) {
      console.error('Error parsing CSV:', error);
      throw new Error(\\\`Failed to parse CSV data: \\\${error instanceof Error ? error.message : 'Unknown error'}\\\`);
    }
  }

  private parseCSV(csvData: string): any[] {
    const lines = csvData.trim().split('\\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      return row;
    });
  }

  private async validateData(rows: any[]): Promise<any[]> {
    // Basic validation - in real implementation, validate against schema
    return rows.filter(row => {
      if (!row.email || !row.name) {
        this.warnings.push({
          message: \`Row missing required fields: \${JSON.stringify(row)}\`,
          timestamp: new Date(),
        });
        return false;
      }
      return true;
    });
  }

  private async insertDataIntoTables(data: any[], onProgress?: (progress: SeedingProgress) => void): Promise<void> {
    const schema = this.request.schema;
    const batchSize = this.request.configuration?.batchSize || 100;
    
    // Process each table in the schema
    for (let i = 0; i < schema.tables.length; i++) {
      const table = schema.tables[i];
      this.progress.currentTable = table.name;
      
      this.updateProgress(
        35 + (i / schema.tables.length) * 60,
        "processing",
        \`Processing table: \${table.name}\`
      );
      onProgress?.(this.progress);
      
      // Map CSV data to table structure
      const tableData = this.mapDataToTable(data, table);
      
      // Insert data in batches
      const batches = this.createBatches(tableData, batchSize);
      this.progress.totalBatches = batches.length;
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        this.progress.currentBatch = batchIndex + 1;
        
        try {
          const { data: insertedData, error } = await this.supabaseClient
            .from(table.name)
            .insert(batches[batchIndex]);
          
          if (error) {
            const errorDetails = {
              table: table.name,
              batch: batchIndex + 1,
              error: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
              timestamp: new Date(),
            };
            
            this.errors.push(errorDetails);
            this.progress.failedRows += batches[batchIndex].length;
            
            // Log detailed error for debugging
            console.error(\`Database insertion error for table \${table.name}:\`, errorDetails);
            
            // If it's an RLS policy error, add helpful message
            if (error.message.includes('row-level security policy')) {
              this.warnings.push({
                message: \`RLS policy blocking insertion into \${table.name}. Consider using service role key or disabling RLS for data seeding.\`,
                timestamp: new Date(),
              });
            }
          } else {
            this.progress.successfulRows += batches[batchIndex].length;
            console.log(\`Successfully inserted \${batches[batchIndex].length} rows into \${table.name}\`);
          }
        } catch (error) {
          const errorDetails = {
            table: table.name,
            batch: batchIndex + 1,
            error: error.message,
            timestamp: new Date(),
          };
          
          this.errors.push(errorDetails);
          this.progress.failedRows += batches[batchIndex].length;
          console.error(\`Exception during insertion into \${table.name}:\`, errorDetails);
        }
        
        this.progress.processedRows += batches[batchIndex].length;
        
        // Update progress
        const tableProgress = (batchIndex + 1) / batches.length;
        const overallTableProgress = (i + tableProgress) / schema.tables.length;
        this.updateProgress(
          35 + overallTableProgress * 60,
          "processing",
          \`Processing \${table.name}: batch \${batchIndex + 1}/\${batches.length}\`
        );
        onProgress?.(this.progress);
        
        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  private mapDataToTable(data: any[], table: any): any[] {
    // Map CSV columns to table columns based on schema
    return data.map(row => {
      const mappedRow: any = {};
      
      table.columns.forEach((column: any) => {
        // Simple mapping - in real implementation, use more sophisticated mapping
        const csvValue = row[column.name] || row[column.name.toLowerCase()];
        
        if (csvValue !== undefined) {
          // Type conversion based on column type
          switch (column.type) {
            case 'integer':
            case 'bigint':
              mappedRow[column.name] = parseInt(csvValue) || null;
              break;
            case 'numeric':
            case 'decimal':
              mappedRow[column.name] = parseFloat(csvValue) || null;
              break;
            case 'boolean':
              mappedRow[column.name] = csvValue.toLowerCase() === 'true';
              break;
            case 'timestamp':
            case 'date':
              mappedRow[column.name] = new Date(csvValue).toISOString();
              break;
            default:
              mappedRow[column.name] = csvValue;
          }
        }
      });
      
      return mappedRow;
    });
  }

  private createBatches(data: any[], batchSize: number): any[][] {
    const batches = [];
    for (let i = 0; i < data.length; i += batchSize) {
      batches.push(data.slice(i, i + batchSize));
    }
    return batches;
  }

  private updateProgress(percent: number, phase: SeedingProgress["currentPhase"], message?: string): void {
    this.progress.overallProgress = Math.min(100, Math.max(0, percent));
    this.progress.currentPhase = phase;
    this.progress.lastUpdate = new Date();
    this.progress.errors = this.errors;
    this.progress.warnings = this.warnings;
    
    // Calculate rows per second
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    if (elapsedSeconds > 0) {
      this.progress.rowsPerSecond = Math.round(this.progress.processedRows / elapsedSeconds);
    }
    
    if (message) {
      console.log(\`[\${this.progress.jobId}] \${message} (\${percent.toFixed(1)}%)\`);
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

      // Check if this is a streaming request
      const url = new URL(req.url);
      const isStreaming = url.searchParams.get("stream") === "true";

      // Get Supabase credentials from environment
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || \`https://\${request.schema.projectId}.supabase.co\`;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "your-service-role-key";

      const processor = new CSVProcessor(request, supabaseUrl, supabaseKey);

      if (isStreaming) {
        // Set up Server-Sent Events
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            const writer = {
              write: (chunk: Uint8Array) => controller.enqueue(chunk),
            };

            (async () => {
              try {
                const progressHandler = (progress: SeedingProgress) => {
                  const data = JSON.stringify({
                    type: "progress",
                    data: progress,
                  });
                  writer.write(encoder.encode(\`data: \${data}\\n\\n\`));
                };

                const result = await processor.processCSVData(progressHandler);

                // Send completion
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
                writer.write(encoder.encode(\`data: \${completionData}\\n\\n\`));
                writer.write(encoder.encode("data: [DONE]\\n\\n"));
                controller.close();
              } catch (error) {
                const errorData = JSON.stringify({
                  type: "error",
                  data: {
                    success: false,
                    error: {
                      message: error.message,
                    },
                  },
                });
                writer.write(encoder.encode(\`data: \${errorData}\\n\\n\`));
                controller.close();
              }
            })();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } else {
        const result = await processor.processCSVData();

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
          headers: { "Content-Type": "application/json" },
        });
      }
    } catch (error) {
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    // Get OAuth token from Authorization header
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required. Please provide a valid access token." },
        { status: 401 }
      );
    }

    // Create FormData for multipart/form-data request
    const formData = new FormData();
    
    // Add the function file
    formData.append('file', new Blob([EDGE_FUNCTION_SOURCE], { type: 'text/plain' }), 'index.ts');
    
    // Add metadata as JSON string
    const metadata = {
      name: "seed-data",
      entrypoint_path: "index.ts",
      verify_jwt: false,
    };
    formData.append('metadata', JSON.stringify(metadata));

    // Deploy the Edge Function using the correct Management API format
    const deployResponse = await fetch(
      `https://api.supabase.com/v1/projects/${projectId}/functions/deploy?slug=seed-data`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          // Don't set Content-Type - let the browser set it with boundary
        },
        body: formData,
      }
    );

    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      console.error("Failed to deploy Edge Function:", errorText);
      
      return NextResponse.json(
        { error: `Failed to deploy Edge Function: ${errorText}` },
        { status: deployResponse.status }
      );
    }

    const functionData = await deployResponse.json();

    return NextResponse.json({
      success: true,
      message: "Edge Function deployed successfully",
      functionUrl: `https://${projectId}.supabase.co/functions/v1/seed-data`,
      function: functionData,
    });
  } catch (error) {
    console.error("Error creating Edge Function:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}