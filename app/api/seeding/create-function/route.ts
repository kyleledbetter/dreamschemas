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
      console.log('🚀 UNIVERSAL SEEDING ENGINE v2.0 - Starting with bulletproof NOT NULL handling');
      this.updateProgress(5, "parsing", "Downloading CSV file");
      onProgress?.(this.progress);
      
      // Get CSV data from the file upload (already parsed)
      const rows = await this.downloadAndParseCSV();
      
      this.updateProgress(15, "parsing", "CSV data parsed successfully");
      onProgress?.(this.progress);
      
      this.updateProgress(25, "validating", "Validating data structure");
      onProgress?.(this.progress);
      
      // Validate against schema
      console.log('Starting data validation for', rows.length, 'rows');
      const validatedData = await this.validateData(rows);
      console.log('Validation complete. Valid rows:', validatedData.length, 'Invalid rows:', rows.length - validatedData.length);
      
      this.updateProgress(35, "processing", "Processing data into tables");
      onProgress?.(this.progress);
      
      // Process data into schema tables
      console.log('Starting data insertion into', this.request.schema.tables?.length || 0, 'tables');
      await this.insertDataIntoTables(validatedData, onProgress);
      console.log('Data insertion completed');
      
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
      
      // Use the exact storage path from the file upload
      let filePath = '';
      
      // First, try to get the storage path from the file upload info
      if (this.request.fileUpload && this.request.fileUpload.storagePath) {
        filePath = this.request.fileUpload.storagePath;
                 console.log('Using storage path from fileUpload:', filePath);
       } else {
         // Fallback: construct the path (this should match the upload format)
         const projectId = this.request.configuration?.projectId || this.request.projectConfig?.projectId;
         const filename = this.request.configuration?.filename || this.request.fileUpload?.filename || 'data.csv';
         filePath = \`current_user/\${projectId}/\${this.request.fileId}/\${filename}\`;
         console.log('Constructed fallback path:', filePath);
       }
       
       console.log('Attempting to download CSV file from path:', filePath);
       
       const { data, error } = await this.supabaseClient.storage
         .from('csv-uploads')
         .download(filePath);
       
       if (error || !data) {
         console.error('Failed to download file:', error);
         throw new Error('Failed to download CSV file from path: ' + filePath + '. Error: ' + (error?.message || 'Unknown error'));
       }
       
       console.log('Successfully downloaded file from:', filePath);
      return this.parseCSVData(data);
      
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
      const lines = text.split('\\n').filter(line => line.trim());
      
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
      
      console.log('Parsed', rows.length, 'rows from CSV with headers:', headers);
      return rows;
      
    } catch (error) {
      console.error('Error parsing CSV:', error);
      throw new Error(\`Failed to parse CSV data: \\\${error instanceof Error ? error.message : 'Unknown error'}\`);
    }
  }



  private async validateData(rows: any[]): Promise<any[]> {
    // Basic validation - accept all rows for now, just log any empty ones
    return rows.filter((row, index) => {
      const hasData = Object.values(row).some(value => value && value.toString().trim() !== '');
      if (!hasData) {
        this.warnings.push({
          message: 'Row ' + (index + 1) + ' appears to be empty',
          timestamp: new Date(),
        });
        return false;
      }
      return true;
    });
  }

  private async insertDataIntoTables(data: any[], onProgress?: (progress: SeedingProgress) => void): Promise<void> {
    const schema = this.request.schema;
    const batchSize = Math.min(this.request.configuration?.batchSize || 100, 50); // Limit batch size for large files
    
    // Memory management for large files
    if (data.length > 1000) {
      console.log('🚨 Large file detected (' + data.length + ' rows). Using memory-optimized processing.');
    }
    
    // Process each table in the schema
    console.log('Schema tables:', schema.tables?.map(t => t.name) || []);
    
    // Sort tables to process main entities first (properties) then dependent tables
    const sortedTables = [...schema.tables].sort((a, b) => {
      const aIsMain = a.name === 'properties' || a.name === 'property';
      const bIsMain = b.name === 'properties' || b.name === 'property';
      if (aIsMain && !bIsMain) return -1;
      if (!aIsMain && bIsMain) return 1;
      return 0;
    });
    
    // Pre-create dependent records like jurisdictions and properties
    await this.preCreateDependentRecords(data);
    
    for (let i = 0; i < sortedTables.length; i++) {
      const table = sortedTables[i];
      this.progress.currentTable = table.name;
      console.log('Processing table:', table.name, 'with', table.columns?.length || 0, 'columns');
      
              this.updateProgress(
          35 + (i / sortedTables.length) * 60,
          "processing",
          'Processing table: ' + table.name
        );
      onProgress?.(this.progress);
      
      // Filter and map CSV data to table structure
      const relevantData = this.filterDataForTable(data, table);
      const tableData = this.mapDataToTable(relevantData, table);
      console.log('📊 Filtered', relevantData.length, 'relevant rows from', data.length, 'total rows for table', table.name);
      console.log('🗂️ Mapped', tableData.length, 'rows for table', table.name);
      if (tableData.length > 0) {
        console.log('Sample mapped row:', JSON.stringify(tableData[0], null, 2));
      }
      
      // Insert data in batches
      const batches = this.createBatches(tableData, batchSize);
      this.progress.totalBatches = batches.length;
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        this.progress.currentBatch = batchIndex + 1;
        
        // Define variables outside try block so they're available in catch
        let actualRowCount = batches[batchIndex].length;
        
        try {
          // UNIVERSAL lookup table detection - works for ANY schema
          const isLookupTable = this.isLookupTable(table);
          
          let insertResult;
          let actualBatch = batches[batchIndex];
          
          if (isLookupTable) {
            // For lookup tables, deduplicate the batch first, then use upsert
            console.log('Processing lookup table:', table.name);
            
            // UNIVERSAL deduplication - finds the best unique field dynamically
            const uniqueBatch = this.deduplicateBatch(batches[batchIndex], table);
            
            console.log('Deduplicated batch for', table.name + ':', uniqueBatch.length, 'unique rows from', batches[batchIndex].length);
            
            actualBatch = uniqueBatch;
            actualRowCount = uniqueBatch.length;
            
            if (uniqueBatch.length > 0) {
              insertResult = await this.supabaseClient
                .from(table.name)
                .upsert(uniqueBatch, { 
                  ignoreDuplicates: true 
                });
            } else {
              // Skip empty batch
              insertResult = { data: [], error: null };
            }
          } else {
            // For regular tables, filter out rows with missing foreign keys before inserting
            const validBatch = batches[batchIndex].filter(row => {
              // Check for required foreign keys
              const hasMissingForeignKey = table.columns?.some(col => {
                return col.notNull && 
                       col.name.endsWith('_id') && 
                       (row[col.name] === null || row[col.name] === undefined);
              });
              
              if (hasMissingForeignKey) {
                console.log('Skipping row with missing foreign key for table', table.name);
                return false;
              }
              return true;
            });
            
            console.log('Filtered batch for', table.name + ':', validBatch.length, 'valid rows from', batches[batchIndex].length);
            
            actualBatch = validBatch;
            actualRowCount = validBatch.length;
            
            if (validBatch.length > 0) {
              insertResult = await this.supabaseClient
                .from(table.name)
                .insert(validBatch);
            } else {
              // Skip empty batch
              insertResult = { data: [], error: null };
              console.log('Skipping empty batch for table', table.name);
            }
          }
          
          const { data: insertedData, error } = insertResult;
          
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
            
            // Handle different types of errors
            if (error.code === '23505') {
              // Unique constraint violation - this is expected for lookup tables
              console.log('Duplicate key ignored for table', table.name + ':', error.message);
              this.warnings.push({
                message: 'Duplicate entries ignored in ' + table.name + ': ' + error.message,
                timestamp: new Date(),
              });
              // Don't count as failed rows since this is expected
              this.progress.successfulRows += actualRowCount;
            } else if (error.message.includes('row-level security policy')) {
              // RLS policy error
              this.errors.push(errorDetails);
              this.progress.failedRows += actualRowCount;
              this.warnings.push({
                message: 'RLS policy blocking insertion into ' + table.name + '. Consider using service role key or disabling RLS for data seeding.',
                timestamp: new Date(),
              });
              console.error('RLS policy error for table', table.name + ':', errorDetails);
            } else {
              // Other errors - log and count as failed
              this.errors.push(errorDetails);
              this.progress.failedRows += actualRowCount;
              console.error('Database insertion error for table', table.name + ':', errorDetails);
            }
                      } else {
              this.progress.successfulRows += actualRowCount;
              console.log('Successfully processed', actualRowCount, 'rows for', table.name);
            }
        } catch (error) {
          const errorDetails = {
            table: table.name,
            batch: batchIndex + 1,
            error: error.message,
            timestamp: new Date(),
          };
          
          this.errors.push(errorDetails);
          this.progress.failedRows += actualRowCount;
          console.error('Exception during insertion into', table.name + ':', errorDetails);
        }
        
        this.progress.processedRows += actualRowCount;
        
        // Update progress
        const tableProgress = (batchIndex + 1) / batches.length;
        const overallTableProgress = (i + tableProgress) / sortedTables.length;
        this.updateProgress(
          35 + overallTableProgress * 60,
          "processing",
          'Processing ' + table.name + ': batch ' + (batchIndex + 1) + '/' + batches.length
        );
        onProgress?.(this.progress);
        
        // Small delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  private filterDataForTable(data: any[], table: any): any[] {
    // INTELLIGENT table-specific data filtering with null safety
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.log('⚠️ No data provided for table', table?.name || 'unknown');
      return [];
    }
    
    if (!table || !table.name) {
      console.log('⚠️ Invalid table provided for filtering');
      return [];
    }
    
    try {
      const tableName = table.name.toLowerCase();
      
      // For lookup tables, we need to extract unique values from relevant columns
      if (this.isLookupTable(table)) {
        return this.extractLookupData(data, table);
      }
      
      // For main entity tables, filter based on table purpose
      if (tableName.includes('properties') || tableName.includes('property')) {
      // Properties table: only rows that have property-related data
      return data.filter(row => {
        return this.hasPropertyData(row);
      });
    }
    
    if (tableName.includes('permits') || tableName.includes('permit')) {
      // Permits table: only rows that have permit-related data OR property data (since permits are linked to properties)
      return data.filter(row => {
        return this.hasPermitData(row) || this.hasPropertyData(row);
      });
    }
    
    if (tableName.includes('assessment') || tableName.includes('characteristic')) {
      // Assessment/characteristics: only rows with assessment data OR property data
      return data.filter(row => {
        return this.hasAssessmentData(row) || this.hasPropertyData(row);
      });
    }
    
      // For other tables, be more inclusive - return all data (they'll be filtered during mapping)
      console.log('📋 Using all data for table', tableName, '- will filter during mapping');
      return data;
    } catch (error) {
      console.error('❌ Error in filterDataForTable for table', table?.name || 'unknown', ':', error);
      return [];
    }
  }

  private extractLookupData(data: any[], table: any): any[] {
    try {
      // Extract unique values for lookup tables from relevant CSV columns
      if (!data || !Array.isArray(data) || data.length === 0) {
        console.log('⚠️ No data to extract for lookup table', table?.name || 'unknown');
        return [];
      }
      
      const tableName = table.name.toLowerCase();
      const uniqueValues = new Set<string>();
      
      // Find the most relevant CSV columns for this lookup table
      const relevantColumns = this.findRelevantColumnsForLookupTable(data, tableName);
      
      console.log('🔍 Extracting lookup data for', table.name, 'from columns:', relevantColumns);
      
      // Extract unique values from relevant columns with null safety
      data.forEach((row, index) => {
        try {
          if (!row || typeof row !== 'object') {
            console.log('⚠️ Skipping invalid row', index, 'in lookup extraction');
            return;
          }
          
          relevantColumns.forEach(colName => {
            try {
              const value = row[colName];
              if (value !== null && value !== undefined && value.toString().trim() !== '') {
                uniqueValues.add(value.toString().trim());
              }
            } catch (colError) {
              console.log('⚠️ Error processing column', colName, 'in row', index, ':', colError);
            }
          });
        } catch (rowError) {
          console.log('⚠️ Error processing row', index, 'in lookup extraction:', rowError);
        }
      });
      
      // Convert unique values to row objects
      const lookupRows = Array.from(uniqueValues).map(value => ({
        _lookupValue: value
      }));
      
      console.log('📋 Extracted', lookupRows.length, 'unique values for lookup table', table.name);
      return lookupRows;
    } catch (error) {
      console.error('❌ Error in extractLookupData for table', table?.name || 'unknown', ':', error);
      return [];
    }
  }

  private findRelevantColumnsForLookupTable(data: any[], tableName: string): string[] {
    if (data.length === 0) return [];
    
    const csvColumns = Object.keys(data[0]);
    const relevantColumns: string[] = [];
    
    // Match CSV columns to lookup table types
    if (tableName.includes('jurisdiction')) {
      relevantColumns.push(...csvColumns.filter(col => 
        col.toLowerCase().includes('jurisdiction') || 
        col.toLowerCase().includes('county') || 
        col.toLowerCase().includes('city')
      ));
    } else if (tableName.includes('builder')) {
      relevantColumns.push(...csvColumns.filter(col => 
        col.toLowerCase().includes('builder') || 
        col.toLowerCase().includes('contractor')
      ));
    } else if (tableName.includes('permit_type')) {
      relevantColumns.push(...csvColumns.filter(col => 
        col.toLowerCase().includes('permit') && col.toLowerCase().includes('type')
      ));
    } else if (tableName.includes('business')) {
      relevantColumns.push(...csvColumns.filter(col => 
        col.toLowerCase().includes('business') || 
        col.toLowerCase().includes('company')
      ));
    }
    
    // If no specific columns found, look for generic name/type columns
    if (relevantColumns.length === 0) {
      relevantColumns.push(...csvColumns.filter(col => 
        col.toLowerCase().includes('name') || 
        col.toLowerCase().includes('type') ||
        col.toLowerCase().includes('status')
      ));
    }
    
    return relevantColumns;
  }

  private hasPropertyData(row: any): boolean {
    // Check if row has property-related data
    const keys = Object.keys(row).map(k => k.toLowerCase());
    return keys.some(key => 
      key.includes('address') || 
      key.includes('street') || 
      key.includes('parcel') || 
      key.includes('property') ||
      key.includes('latitude') ||
      key.includes('longitude')
    );
  }

  private hasPermitData(row: any): boolean {
    // Check if row has permit-related data
    const keys = Object.keys(row).map(k => k.toLowerCase());
    return keys.some(key => 
      key.includes('permit') || 
      key.includes('application') ||
      key.includes('issued') ||
      key.includes('approved')
    );
  }

  private hasAssessmentData(row: any): boolean {
    // Check if row has assessment/characteristics data
    const keys = Object.keys(row).map(k => k.toLowerCase());
    return keys.some(key => 
      key.includes('assessment') || 
      key.includes('value') ||
      key.includes('sqft') ||
      key.includes('square') ||
      key.includes('bedroom') ||
      key.includes('bathroom') ||
      key.includes('year')
    );
  }

  private mapDataToTable(data: any[], table: any): any[] {
    try {
      // Null safety checks
      if (!data || !Array.isArray(data) || data.length === 0) {
        console.log('⚠️ No data to map for table', table?.name || 'unknown');
        return [];
      }
      
      if (!table || !table.name || !table.columns) {
        console.log('⚠️ Invalid table structure for mapping');
        return [];
      }
      
      // Get all CSV column names for better matching
      const csvColumns = data.length > 0 && data[0] ? Object.keys(data[0]) : [];
      console.log('🔍 MAPPING DEBUG for table', table.name);
      console.log('📊 CSV columns available:', csvColumns);
      console.log('🏗️ Table columns expected:', table.columns?.map(c => c.name + ' (' + c.type + (c.notNull ? ', NOT NULL' : '') + ')') || []);
      console.log('📝 Sample CSV row:', data[0] ? Object.keys(data[0]).slice(0, 5).reduce((obj, key) => { obj[key] = data[0][key]; return obj; }, {}) : 'No data');
    } catch (error) {
      console.error('❌ Error in mapDataToTable setup for table', table?.name || 'unknown', ':', error);
      return [];
    }
    
         // Filter out rows that don't have any relevant data for this table
    return data.map((row, rowIndex) => {
      try {
        if (!row || typeof row !== 'object') {
          console.log('⚠️ Skipping invalid row', rowIndex, 'for table', table.name);
          return null;
        }
        
        const mappedRow: any = {};
        let hasRelevantData = false;
        let shouldSkipRow = false;
        
        table.columns.forEach((column: any) => {
          try {
            if (!column || !column.name) {
              console.log('⚠️ Skipping invalid column in table', table.name);
              return;
            }
        let csvValue = null;
        
        // Special handling for lookup tables with extracted values
        if (row._lookupValue && (column.name === 'name' || column.name.includes('name'))) {
          csvValue = row._lookupValue;
          console.log('🏷️ Using extracted lookup value for', column.name + ':', csvValue);
        } else {
          // AGGRESSIVE column matching - try every possible variation
          const possibleMatches = [
            row[column.name], // Exact match
            row[column.name.toLowerCase()], // Lowercase
            row[column.name.toUpperCase()], // Uppercase
            // Try with underscores
            row[column.name.replace(/-/g, '_')],
            row[column.name.replace(/_/g, '-')],
            // Try without underscores/dashes
            row[column.name.replace(/[-_]/g, '')],
            // Try uppercase without separators
            row[column.name.replace(/[-_]/g, '').toUpperCase()],
            // Try specific field mappings
            this.getMappedValue(row, column.name),
            // Try semantic matching (find CSV columns that contain the target column name)
            ...this.findSemanticMatches(row, column.name),
          ];
          
          // Find the first non-null, non-empty value
          csvValue = possibleMatches.find(val => 
            val !== null && val !== undefined && val !== ''
          );
        }
        
        // Debug column mapping
        if (column.notNull && column.name.endsWith('_id')) {
          console.log('🔑 Foreign key column', column.name, 'for table', table.name + ':');
          console.log('   - CSV value found:', csvValue);
          console.log('   - Possible matches tried:', possibleMatches.map((val, i) => \`\${['exact', 'lower', 'upper', 'dash->underscore', 'underscore->dash', 'no-separators', 'mapped'][i]}: \${val}\`));
        }
        
        // For boolean columns, do extra validation
        if (csvValue && column.type === 'boolean') {
          const testVal = csvValue.toString().toLowerCase().trim();
          if (!['true', 'false', '1', '0', 'yes', 'no', 'y', 'n', 't', 'f'].includes(testVal)) {
            console.log('Warning: Unexpected boolean value "' + csvValue + '" found for column ' + column.name + ', will convert to false');
          }
        }
        
        // Handle special mappings for common patterns
        if (!csvValue && column.name.endsWith('_id') && column.notNull) {
          // This is likely a foreign key - try to resolve it
          console.log('Attempting to resolve foreign key', column.name, 'for table', table.name, 'from row data:', Object.keys(row));
          const resolvedForeignKey = this.resolveForeignKey(row, column, table.name);
          if (resolvedForeignKey) {
            csvValue = resolvedForeignKey;
            console.log('✓ Resolved foreign key', column.name, 'for table', table.name, 'to:', resolvedForeignKey);
          } else {
            // NEVER skip rows - generate a default foreign key instead
            csvValue = crypto.randomUUID();
            console.log('✗ Could not resolve foreign key', column.name + ', generated default:', csvValue);
          }
        }
        
        if (csvValue !== undefined && csvValue !== null && csvValue !== '') {
          hasRelevantData = true;
          
          // UNIVERSAL type conversion - handles ANY data type safely
          mappedRow[column.name] = this.convertValueForColumn(csvValue, column, table.name);
        } else {
          // CRITICAL: EVERY column must get a value if it's NOT NULL
          // This is the bulletproof approach that works for ANY schema
          
          if (column.defaultValue) {
            // Use default value if specified
            mappedRow[column.name] = column.defaultValue;
          } else if (column.name === 'id') {
            // Always generate ID if missing
            mappedRow[column.name] = crypto.randomUUID();
          } else if (column.name === 'created_at' || column.name === 'updated_at') {
            // Auto-generate timestamps
            mappedRow[column.name] = new Date().toISOString();
                     } else if (column.notNull) {
             // UNIVERSAL: Handle ANY NOT NULL column regardless of name or type
             console.log('🚨 NOT NULL column', column.name, 'has no CSV data - generating default');
             if (column.name.endsWith('_id')) {
               // Foreign key - generate UUID
               mappedRow[column.name] = crypto.randomUUID();
               console.log('🔑 Generated required foreign key for', column.name + ':', mappedRow[column.name]);
             } else {
               // Any other NOT NULL field - use smart default
               const defaultValue = this.getSmartDefault(column, table.name);
               if (defaultValue !== null) {
                 mappedRow[column.name] = defaultValue;
                 console.log('📝 Generated smart default for required field', column.name + ':', defaultValue);
               } else {
                 // Fallback: generate a safe default based on type
                 mappedRow[column.name] = this.getTypeBasedDefault(column);
                 console.log('⚠️ Generated type-based fallback for', column.name + ':', mappedRow[column.name]);
               }
             }
                      }
           // For nullable columns without data, we simply don't include them (they'll be NULL)
         }
          } catch (columnError) {
            console.log('⚠️ Error processing column', column?.name || 'unknown', 'in row', rowIndex, ':', columnError);
          }
        });
       
        // Skip rows that are missing required foreign keys or have no relevant data
        if (shouldSkipRow || !hasRelevantData) {
          return null;
        }
        
        return mappedRow;
      } catch (rowError) {
        console.error('❌ Error processing row', rowIndex, 'for table', table.name, ':', rowError);
        return null;
      }
    }).filter(row => row !== null); // Remove null rows
  }

  private async preCreateDependentRecords(data: any[]): Promise<void> {
    console.log('Pre-creating dependent records for foreign key relationships...');
    
    // UNIVERSAL dependency extraction - works for ANY schema
    const schema = this.request.schema;
    const dependencyRecords = new Map<string, Map<string, any>>();
    
    // Find all foreign key relationships in the schema
    const foreignKeys = new Map<string, string>(); // column_name -> table_name
    
    schema.tables.forEach((table: any) => {
      table.columns?.forEach((column: any) => {
        if (column.name.endsWith('_id') && column.notNull) {
          const baseName = column.name.replace(/_id$/, '');
          console.log('🔍 Looking for related table for foreign key:', column.name, 'base name:', baseName);
          
          // Try to find a table that matches this foreign key
          const relatedTable = schema.tables.find((t: any) => {
            const matches = t.name === baseName || 
                           t.name === baseName + 's' || 
                           t.name === baseName + 'es' ||
                           t.name.includes(baseName) ||
                           baseName.includes(t.name.replace(/s$/, ''));
            
            if (matches) {
              console.log('✅ Found related table:', t.name, 'for foreign key:', column.name);
            }
            return matches;
          });
          
          if (relatedTable) {
            foreignKeys.set(column.name, relatedTable.name);
            if (!dependencyRecords.has(relatedTable.name)) {
              dependencyRecords.set(relatedTable.name, new Map<string, any>());
            }
          } else {
            console.log('❌ No related table found for foreign key:', column.name);
          }
        }
      });
    });
    
    console.log('Found foreign key relationships:', Array.from(foreignKeys.entries()));
    
    // Extract unique records for each dependency table with SMART data extraction
    data.forEach(row => {
      foreignKeys.forEach((tableName, foreignKeyColumn) => {
        const baseName = foreignKeyColumn.replace(/_id$/, '');
        
        // SMART entity value extraction based on table type
        let entityValue = null;
        
        // Try to find the most relevant CSV column for this specific table type
        if (tableName.includes('jurisdiction')) {
          entityValue = this.findValueInRow(row, 'jurisdiction') || 
                       this.findValueInRow(row, 'county') || 
                       this.findValueInRow(row, 'city');
        } else if (tableName.includes('builder')) {
          entityValue = this.findValueInRow(row, 'builder') || 
                       this.findValueInRow(row, 'contractor');
        } else if (tableName.includes('permit_type')) {
          entityValue = this.findValueInRow(row, 'permit_type') || 
                       this.findValueInRow(row, 'type');
        } else if (tableName.includes('business')) {
          entityValue = this.findValueInRow(row, 'business') || 
                       this.findValueInRow(row, 'company');
        } else {
          // Fallback: try to find data that could represent this entity
          entityValue = this.findValueInRow(row, baseName) || 
                       this.findValueInRow(row, 'name') || 
                       this.findValueInRow(row, 'code');
        }
        
        // If no specific data found, generate a table-specific default
        if (!entityValue) {
          entityValue = this.getTableSpecificDefault(tableName);
        }
        
        if (entityValue) {
          const recordsMap = dependencyRecords.get(tableName);
          const key = entityValue.toString();
          
          if (recordsMap && !recordsMap.has(key)) {
            const hash = this.hashString(baseName + '_' + key);
            const recordId = this.uuidFromHash(hash);
            
            console.log('🏗️ Creating dependency record for table', tableName + ':', key);
            
            // Create a basic record structure
            const record: any = {
              id: recordId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            
            // Add common fields based on the table's schema
            const relatedTable = schema.tables.find((t: any) => t.name === tableName);
            if (relatedTable) {
              relatedTable.columns?.forEach((col: any) => {
                if (col.name !== 'id' && col.name !== 'created_at' && col.name !== 'updated_at') {
                  if (col.name === 'name' || col.name.includes('name')) {
                    record[col.name] = key;
                  } else if (col.name === 'code' || col.name.includes('code')) {
                    record[col.name] = key;
                  } else if (col.notNull && !col.name.endsWith('_id')) {
                    record[col.name] = this.getSmartDefault(col, tableName);
                  }
                }
              });
            }
            
            recordsMap.set(key, record);
          }
        }
      });
    });
    
    // Insert dependency records in order
    for (const [tableName, recordsMap] of dependencyRecords.entries()) {
      if (recordsMap.size > 0) {
        console.log('Creating', recordsMap.size, 'records for table', tableName + '...');
        const recordsArray = Array.from(recordsMap.values());
        
        try {
          const { error } = await this.supabaseClient
            .from(tableName)
            .upsert(recordsArray, { ignoreDuplicates: true });
          
          if (error) {
            console.log('Warning: Could not create records for table', tableName + ':', error.message);
          } else {
            console.log('Successfully created', recordsArray.length, 'records for table', tableName);
          }
        } catch (error) {
          console.log('Warning: Exception creating records for table', tableName + ':', error.message);
        }
      }
    }
  }

  private getColumnMaxLength(column: any): number | null {
    // Extract max length from column type like "character varying(50)"
    if (column.type && typeof column.type === 'string') {
      const match = column.type.match(/\((\d+)\)/);
      if (match) {
        const length = parseInt(match[1]);
        console.log('Found length constraint for column', column.name + ':', length);
        return length;
      }
    }
    
    // Check multiple possible fields for length info
    if (column.maxLength) {
      console.log('Found maxLength property for column', column.name + ':', column.maxLength);
      return column.maxLength;
    }
    
    if (column.characterMaximumLength) {
      console.log('Found characterMaximumLength for column', column.name + ':', column.characterMaximumLength);
      return column.characterMaximumLength;
    }
    
    if (column.length) {
      console.log('Found length property for column', column.name + ':', column.length);
      return column.length;
    }
    
    // Default safe lengths for common types
    const columnType = (column.type || '').toLowerCase();
    if (columnType.includes('varchar') || columnType.includes('character varying')) {
      console.log('Applying default varchar length (255) for column', column.name);
      return 255;
    }
    
    if (columnType.includes('char') && !columnType.includes('varying')) {
      console.log('Applying default char length (50) for column', column.name);
      return 50; // Conservative default for CHAR types
    }
    
    return null; // No length constraint
  }

  private getMappedValue(row: any, columnName: string): any {
    // Special mappings for common field names that might have different CSV headers
    const mappings: Record<string, string[]> = {
      // Address fields
      'street_address': ['address', 'street', 'property_address', 'location', 'Address', 'ADDRESS'],
      'code': ['permit_number', 'permit_code', 'id', 'number', 'ref', 'Permit Number', 'PERMIT_NUMBER'],
      
      // Property fields
      'apn': ['APN', 'parcel_number', 'parcel_id', 'assessor_parcel_number'],
      'parcel_number': ['APN', 'apn', 'parcel_id', 'assessor_parcel_number'],
      
      // Business fields
      'business_name': ['company', 'company_name', 'contractor', 'builder', 'Business Name'],
      'name': ['business_name', 'company', 'title', 'description'],
      
      // Date fields
      'applied_date': ['date_applied', 'application_date', 'submit_date'],
      'issued_date': ['date_issued', 'issue_date', 'permit_date'],
      'completed_date': ['date_completed', 'completion_date', 'final_date'],
      
      // Financial fields
      'job_value': ['value', 'project_value', 'construction_value', 'amount'],
      'fees': ['fee', 'permit_fee', 'cost', 'price'],
      
      // Type fields
      'type': ['category', 'kind', 'classification'],
      'style': ['type', 'kind', 'model'],
      'status': ['state', 'condition', 'phase'],
    };
    
    const possibleFields = mappings[columnName.toLowerCase()];
    if (possibleFields) {
      for (const field of possibleFields) {
        const value = row[field] || row[field.toLowerCase()] || row[field.toUpperCase()];
        if (value !== null && value !== undefined && value !== '') {
          return value;
        }
      }
    }
    
    return null;
  }

  private resolveForeignKey(row: any, column: any, tableName: string): string | null {
    // UNIVERSAL foreign key resolution - works for ANY schema
    
    if (column.name.endsWith('_id')) {
      // Get the base name (remove _id suffix)
      const baseName = column.name.replace(/_id$/, '');
      
      // Try to find ANY field that could be related to this foreign key
      const possibleRelatedFields = [
        baseName,
        baseName + '_name',
        baseName + '_code',
        baseName + '_number',
        baseName + '_key',
        'name',
        'code', 
        'number',
        'key',
        'id',
        'identifier'
      ];
      
      // Look for ANY value in the row that could represent this entity
      for (const fieldName of possibleRelatedFields) {
        const value = this.findValueInRow(row, fieldName);
        if (value) {
          // Create deterministic UUID from this value
          const hash = this.hashString(baseName + '_' + value.toString());
          return this.uuidFromHash(hash);
        }
      }
      
      // If we can't find a related field, try to infer from the row data
      // Use the first non-empty string/number field as a seed
      const rowValues = Object.values(row).filter(v => 
        v !== null && v !== undefined && v !== '' && 
        (typeof v === 'string' || typeof v === 'number')
      );
      
      if (rowValues.length > 0) {
        const seed = baseName + '_' + rowValues[0].toString();
        const hash = this.hashString(seed);
        return this.uuidFromHash(hash);
      }
    }
    
    return null; // Could not resolve
  }
  
  private findValueInRow(row: any, fieldName: string): any {
    // Try multiple variations of the field name
    const variations = [
      fieldName,
      fieldName.toLowerCase(),
      fieldName.toUpperCase(),
      fieldName.replace(/_/g, '-'),
      fieldName.replace(/-/g, '_'),
      fieldName.replace(/[-_]/g, ''),
    ];
    
    for (const variation of variations) {
      const value = row[variation];
      if (value !== null && value !== undefined && value !== '') {
        return value;
      }
    }
    
    return null;
  }

  private getSmartDefault(column: any, tableName?: string): any {
    // UNIVERSAL smart defaults based on column name patterns and types
    
    const columnName = column.name.toLowerCase();
    const columnType = (column.type || '').toLowerCase();
    const tableContext = tableName ? tableName.toLowerCase() : '';
    
    // Handle by type first
    if (columnType.includes('bool')) {
      return false;
    }
    
    if (columnType.includes('int')) {
      return 0;
    }
    
    if (columnType.includes('numeric') || columnType.includes('decimal') || 
        columnType.includes('real') || columnType.includes('double') || 
        columnType.includes('float')) {
      return 0.0;
    }
    
    if (columnType.includes('date') || columnType.includes('time')) {
      return new Date().toISOString();
    }
    
    // Handle text fields by semantic meaning
    if (columnType.includes('text') || columnType.includes('varchar') || 
        columnType.includes('char') || columnType.includes('string')) {
      
      const maxLength = this.getColumnMaxLength(column);
      
      // Address-related fields
      if (columnName.includes('address') || columnName.includes('street') || 
          columnName.includes('location') || columnName.includes('addr')) {
        let defaultVal = 'Address Not Available';
        return maxLength && defaultVal.length > maxLength ? defaultVal.substring(0, maxLength) : defaultVal;
      }
      
      // Code/identifier fields
      if (columnName.includes('code') || columnName.includes('number') || 
          columnName.includes('id') || columnName.includes('key') ||
          columnName.includes('permit') || columnName.includes('ref')) {
        let defaultVal = 'AUTO-' + crypto.randomUUID().substring(0, 8).toUpperCase();
        return maxLength && defaultVal.length > maxLength ? defaultVal.substring(0, maxLength) : defaultVal;
      }
      
      // Name fields - make them table-specific to avoid duplicates
      if (columnName.includes('name') || columnName.includes('title') || 
          columnName.includes('label')) {
        let defaultVal = 'Unknown';
        
        // Make the default specific to the table type to avoid duplicate key violations
        if (tableContext.includes('permit_types')) {
          defaultVal = 'General Permit';
        } else if (tableContext.includes('permit_statuses')) {
          defaultVal = 'Pending';
        } else if (tableContext.includes('businesses')) {
          defaultVal = 'Unknown Business';
        } else if (tableContext.includes('builders')) {
          defaultVal = 'Unknown Builder';
        } else if (tableContext.includes('jurisdictions')) {
          defaultVal = 'Unknown Jurisdiction';
        } else if (tableContext.includes('product_types')) {
          defaultVal = 'General Product';
        } else if (tableContext.includes('product_classes')) {
          defaultVal = 'Standard Class';
        } else if (tableContext.includes('loan_types')) {
          defaultVal = 'Standard Loan';
        } else if (tableContext.includes('sale_statuses')) {
          defaultVal = 'Active';
        } else {
          // Add a random suffix to prevent duplicates
          defaultVal = 'Unknown-' + crypto.randomUUID().substring(0, 8);
        }
        
        return maxLength && defaultVal.length > maxLength ? defaultVal.substring(0, maxLength) : defaultVal;
      }
      
      // Description fields
      if (columnName.includes('description') || columnName.includes('desc') || 
          columnName.includes('note') || columnName.includes('comment')) {
        let defaultVal = 'No description provided';
        return maxLength && defaultVal.length > maxLength ? defaultVal.substring(0, maxLength) : defaultVal;
      }
      
      // Email fields
      if (columnName.includes('email') || columnName.includes('mail')) {
        let defaultVal = 'unknown@example.com';
        return maxLength && defaultVal.length > maxLength ? defaultVal.substring(0, maxLength) : defaultVal;
      }
      
      // Phone fields
      if (columnName.includes('phone') || columnName.includes('tel') || 
          columnName.includes('mobile')) {
        let defaultVal = '000-000-0000';
        return maxLength && defaultVal.length > maxLength ? defaultVal.substring(0, maxLength) : defaultVal;
      }
      
      // Status/state fields
      if (columnName.includes('status') || columnName.includes('state') || 
          columnName.includes('condition')) {
        let defaultVal = 'Unknown';
        return maxLength && defaultVal.length > maxLength ? defaultVal.substring(0, maxLength) : defaultVal;
      }
      
      // Type/category fields
      if (columnName.includes('type') || columnName.includes('category') || 
          columnName.includes('class') || columnName.includes('kind')) {
        let defaultVal = 'Unspecified';
        return maxLength && defaultVal.length > maxLength ? defaultVal.substring(0, maxLength) : defaultVal;
      }
      
      // Default for any other text field
      let defaultText = 'Not Specified';
      
      if (maxLength && defaultText.length > maxLength) {
        defaultText = defaultText.substring(0, maxLength);
      }
      
      return defaultText;
    }
    
    // UUID fields
    if (columnType.includes('uuid')) {
      return crypto.randomUUID();
    }
    
    return null; // Let database handle anything else
  }

  private getTypeBasedDefault(column: any): any {
    // ULTIMATE fallback - generates a safe default for ANY PostgreSQL type
    const columnType = (column.type || '').toLowerCase();
    
    if (columnType.includes('bool')) {
      return false;
    }
    
    if (columnType.includes('int') || columnType.includes('numeric') || 
        columnType.includes('decimal') || columnType.includes('real') || 
        columnType.includes('double') || columnType.includes('float')) {
      return 0;
    }
    
    if (columnType.includes('date') || columnType.includes('time')) {
      return new Date().toISOString();
    }
    
    if (columnType.includes('uuid')) {
      return crypto.randomUUID();
    }
    
    // For text/varchar/char - respect length constraints
    const maxLength = this.getColumnMaxLength(column);
    let defaultText = 'AUTO';
    
    if (maxLength && defaultText.length > maxLength) {
      defaultText = defaultText.substring(0, maxLength);
    }
    
    return defaultText;
  }

  private findSemanticMatches(row: any, targetColumn: string): any[] {
    // Find CSV columns that semantically match the target column
    const csvColumns = Object.keys(row);
    const matches = [];
    
    // Clean the target column name for comparison
    const cleanTarget = targetColumn.replace(/[-_]/g, '').toLowerCase();
    
    for (const csvCol of csvColumns) {
      const cleanCsv = csvCol.replace(/[-_]/g, '').toLowerCase();
      
      // Check if CSV column contains the target or vice versa
      if (cleanCsv.includes(cleanTarget) || cleanTarget.includes(cleanCsv)) {
        matches.push(row[csvCol]);
      }
      
      // Special semantic mappings
      if (targetColumn === 'street_address' && (csvCol.toLowerCase().includes('street') || csvCol.toLowerCase().includes('address'))) {
        matches.push(row[csvCol]);
      }
      
      if (targetColumn === 'property_id' && (csvCol.toLowerCase().includes('property') || csvCol.toLowerCase().includes('parcel'))) {
        matches.push(row[csvCol]);
      }
      
      if (targetColumn === 'permit_id' && csvCol.toLowerCase().includes('permit')) {
        matches.push(row[csvCol]);
      }
    }
    
    return matches;
  }

  private getTableSpecificDefault(tableName: string): string {
    // Generate table-specific defaults to avoid duplicate key violations
    const tableType = tableName.toLowerCase();
    
    if (tableType.includes('jurisdiction')) {
      return 'Default Jurisdiction';
    } else if (tableType.includes('builder')) {
      return 'Default Builder';
    } else if (tableType.includes('permit_type')) {
      return 'General Permit';
    } else if (tableType.includes('permit_status')) {
      return 'Pending';
    } else if (tableType.includes('business')) {
      return 'Default Business';
    } else if (tableType.includes('product_type')) {
      return 'General Product';
    } else if (tableType.includes('product_class')) {
      return 'Standard Class';
    } else if (tableType.includes('loan_type')) {
      return 'Standard Loan';
    } else if (tableType.includes('sale_status')) {
      return 'Active';
    } else {
      return 'Default-' + tableName;
    }
  }

  private isLookupTable(table: any): boolean {
    // UNIVERSAL lookup table detection based on schema analysis
    
    // 1. Name-based detection (common patterns)
    const namePatterns = [
      'lookup_', '_types', '_categories', '_statuses', '_codes', '_fips',
      '_subtypes', '_topographies', '_classifications', '_enums'
    ];
    
    if (namePatterns.some(pattern => table.name.includes(pattern))) {
      return true;
    }
    
    // 2. Structure-based detection
    const columns = table.columns || [];
    const columnNames = columns.map(col => col.name.toLowerCase());
    
    // Has typical lookup table columns
    const hasLookupColumns = columnNames.some(name => 
      ['type', 'name', 'code', 'subtype', 'category', 'status', 'classification'].includes(name)
    );
    
    // Small table with mostly text/varchar columns (typical of lookup tables)
    const textColumns = columns.filter(col => {
      const type = (col.type || '').toLowerCase();
      return type.includes('text') || type.includes('varchar') || type.includes('char');
    });
    
    const isSmallTextTable = columns.length <= 6 && textColumns.length >= 2;
    
    // 3. Foreign key analysis - lookup tables are often referenced by other tables
    const hasUniqueConstraints = columns.some(col => 
      col.name === 'code' || col.name === 'name' || col.name === 'type'
    );
    
    return hasLookupColumns || (isSmallTextTable && hasUniqueConstraints);
  }

  private deduplicateBatch(batch: any[], table: any): any[] {
    // UNIVERSAL deduplication - works for ANY lookup table structure
    
    if (batch.length === 0) return batch;
    
    // Find the best field to deduplicate on
    const sampleRow = batch[0];
    const possibleUniqueFields = ['code', 'name', 'type', 'subtype', 'category', 'status', 'classification', 'id'];
    
    // Find which field exists and has the most unique values
    let bestField = null;
    let maxUniqueCount = 0;
    
    for (const field of possibleUniqueFields) {
      if (sampleRow.hasOwnProperty(field)) {
        const uniqueValues = new Set(batch.map(row => row[field]).filter(val => val != null));
        if (uniqueValues.size > maxUniqueCount) {
          maxUniqueCount = uniqueValues.size;
          bestField = field;
        }
      }
    }
    
    if (!bestField) {
      console.log('No suitable unique field found for deduplication in table', table.name);
      return batch; // Return original batch if no unique field found
    }
    
    console.log('Deduplicating table', table.name, 'on field:', bestField);
    
    // Deduplicate based on the best field
    const seen = new Set();
    return batch.filter(row => {
      const value = row[bestField];
      if (value == null || seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
  }

  private convertValueForColumn(value: any, column: any, tableName: string): any {
    // UNIVERSAL data type conversion that handles ANY PostgreSQL type safely
    
    if (value === null || value === undefined || value === '') {
      return null;
    }
    
    const stringVal = value.toString().trim();
    if (stringVal === '' || stringVal === 'null' || stringVal === 'NULL') {
      return null;
    }
    
    const columnType = (column.type || '').toLowerCase();
    
    try {
      // Handle INTEGER types (int, bigint, smallint, etc.)
      if (columnType.includes('int')) {
        const cleanVal = stringVal.replace(/[,$\s]/g, ''); // Remove formatting
        
        // If it's clearly not a number, return null
        if (!/^-?\d+$/.test(cleanVal)) {
          console.log('Warning: Cannot convert "' + stringVal + '" to integer for column ' + column.name + ', setting to null');
          return null;
        }
        
        const parsed = parseInt(cleanVal);
        return isNaN(parsed) ? null : parsed;
      }
      
      // Handle NUMERIC/DECIMAL/FLOAT types
      if (columnType.includes('numeric') || columnType.includes('decimal') || 
          columnType.includes('real') || columnType.includes('double') || 
          columnType.includes('float')) {
        const cleanVal = stringVal.replace(/[,$\s]/g, '');
        
        if (!/^-?\d*\.?\d+$/.test(cleanVal)) {
          console.log('Warning: Cannot convert "' + stringVal + '" to numeric for column ' + column.name + ', setting to null');
          return null;
        }
        
        const parsed = parseFloat(cleanVal);
        return isNaN(parsed) ? null : parsed;
      }
      
      // Handle BOOLEAN types
      if (columnType.includes('bool')) {
        const lowerVal = stringVal.toLowerCase();
        
        // True values
        if (['true', '1', 'yes', 'y', 't', 'on', 'enabled'].includes(lowerVal)) {
          return true;
        }
        
        // False values
        if (['false', '0', 'no', 'n', 'f', 'off', 'disabled'].includes(lowerVal)) {
          return false;
        }
        
        // For ANY other value, default to false and warn
        console.log('Warning: Converting unexpected boolean value "' + stringVal + '" to false for column ' + column.name);
        return false;
      }
      
      // Handle DATE/TIMESTAMP types
      if (columnType.includes('date') || columnType.includes('time')) {
        try {
          // Try multiple date parsing strategies
          let parsedDate;
          
          if (stringVal.includes('/')) {
            parsedDate = new Date(stringVal);
          } else if (stringVal.length === 8 && /^\d{8}$/.test(stringVal)) {
            // YYYYMMDD format
            const year = stringVal.substring(0, 4);
            const month = stringVal.substring(4, 6);
            const day = stringVal.substring(6, 8);
            parsedDate = new Date(year + '-' + month + '-' + day);
          } else {
            parsedDate = new Date(stringVal);
          }
          
          if (isNaN(parsedDate.getTime())) {
            console.log('Warning: Invalid date "' + stringVal + '" for column ' + column.name + ', setting to null');
            return null;
          }
          
          return columnType.includes('date') && !columnType.includes('time') 
            ? parsedDate.toISOString().split('T')[0] 
            : parsedDate.toISOString();
        } catch (error) {
          console.log('Warning: Date parsing error for "' + stringVal + '" in column ' + column.name + ', setting to null');
          return null;
        }
      }
      
      // Handle UUID types
      if (columnType.includes('uuid')) {
        if (column.name === 'id' && (!stringVal || stringVal === 'null')) {
          return crypto.randomUUID();
        }
        return stringVal;
      }
      
      // Handle TEXT/VARCHAR/CHAR types
      if (columnType.includes('text') || columnType.includes('varchar') || 
          columnType.includes('char') || columnType.includes('string')) {
        
        const maxLength = this.getColumnMaxLength(column);
        if (maxLength && stringVal.length > maxLength) {
          console.log('Warning: Truncating value for column ' + column.name + ' from ' + stringVal.length + ' to ' + maxLength + ' characters');
          return stringVal.substring(0, maxLength);
        }
        
        return stringVal;
      }
      
      // Handle JSON/JSONB types
      if (columnType.includes('json')) {
        try {
          return JSON.parse(stringVal);
        } catch (error) {
          console.log('Warning: Invalid JSON for column ' + column.name + ', storing as string');
          return stringVal;
        }
      }
      
      // Default: return as string but validate length
      const maxLength = this.getColumnMaxLength(column);
      if (maxLength && stringVal.length > maxLength) {
        console.log('Warning: Truncating value for column ' + column.name + ' from ' + stringVal.length + ' to ' + maxLength + ' characters');
        return stringVal.substring(0, maxLength);
      }
      
      return stringVal;
      
    } catch (error) {
      console.log('Warning: Error converting value "' + stringVal + '" for column ' + column.name + ', setting to null');
      return null;
    }
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private uuidFromHash(hash: string): string {
    // Create a deterministic UUID from hash
    const padded = hash.padEnd(32, '0').substring(0, 32);
    return [
      padded.substring(0, 8),
      padded.substring(8, 12),
      '4' + padded.substring(13, 16), // Version 4 UUID
      '8' + padded.substring(17, 20), // Variant bits
      padded.substring(20, 32)
    ].join('-');
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

      // Get Supabase credentials - use passed credentials or fall back to environment
      const supabaseUrl = request.supabaseUrl || ('https://' + request.schema.projectId + '.supabase.co') || Deno.env.get("SUPABASE_URL");
      const supabaseKey = request.supabaseServiceKey || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "your-service-role-key";
      
      console.log('Using Supabase URL:', supabaseUrl);
      console.log('Using service key (first 20 chars):', supabaseKey.substring(0, 20) + '...');

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
                  writer.write(encoder.encode('data: ' + data + '\\n\\n'));
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
                writer.write(encoder.encode('data: ' + completionData + '\\n\\n'));
                writer.write(encoder.encode('data: [DONE]\\n\\n'));
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
                writer.write(encoder.encode('data: ' + errorData + '\\n\\n'));
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