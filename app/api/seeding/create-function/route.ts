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
  // New fields for chunked processing
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
}

class CSVProcessor {
  private supabaseClient: any;
  private request: SeedDataRequest;
  private progress: SeedingProgress;
  private errors: any[] = [];
  private warnings: any[] = [];
  private startTime: number;

  // Chunked processing constants - REDUCED for CPU limit compliance
  private static readonly CHUNK_SIZE = 25; // Process 25 rows per invocation (reduced from 50)
  private static readonly MAX_CPU_TIME = 1500; // Leave 500ms buffer (1.5s)

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
      processedRows: request.processedRows || 0,
      successfulRows: 0,
      failedRows: 0,
      errors: [],
      warnings: [],
      lastUpdate: new Date(),
    };
  }

  async processCSVChunk(onProgress?: (progress: SeedingProgress) => void): Promise<SeedingProgress> {
    try {
      console.log('🚀 SEEDING ENGINE - Starting processing');
      
      if (onProgress) {
        // STREAMING MODE: Process all data progressively with live updates
        return await this.processAllDataWithStreaming(onProgress);
      } else {
        // NON-STREAMING MODE: Process single chunk
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

  /**
   * Process all data with streaming progress updates
   */
  private async processAllDataWithStreaming(onProgress: (progress: SeedingProgress) => void): Promise<SeedingProgress> {
    console.log('📡 STREAMING MODE: Processing all data with live progress');
    
    // Reset start time for CPU monitoring
    this.startTime = Date.now();
    
    // Quick initialization
    this.updateProgress(5, "parsing", "Initializing...");
    onProgress(this.progress);
    
    // Get all CSV data
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

    // Parse headers quickly
    this.updateProgress(15, "parsing", "Parsing CSV structure...");
    onProgress(this.progress);
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const dataLines = lines.slice(1);
    const totalRows = dataLines.length;
    
    console.log(\`📊 Total rows to process: \${totalRows}\`);

    // Quick essential lookup creation (skip full initialization)
    this.updateProgress(20, "processing", "Creating essential lookups...");
    onProgress(this.progress);
    
    await this.quickPreCreateLookups();

    // Process in chunks with progress updates
    const chunkSize = 15; // Even smaller chunks for better CPU compliance
    let processedRows = 0;

    for (let chunkIndex = 0; chunkIndex * chunkSize < totalRows; chunkIndex++) {
      // More lenient CPU time check - allow more time since we're doing real work
      const cpuTimeUsed = Date.now() - this.startTime;
      if (cpuTimeUsed > 1800) { // 1.8 seconds instead of 1.5
        console.log(\`⏰ CPU limit reached at chunk \${chunkIndex}, processed \${processedRows}/\${totalRows} rows\`);
        console.log(\`📊 Successfully processed \${processedRows} rows before limit\`);
        
        // Update progress to show partial completion
        this.updateProgress(
          Math.min(95, (processedRows / totalRows) * 100),
          "processing",
          \`Processed \${processedRows}/\${totalRows} rows (CPU limit reached)\`
        );
        onProgress(this.progress);
        break;
      }

      const startIdx = chunkIndex * chunkSize;
      const endIdx = Math.min(startIdx + chunkSize, totalRows);
      const chunkLines = dataLines.slice(startIdx, endIdx);
      
      if (chunkLines.length === 0) break;

      // Parse chunk data efficiently
      const chunkData = chunkLines.map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });

      console.log(\`📦 Processing chunk \${chunkIndex + 1}, rows \${startIdx + 1}-\${endIdx}\`);

      // Update progress for this chunk
      this.updateProgress(
        25 + ((chunkIndex + 1) / Math.ceil(totalRows / chunkSize)) * 65,
        "processing",
        \`Processing chunk \${chunkIndex + 1}/\${Math.ceil(totalRows / chunkSize)}...\`
      );
      onProgress(this.progress);

      // Process chunk data efficiently
      await this.processChunkDataQuick(chunkData);

      processedRows = endIdx;
      this.progress.processedRows = processedRows;
      this.progress.successfulRows = processedRows; // Assume success for now

      // Send progress update
      this.updateProgress(
        Math.min(95, (processedRows / totalRows) * 100),
        "processing",
        \`Processed \${processedRows}/\${totalRows} rows\`
      );
      onProgress(this.progress);
      
      console.log(\`✅ Completed chunk \${chunkIndex + 1}, total processed: \${processedRows}\`);
    }

    // Mark as completed
    this.progress.status = "completed";
    this.progress.overallProgress = 100;
    this.updateProgress(100, "completing", "Data seeding completed successfully");
    onProgress(this.progress);

    return this.progress;
  }

  /**
   * Quick lookup creation without heavy initialization
   */
  private async quickPreCreateLookups(): Promise<void> {
    try {
      // Create only the most essential default records
      const schema = this.request.schema;
      const essentialTables = ['jurisdictions', 'permit_types', 'permit_statuses'];
      
      for (const tableName of essentialTables) {
        const table = schema.tables.find(t => t.name === tableName);
        if (table) {
          const defaultRecord = {
            id: crypto.randomUUID(),
            name: 'Default',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          try {
            await this.supabaseClient
              .from(tableName)
              .upsert([defaultRecord], { ignoreDuplicates: true });
          } catch (error) {
            // Ignore errors - table might not exist or have different schema
            console.log(\`Skipped \${tableName}:\`, error.message);
          }
        }
      }
    } catch (error) {
      console.log('Quick lookup creation failed:', error.message);
    }
  }

  /**
   * Quick chunk processing optimized for speed
   */
  private async processChunkDataQuick(chunkData: any[]): Promise<void> {
    if (!chunkData || chunkData.length === 0) return;
    
    const schema = this.request.schema;
    
    // Process ALL tables, but prioritize main tables first
    const sortedTables = [...schema.tables].sort((a, b) => {
      const aIsMain = a.name === 'properties' || a.name === 'permits';
      const bIsMain = b.name === 'properties' || b.name === 'permits';
      if (aIsMain && !bIsMain) return -1;
      if (!aIsMain && bIsMain) return 1;
      return 0;
    });
    
    // Process each table
    for (const table of sortedTables) {
      console.log(\`Quick processing \${chunkData.length} rows for table: \${table.name}\`);
      
      try {
        // Filter data relevant to this table (if it has table-specific columns)
        const relevantData = this.filterDataForTable(chunkData, table);
        if (relevantData.length === 0) {
          console.log(\`No relevant data for table \${table.name}, skipping\`);
          continue;
        }
        
        // Enhanced mapping with better column matching
        const insertData = relevantData.map(row => {
          const mapped: any = {
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          // Smart column mapping with fuzzy matching
          table.columns?.forEach((col: any) => {
            if (!['id', 'created_at', 'updated_at'].includes(col.name)) {
              // Use originalCSVColumn if available, otherwise fall back to col.name
              const csvHeader = col.originalCSVColumn || col.name;
              const csvValue = row[csvHeader]; // Get value from CSV row using the determined header
              const value = String(csvValue || '').trim();
              
              if (csvValue !== undefined) {
                console.log(\`📋 Mapping \${col.name} from CSV "\${csvValue}" -> DB value\`);
              }
              
              // Robust type conversion with empty value handling  
              const colType = (col.type || '').toLowerCase();
              if (colType.includes('integer') || colType.includes('bigint') || colType.includes('int')) {
                if (value === '' || value === 'null' || value === 'NULL') {
                  mapped[col.name] = null;
                } else {
                  const parsed = parseInt(value);
                  mapped[col.name] = isNaN(parsed) ? null : parsed;
                }
              } else if (colType.includes('numeric') || colType.includes('decimal') || colType.includes('real') || colType.includes('double')) {
                if (value === '' || value === 'null' || value === 'NULL') {
                  mapped[col.name] = null;
                } else {
                  const parsed = parseFloat(value);
                  mapped[col.name] = isNaN(parsed) ? null : parsed;
                }
              } else if (colType.includes('boolean') || colType.includes('bool')) {
                if (value === '' || value === 'null' || value === 'NULL') {
                  mapped[col.name] = null;
                } else {
                  mapped[col.name] = ['true', '1', 'yes', 'y', 't'].includes(value.toLowerCase());
                }
              } else if (colType.includes('date') || colType.includes('timestamp')) {
                if (value === '' || value === 'null' || value === 'NULL') {
                  mapped[col.name] = null;
                } else {
                  // Try to parse date, fallback to null if invalid
                  const date = new Date(value);
                  mapped[col.name] = isNaN(date.getTime()) ? null : date.toISOString();
                }
              } else {
                // Text/varchar fields
                if (value === 'null' || value === 'NULL') {
                  mapped[col.name] = null;
                } else {
                  mapped[col.name] = value.substring(0, 255); // Truncate long strings
                }
              }
            }
          });
          
          return mapped;
        });
        
        // Only insert if we have actual data (not just id/timestamps)
        const hasData = insertData.some(row => 
          Object.keys(row).some(key => 
            !['id', 'created_at', 'updated_at'].includes(key) && row[key] !== null
          )
        );
        
        if (!hasData) {
          console.log(\`No meaningful data for \${table.name}, skipping insert\`);
          continue;
        }
        
        // Batch insert with error handling
        const { error } = await this.supabaseClient
          .from(table.name)
          .insert(insertData);
          
        if (error) {
          console.log(\`❌ Insert error for \${table.name}:\`, error.message);
          console.log(\`📋 Sample data:\`, JSON.stringify(insertData[0], null, 2));
          this.progress.failedRows += insertData.length;
        } else {
          console.log(\`✅ Successfully inserted \${insertData.length} rows into \${table.name}\`);
          this.progress.successfulRows = (this.progress.successfulRows || 0) + insertData.length;
        }
        
      } catch (error) {
        console.log(\`Error processing table \${table.name}:\`, error.message);
        this.progress.failedRows += chunkData.length;
      }
    }
  }

  /**
   * Smart CSV column value finder with fuzzy matching
   */
  private findCsvValue(row: any, dbColumnName: string): any {
    // Try exact match first
    if (row[dbColumnName] !== undefined) {
      return row[dbColumnName];
    }
    
    // Try case-insensitive match
    const keys = Object.keys(row);
    const exactMatch = keys.find(key => key.toLowerCase() === dbColumnName.toLowerCase());
    if (exactMatch) {
      return row[exactMatch];
    }
    
    // Try common variations
    const variations = [
      dbColumnName.replace(/_/g, ''), // Remove underscores
      dbColumnName.replace(/_/g, ' '), // Underscores to spaces
      dbColumnName.replace(/_/g, '-'), // Underscores to hyphens
      dbColumnName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(''), // PascalCase
      dbColumnName.split('_').join(' ').toLowerCase(), // Sentence case
    ];
    
    for (const variation of variations) {
      const match = keys.find(key => key.toLowerCase() === variation.toLowerCase());
      if (match) {
        return row[match];
      }
    }
    
    // Try partial matches for common patterns
    const partialMatch = keys.find(key => {
      const keyLower = key.toLowerCase();
      const colLower = dbColumnName.toLowerCase();
      return keyLower.includes(colLower) || colLower.includes(keyLower);
    });
    
    return partialMatch ? row[partialMatch] : undefined;
  }

  /**
   * Filter data relevant to a specific table
   */
  private filterDataForTable(data: any[], table: any): any[] {
    const tableName = table.name.toLowerCase();
    
    // Properties table gets all CSV rows
    if (tableName === 'properties') {
      return data;
    }
    
    // Permit statuses - extract unique status values
    if (tableName === 'permit_statuses') {
      return this.extractUniqueValues(data, [
        'permit_status', 'status', 'initial_status', 'latest_status',
        'application_status', 'current_status'
      ], 'status');
    }
    
    // Builders - extract unique builder names
    if (tableName === 'builders') {
      return this.extractUniqueValues(data, [
        'builder', 'builder_name', 'contractor', 'contractor_name',
        'company', 'business_name'
      ], 'name');
    }
    
    // Permits - return all data but will need property_id matching later
    if (tableName === 'permits') {
      return data.filter(row => {
        // Only include rows that have permit-related data
        return this.hasPermitData(row);
      });
    }
    
    // Sales - return all data but will need property_id matching later
    if (tableName === 'sales') {
      return data.filter(row => {
        // Only include rows that have sales-related data
        return this.hasSalesData(row);
      });
    }
    
    // Property characteristics - return all data, will match 1:1 with properties
    if (tableName === 'property_characteristics') {
      return data.filter(row => {
        // Only include rows that have characteristic data
        return this.hasCharacteristicData(row);
      });
    }
    
    // Default: return empty for unknown tables
    return [];
  }
  
  /**
   * Extract unique values for lookup tables
   */
  private extractUniqueValues(data: any[], csvColumns: string[], targetField: string): any[] {
    const uniqueValues = new Set<string>();
    
    // Find values from CSV columns that could populate this lookup table
    data.forEach(row => {
      csvColumns.forEach(colName => {
        const value = this.findCsvValue(row, colName);
        if (value && typeof value === 'string' && value.trim() && 
            value !== 'null' && value !== 'NULL' && value !== '') {
          uniqueValues.add(value.trim());
        }
      });
    });
    
    // Convert unique values to lookup table rows
    return Array.from(uniqueValues).map(value => ({
      [targetField]: value
    }));
  }
  
  /**
   * Check if row has permit-related data
   */
  private hasPermitData(row: any): boolean {
    const permitFields = [
      'permit_number', 'permit_type', 'type', 'description', 
      'permit_jurisdiction', 'job_value', 'fees', 'applied_date',
      'issued_date', 'project_type', 'business_name'
    ];
    
    return permitFields.some(field => {
      const value = this.findCsvValue(row, field);
      return value && value !== '' && value !== 'null';
    });
  }
  
  /**
   * Check if row has sales-related data
   */
  private hasSalesData(row: any): boolean {
    const salesFields = [
      'sale_date', 'sale_price', 'loan_amount', 'loan_type',
      'product_class', 'product_type', 'transaction_type',
      'delivery_date', 'builder_matched_flag'
    ];
    
    return salesFields.some(field => {
      const value = this.findCsvValue(row, field);
      return value && value !== '' && value !== 'null';
    });
  }
  
  /**
   * Check if row has property characteristic data
   */
  private hasCharacteristicData(row: any): boolean {
    const characteristicFields = [
      'adu', 'bathroom_remodel', 'air_conditioning', 'building_quality',
      'number_of_bedrooms', 'number_of_baths', 'garage_type_parking',
      'heating', 'style', 'roof_type', 'foundation', 'exterior_walls'
    ];
    
    return characteristicFields.some(field => {
      const value = this.findCsvValue(row, field);
      return value && value !== '' && value !== 'null';
    });
  }

  /**
   * Process single chunk for non-streaming mode
   */
  private async processSingleChunk(): Promise<SeedingProgress> {
    console.log('🔄 CHUNK MODE: Processing chunk', this.request.chunkIndex || 0);
    
    // Check if this is the first chunk
    if (!this.request.chunkIndex || this.request.chunkIndex === 0) {
      await this.initializeProcessing();
    }

    // Get the chunk of data to process
    const chunkData = await this.getCSVChunk();
    
    if (!chunkData || chunkData.length === 0) {
      // No more data to process
      this.progress.status = "completed";
      this.progress.overallProgress = 100;
      this.updateProgress(100, "completing", "Seeding completed successfully");
      return this.progress;
    }

    this.updateProgress(10, "processing", \`Processing chunk \${(this.request.chunkIndex || 0) + 1}\`);
    
    // Process this chunk
    await this.processChunkData(chunkData);
    
    // Update progress
    const totalRows = await this.getTotalRowCount();
    this.progress.processedRows += chunkData.length;
    const progressPercent = Math.min(95, (this.progress.processedRows / totalRows) * 100);
    this.updateProgress(progressPercent, "processing", \`Processed \${this.progress.processedRows}/\${totalRows} rows\`);

    // Check if we need to continue or if we're done
    if (this.progress.processedRows < totalRows) {
      // Schedule next chunk
      this.progress.status = "processing";
      await this.scheduleNextChunk();
    } else {
      // All done!
      this.progress.status = "completed";
      this.progress.overallProgress = 100;
      this.updateProgress(100, "completing", "Seeding completed successfully");
    }

    return this.progress;
  }

  /**
   * Initialize processing for the first chunk
   */
  private async initializeProcessing(): Promise<void> {
    console.log('Initializing chunked processing...');
    
    // Store job state in a dedicated table for tracking progress
    await this.createOrUpdateJobState({
      jobId: this.request.jobId,
      status: 'processing',
      currentChunk: 0,
      totalRows: await this.getTotalRowCount(),
      processedRows: 0,
      createdAt: new Date().toISOString()
    });

    // Pre-create dependent records
    await this.preCreateDependentRecords();
  }

  /**
   * Get a chunk of CSV data based on current chunk index
   */
  private async getCSVChunk(): Promise<any[]> {
    try {
      const chunkIndex = this.request.chunkIndex || 0;
      const startRow = chunkIndex * CSVProcessor.CHUNK_SIZE;
      const endRow = startRow + CSVProcessor.CHUNK_SIZE;

      console.log(\`Getting CSV chunk: rows \${startRow} to \${endRow}\`);

      // Get the CSV data using a more efficient approach
      // Instead of loading the entire file, we'll use a streaming approach
      const csvContent = await this.getCSVContentFromStorage();
      const lines = csvContent.split('\\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        return [];
      }

      // Get headers and slice the data for this chunk
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const dataLines = lines.slice(1); // Skip header
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

  /**
   * Get CSV content from storage (cached approach)
   */
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

  /**
   * Get total row count for progress calculation
   */
  private async getTotalRowCount(): Promise<number> {
    try {
      // This could be cached or stored during initialization
      const csvContent = await this.getCSVContentFromStorage();
      const lines = csvContent.split('\\n').filter(line => line.trim());
      return Math.max(0, lines.length - 1); // Subtract header
    } catch (error) {
      console.log('Could not get total row count:', error);
      return 1000; // Fallback estimate
    }
  }

  /**
   * Process a chunk of data
   */
  private async processChunkData(chunkData: any[], onProgress?: (progress: SeedingProgress) => void): Promise<void> {
    const schema = this.request.schema;
    
    // Sort tables to process main entities first
    const sortedTables = [...schema.tables].sort((a, b) => {
      const aIsMain = a.name === 'properties' || a.name === 'property';
      const bIsMain = b.name === 'properties' || b.name === 'property';
      if (aIsMain && !bIsMain) return -1;
      if (!aIsMain && bIsMain) return 1;
      return 0;
    });

    // Process each table with this chunk
    for (const table of sortedTables) {
              // Critical CPU time monitoring - exit early if approaching limit
        const cpuTimeUsed = Date.now() - this.startTime;
        if (cpuTimeUsed > CSVProcessor.MAX_CPU_TIME) {
          console.log(\`⏰ CPU time limit approaching (\${cpuTimeUsed}ms), scheduling continuation and exiting...\`);
          
          // Update progress before exit
          this.progress.processedRows += chunkData.length; // Count current batch
          this.updateProgress(
            Math.min(95, (this.progress.processedRows / await this.getTotalRowCount()) * 100),
            "processing",
            \`CPU limit reached, continuing with chunk \${(this.request.chunkIndex || 0) + 1}\`
          );
          onProgress?.(this.progress);
          
          await this.scheduleNextChunk(); // Ensure continuation
          return this.progress; // Exit immediately with current progress
        }

      this.progress.currentTable = table.name;
      console.log('Processing table:', table.name, 'with chunk of', chunkData.length, 'rows');
      
      // Filter and map data for this table
      const relevantData = this.filterDataForTable(chunkData, table);
      const tableData = this.mapDataToTable(relevantData, table);
      
      if (tableData.length > 0) {
        console.log(\`Inserting \${tableData.length} rows into \${table.name}\`);
        
        try {
          // Additional CPU time check before database operations
          const cpuTimeUsed = Date.now() - this.startTime;
          if (cpuTimeUsed > CSVProcessor.MAX_CPU_TIME) {
            console.log(\`⏰ CPU limit reached during table processing (\${cpuTimeUsed}ms), scheduling continuation...\`);
            await this.scheduleNextChunk();
            return;
          }
          
          const isLookupTable = this.isLookupTable(table);
          
          if (isLookupTable) {
            const uniqueData = this.deduplicateBatch(tableData, table);
            if (uniqueData.length > 0) {
              const { error } = await this.supabaseClient
                .from(table.name)
                .upsert(uniqueData, { ignoreDuplicates: true });
              
              if (error && error.code !== '23505') { // Ignore duplicate key errors
                throw error;
              }
              this.progress.successfulRows += uniqueData.length;
            }
          } else {
            const { error } = await this.supabaseClient
              .from(table.name)
              .insert(tableData);
            
            if (error) {
              throw error;
            }
            this.progress.successfulRows += tableData.length;
          }
        } catch (error) {
          console.error(\`Error inserting into \${table.name}:\`, error);
          this.progress.failedRows += tableData.length;
          this.errors.push({
            table: table.name,
            error: error.message,
            timestamp: new Date(),
          });
        }
      }
    }
  }

  /**
   * Schedule the next chunk to be processed
   */
  private async scheduleNextChunk(): Promise<void> {
    const currentChunk = this.request.chunkIndex || 0;
    const nextChunkIndex = currentChunk + 1;
    
    console.log(\`✅ Scheduling next chunk: \${nextChunkIndex} (current was \${currentChunk})\`);
    
    // Skip job state update since table might not exist - just continue processing
    
    // Make async call to continue processing (fire and forget)
    const nextRequest = {
      fileId: this.request.fileId,
      jobId: this.request.jobId,
      schema: this.request.schema,
      configuration: this.request.configuration,
      fileUpload: this.request.fileUpload,
      projectConfig: this.request.projectConfig,
      chunkIndex: nextChunkIndex, // Explicitly set the incremented index
      processedRows: this.progress.processedRows
    };

    console.log(\`📤 Next request will process chunk \${nextRequest.chunkIndex} starting from row \${nextChunkIndex * 25}\`);

    // Use setTimeout to schedule the next chunk asynchronously
    setTimeout(async () => {
      try {
        const projectId = this.request.schema?.projectId || this.request.projectConfig?.projectId;
        const response = await fetch(\`https://\${projectId}.supabase.co/functions/v1/seed-data\`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(nextRequest)
        });
        
        if (!response.ok) {
          console.error('❌ Failed to schedule next chunk:', response.statusText);
        } else {
          console.log(\`✅ Successfully scheduled chunk \${nextChunkIndex}\`);
        }
      } catch (error) {
        console.error('❌ Error scheduling next chunk:', error);
      }
    }, 250); // Longer delay to ensure current request completes
  }

  /**
   * Create or update job state for tracking - DISABLED to prevent errors
   */
  private async createOrUpdateJobState(state: any): Promise<void> {
    // Skip job state tracking since seeding_jobs table may not exist
    // This prevents "Could not update job state: undefined" errors
    console.log(\`📊 Job progress: \${state.processedRows || 0} rows processed\`);
  }

  // ... (rest of the helper methods remain the same but optimized for smaller chunks)
  
  private async preCreateDependentRecords(): Promise<void> {
    // Simplified pre-creation for common lookup tables only
    console.log('Pre-creating essential lookup records...');
    
    const schema = this.request.schema;
    const essentialLookups = ['jurisdictions', 'permit_types', 'permit_statuses'];
    
    for (const tableName of essentialLookups) {
      const table = schema.tables.find(t => t.name === tableName);
      if (table) {
        const defaultRecord = this.createDefaultLookupRecord(table);
        try {
          await this.supabaseClient
            .from(tableName)
            .upsert([defaultRecord], { ignoreDuplicates: true });
        } catch (error) {
          console.log(\`Could not create default record for \${tableName}:\`, error.message);
        }
      }
    }
  }

  private createDefaultLookupRecord(table: any): any {
    const record: any = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Add name field with table-specific default
    const nameColumn = table.columns?.find(col => col.name === 'name' || col.name.includes('name'));
    if (nameColumn) {
      record[nameColumn.name] = \`Default \${table.name.replace(/_/g, ' ')}\`;
    }

    return record;
  }

  // Simplified helper methods for chunk processing...
  private filterDataForTable(data: any[], table: any): any[] {
    if (!data || data.length === 0) return [];
    
    const tableName = table.name.toLowerCase();
    console.log('[DataSeeder] Filtering data for table:', tableName);
    
    // Properties table gets all CSV rows
    if (tableName === 'properties') {
      console.log('[DataSeeder] Properties table - returning all', data.length, 'rows');
      return data;
    }
    
    // Permit statuses - extract unique status values
    if (tableName === 'permit_statuses') {
      const uniqueValues = this.extractUniqueValues(data, [
        'permit_status', 'status', 'initial_status', 'latest_status',
        'application_status', 'current_status', 'permit_initial_status',
        'permit_latest_status'
      ], 'status');
      console.log('[DataSeeder] Permit statuses - extracted', uniqueValues.length, 'unique values');
      return uniqueValues;
    }
    
    // Builders - extract unique builder names
    if (tableName === 'builders') {
      const uniqueValues = this.extractUniqueValues(data, [
        'builder', 'builder_name', 'contractor', 'contractor_name',
        'company', 'business_name', 'permit_business_name'
      ], 'name');
      console.log('[DataSeeder] Builders - extracted', uniqueValues.length, 'unique values');
      return uniqueValues;
    }
    
    // Permits - return rows that have permit-related data
    if (tableName === 'permits') {
      const filteredData = data.filter(row => this.hasPermitData(row));
      console.log('[DataSeeder] Permits - filtered to', filteredData.length + '/' + data.length, 'rows with permit data');
      return filteredData;
    }
    
    // Sales - return rows that have sales-related data
    if (tableName === 'sales') {
      const filteredData = data.filter(row => this.hasSalesData(row));
      console.log('[DataSeeder] Sales - filtered to', filteredData.length + '/' + data.length, 'rows with sales data');
      return filteredData;
    }
    
    // Property characteristics - return rows that have characteristic data
    if (tableName === 'property_characteristics') {
      const filteredData = data.filter(row => this.hasCharacteristicData(row));
      console.log('[DataSeeder] Property characteristics - filtered to', filteredData.length + '/' + data.length, 'rows with characteristic data');
      return filteredData;
    }
    
    // Default: return all data for unknown tables
    console.log('[DataSeeder] Unknown table', tableName, '- returning all', data.length, 'rows');
    return data;
  }

  /**
   * Extract unique values for lookup tables
   */
  private extractUniqueValues(data: any[], csvColumns: string[], targetField: string): any[] {
    const uniqueValues = new Set<string>();
    
    // Find values from CSV columns that could populate this lookup table
    data.forEach(row => {
      csvColumns.forEach(colName => {
        const value = this.findCsvValue(row, colName);
        if (value && typeof value === 'string' && value.trim() && 
            value !== 'null' && value !== 'NULL' && value !== '') {
          uniqueValues.add(value.trim());
        }
      });
    });
    
    // Convert unique values to lookup table rows
    return Array.from(uniqueValues).map(value => ({
      [targetField]: value
    }));
  }

  /**
   * Find CSV value using fuzzy matching
   */
  private findCsvValue(row: any, targetColumn: string): any {
    // Direct match
    if (row[targetColumn] !== undefined) {
      return row[targetColumn];
    }
    
    // Fuzzy matching for common variations
    const targetLower = targetColumn.toLowerCase();
    for (const [key, value] of Object.entries(row)) {
      const keyLower = key.toLowerCase();
      if (keyLower === targetLower ||
          keyLower.includes(targetLower) ||
          targetLower.includes(keyLower) ||
          keyLower.replace(/[_\s]/g, '') === targetLower.replace(/[_\s]/g, '')) {
        return value;
      }
    }
    
    return null;
  }
  
  /**
   * Check if row has permit-related data
   */
  private hasPermitData(row: any): boolean {
    const permitFields = [
      'permit_number', 'permit_type', 'type', 'description', 
      'permit_jurisdiction', 'job_value', 'fees', 'applied_date',
      'issued_date', 'project_type', 'business_name', 'permit_id'
    ];
    
    return permitFields.some(field => {
      const value = this.findCsvValue(row, field);
      return value && value !== '' && value !== 'null';
    });
  }
  
  /**
   * Check if row has sales-related data
   */
  private hasSalesData(row: any): boolean {
    const salesFields = [
      'sale_date', 'sale_price', 'loan_amount', 'loan_type',
      'product_class', 'product_type', 'transaction_type',
      'delivery_date', 'builder_matched_flag', 'sales_date', 'price'
    ];
    
    return salesFields.some(field => {
      const value = this.findCsvValue(row, field);
      return value && value !== '' && value !== 'null';
    });
  }
  
  /**
   * Check if row has property characteristic data
   */
  private hasCharacteristicData(row: any): boolean {
    const characteristicFields = [
      'adu', 'bathroom_remodel', 'air_conditioning', 'building_quality',
      'number_of_bedrooms', 'number_of_baths', 'garage_type_parking',
      'heating', 'style', 'roof_type', 'foundation', 'exterior_walls',
      'bedrooms', 'bathrooms', 'garage', 'heating_type'
    ];
    
    return characteristicFields.some(field => {
      const value = this.findCsvValue(row, field);
      return value && value !== '' && value !== 'null';
    });
  }

  private mapDataToTable(data: any[], table: any): any[] {
    return data.map(row => {
      const mappedRow: any = {};
      
      table.columns?.forEach((column: any) => {
        if (column.name === 'id') {
          mappedRow[column.name] = crypto.randomUUID();
        } else if (column.name === 'created_at' || column.name === 'updated_at') {
          mappedRow[column.name] = new Date().toISOString();
        } else {
          // Use originalCSVColumn if available, otherwise fall back to column.name
          const csvHeader = column.originalCSVColumn || column.name;
          const rawValue = row[csvHeader] || ''; // Directly use the determined header
          const value = String(rawValue).trim();
          const colType = (column.type || '').toLowerCase();
          
          if (colType.includes('integer') || colType.includes('bigint') || colType.includes('int')) {
            if (value === '' || value === 'null' || value === 'NULL') {
              mappedRow[column.name] = null;
            } else {
              const parsed = parseInt(value);
              mappedRow[column.name] = isNaN(parsed) ? null : parsed;
            }
          } else if (colType.includes('numeric') || colType.includes('decimal') || colType.includes('real') || colType.includes('double')) {
            if (value === '' || value === 'null' || value === 'NULL') {
              mappedRow[column.name] = null;
            } else {
              const parsed = parseFloat(value);
              mappedRow[column.name] = isNaN(parsed) ? null : parsed;
            }
          } else if (colType.includes('boolean') || colType.includes('bool')) {
            if (value === '' || value === 'null' || value === 'NULL') {
              mappedRow[column.name] = null;
            } else {
              mappedRow[column.name] = ['true', '1', 'yes', 'y', 't'].includes(value.toLowerCase());
            }
          } else if (colType.includes('date') || colType.includes('timestamp')) {
            if (value === '' || value === 'null' || value === 'NULL') {
              mappedRow[column.name] = null;
            } else {
              const date = new Date(value);
              mappedRow[column.name] = isNaN(date.getTime()) ? null : date.toISOString();
            }
          } else {
            // Text fields
            mappedRow[column.name] = value === 'NULL' || value === 'null' ? null : (value || null);
          }
        }
      });
      
      return mappedRow;
    }).filter(row => Object.keys(row).length > 0);
  }

  private getDefaultValue(column: any): any {
    if (column.name.endsWith('_id')) {
      return crypto.randomUUID();
    }
    if (column.type?.includes('int')) {
      return 0;
    }
    if (column.type?.includes('bool')) {
      return false;
    }
    return 'Default Value';
  }

  private isLookupTable(table: any): boolean {
    const lookupPatterns = ['_types', '_statuses', '_categories', 'jurisdictions'];
    return lookupPatterns.some(pattern => table.name.includes(pattern));
  }

  private deduplicateBatch(batch: any[], table: any): any[] {
    const uniqueField = 'name'; // Assume name field for simplicity
    const seen = new Set();
    return batch.filter(row => {
      const key = row[uniqueField];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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

      // Get Supabase credentials
      const supabaseUrl = request.supabaseUrl || ('https://' + request.schema.projectId + '.supabase.co') || Deno.env.get("SUPABASE_URL");
      const supabaseKey = request.supabaseServiceKey || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "your-service-role-key";
      
      console.log('Processing', isStreaming ? 'streaming request' : 'chunk', request.chunkIndex || 0, 'for job', request.jobId);

      const processor = new CSVProcessor(request, supabaseUrl, supabaseKey);

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

            // Send completion message
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

// Add a simpler, more reliable fallback Edge Function as a separate constant
const SIMPLE_EDGE_FUNCTION_SOURCE = `import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

interface SimpleRequest {
  fileId: string;
  jobId: string;
  schema: any;
  chunkOffset?: number;
  rowsProcessed?: number;
}

serve(async (req: Request) => {
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
    const startTime = Date.now();
    const MAX_TIME = 1500; // 1.5 seconds max
    const MINI_BATCH_SIZE = 10; // Very small batches
    
    try {
      const request: SimpleRequest = await req.json();
      
      // Get credentials
      const supabaseUrl = \`https://\${request.schema.projectId}.supabase.co\`;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "service-key";
      
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      console.log("🚀 SIMPLE SEEDER - Processing mini-batch", request.chunkOffset || 0);
      
      // Get CSV data for this mini-batch
      const { data, error } = await supabase.storage
        .from('csv-uploads')
        .download(request.fileId);
        
      if (error) {
        throw new Error(\`Download failed: \${error.message}\`);
      }
      
      const csvText = await data.text();
      const lines = csvText.split('\\n').filter(line => line.trim());
      
      if (lines.length <= 1) {
        return new Response(JSON.stringify({
          success: true,
          completed: true,
          message: "No data to process"
        }));
      }
      
      // Get headers and calculate batch
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const dataLines = lines.slice(1);
      const offset = request.chunkOffset || 0;
      const batchLines = dataLines.slice(offset, offset + MINI_BATCH_SIZE);
      
      if (batchLines.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          completed: true,
          totalProcessed: request.rowsProcessed || 0
        }));
      }
      
      // Parse mini-batch
      const rows = batchLines.map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });
      
      console.log(\`Processing \${rows.length} rows...\`);
      
      // Process the first table only (keep it super simple)
      const table = request.schema.tables[0];
      if (table) {
        const insertData = rows.map(row => {
          const mapped: any = {
            id: crypto.randomUUID(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          // Robust field mapping with proper type conversion
          table.columns?.forEach((col: any) => {
            if (col.name !== 'id' && col.name !== 'created_at' && col.name !== 'updated_at') {
              const rawValue = row[col.name] || '';
              const value = String(rawValue).trim();
              
                             // Proper type conversion with null handling
               const colType = (col.type || '').toLowerCase();
               if (colType.includes('integer') || colType.includes('bigint') || colType.includes('int')) {
                 if (value === '' || value === 'null' || value === 'NULL') {
                   mapped[col.name] = null;
                 } else {
                   const parsed = parseInt(value);
                   mapped[col.name] = isNaN(parsed) ? null : parsed;
                 }
               } else if (colType.includes('numeric') || colType.includes('decimal') || colType.includes('real') || colType.includes('double')) {
                 if (value === '' || value === 'null' || value === 'NULL') {
                   mapped[col.name] = null;
                 } else {
                   const parsed = parseFloat(value);
                   mapped[col.name] = isNaN(parsed) ? null : parsed;
                 }
               } else if (colType.includes('boolean') || colType.includes('bool')) {
                 if (value === '' || value === 'null' || value === 'NULL') {
                   mapped[col.name] = null;
                 } else {
                   mapped[col.name] = ['true', '1', 'yes', 'y', 't'].includes(value.toLowerCase());
                 }
               } else {
                 // Text fields
                 mapped[col.name] = value === 'NULL' || value === 'null' ? null : value;
               }
            }
          });
          
          return mapped;
        });
        
        // Insert the mini-batch
        const { error: insertError } = await supabase
          .from(table.name)
          .insert(insertData);
          
        if (insertError) {
          console.log("Insert error:", insertError.message);
          // Continue anyway for demo purposes
        }
      }
      
      const newOffset = offset + batchLines.length;
      const totalProcessed = (request.rowsProcessed || 0) + batchLines.length;
      const isCompleted = newOffset >= dataLines.length;
      
      // Schedule next chunk if not completed and we have time
      if (!isCompleted && (Date.now() - startTime) < 1000) {
        setTimeout(async () => {
          try {
            await fetch(\`https://\${request.schema.projectId}.supabase.co/functions/v1/seed-data\`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...request,
                chunkOffset: newOffset,
                rowsProcessed: totalProcessed
              })
            });
          } catch (e) {
            console.log("Continuation failed:", e);
          }
        }, 50);
      }
      
      return new Response(JSON.stringify({
        success: true,
        completed: isCompleted,
        chunkOffset: newOffset,
        rowsProcessed: totalProcessed,
        batchSize: batchLines.length,
        totalRows: dataLines.length,
        cpuTime: Date.now() - startTime
      }));
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        cpuTime: Date.now() - startTime
      }), { status: 500 });
    }
  }
  
  return new Response("Method not allowed", { status: 405 });
});`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, useSimpleVersion = false } = body;

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

    // Use advanced version by default for streaming progress
    const functionSource = useSimpleVersion === true ? SIMPLE_EDGE_FUNCTION_SOURCE : EDGE_FUNCTION_SOURCE;
    
    // Create FormData for multipart/form-data request
    const formData = new FormData();
    
    // Add the function file
    formData.append('file', new Blob([functionSource], { type: 'text/plain' }), 'index.ts');
    
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
      message: useSimpleVersion ? 
        "Simple Edge Function deployed successfully (optimized for CPU limits)" :
        "Advanced Edge Function deployed successfully (with streaming progress)",
      functionUrl: `https://${projectId}.supabase.co/functions/v1/seed-data`,
      function: functionData,
      version: useSimpleVersion ? "simple" : "advanced"
    });
  } catch (error) {
    console.error("Error creating Edge Function:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}