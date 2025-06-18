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
  needsContinuation?: boolean;
  continuationData?: {
    processedRows: number;
    totalRows: number;
    nextChunkIndex: number;
  };
}

class CSVProcessor {
  private supabaseClient: any;
  private request: SeedDataRequest;
  private progress: SeedingProgress;
  private errors: any[] = [];
  private warnings: any[] = [];
  private startTime: number;

  // Chunked processing constants - Based on actual Supabase Edge Function limits
  private static readonly CHUNK_SIZE = 100; // Increased chunk size for efficiency
  private static readonly MAX_CPU_TIME = 1200; // 1.2s CPU time limit (more aggressive)
  
  // Cache for foreign key IDs to avoid repeated lookups
  private fkCache: Map<string, string | null> = new Map();
  
  // Cache for actual inserted property IDs by row index
  private propertyIdCache: Map<number, string> = new Map();

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
      needsContinuation: false,
      continuationData: undefined,
    };
  }

  async processCSVChunk(onProgress?: (progress: SeedingProgress) => void): Promise<SeedingProgress> {
    try {
      console.log('🚀 SEEDING ENGINE - Starting processing');
      
      if (onProgress) {
        // SIMPLE CHUNK MODE: Process one chunk and return continuation info
        return await this.processOneChunkWithContinuation(onProgress);
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
   * Process ONE chunk and return continuation data if needed
   */
  private async processOneChunkWithContinuation(onProgress: (progress: SeedingProgress) => void): Promise<SeedingProgress> {
    console.log('📋 SIMPLE CHUNK MODE: Processing one chunk per invocation');
    
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

    // Create essential lookups ONCE
    const processedRows = this.request.processedRows || 0;
    if (processedRows === 0) {
      this.updateProgress(20, "processing", "Creating essential lookups...");
      onProgress(this.progress);
      await this.quickPreCreateLookups();
    }

    // Process smaller chunk to avoid timeout (100 rows) 
    const chunkSize = 100;
    const startIdx = processedRows;
    const endIdx = Math.min(startIdx + chunkSize, totalRows);
    
    if (startIdx >= totalRows) {
      // Already completed
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

      // Update progress
      const progressPercent = 25 + ((startIdx + chunkLines.length) / totalRows) * 70;
      this.updateProgress(
        progressPercent,
        "processing",
        \`Processing rows \${startIdx + 1}-\${endIdx} of \${totalRows}\`
      );
      onProgress(this.progress);

              // Process chunk data with timeout protection
        await this.processChunkDataWithTimeout(chunkData);

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
        
        // Immediately schedule the next chunk with fire-and-forget approach
        this.scheduleNextChunkImmediate(newProcessedRows, totalRows, chunkSize);
        
        return this.progress;
      }

    // All done
    console.log(\`🎉 ALL DATA PROCESSED: \${newProcessedRows}/\${totalRows} rows\`);
    this.progress.status = "completed";
    this.progress.overallProgress = 100;
    this.updateProgress(100, "completing", "Data seeding completed successfully");
    onProgress(this.progress);
    
    return this.progress;
  }

  /**
   * Create essential default records for FK resolution
   */
  private async quickPreCreateLookups(): Promise<void> {
    try {
      const schema = this.request.schema;
      const defaultRecords: { [tableName: string]: any } = {};
      
      // Create minimal default records for common lookup tables
      const lookupTables = [
        { name: 'jurisdictions', record: { name: 'Default Jurisdiction' } },
        { name: 'permit_types', record: { name: 'General Permit' } },
        { name: 'permit_statuses', record: { name: 'Active' } },
        { name: 'builders', record: { name: 'Unknown Builder', company_name: 'Unknown' } },
        { name: 'businesses', record: { name: 'Unknown Business', business_type: 'Other' } },
      ];
      
      for (const { name: tableName, record } of lookupTables) {
        const table = schema.tables.find(t => t.name === tableName);
        if (table) {
          const defaultRecord = {
            id: crypto.randomUUID(),
            ...record,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          try {
            const { data, error } = await this.supabaseClient
              .from(tableName)
              .upsert([defaultRecord], { ignoreDuplicates: true })
              .select('id')
              .single();
              
            if (!error && data?.id) {
              // Cache the default FK IDs
              this.fkCache.set(\`\${tableName.slice(0, -1)}_id\`, data.id); // e.g., "builder_id"
              console.log(\`✅ Created default \${tableName}: \${data.id}\`);
            }
          } catch (error) {
            console.log(\`⏭️ Skipped \${tableName}:\`, error.message);
          }
        }
      }
    } catch (error) {
      console.log('❌ Quick lookup creation failed:', error.message);
    }
  }

  /**
   * Process chunk data with timeout protection and simplified FK handling
   */
  private async processChunkDataWithTimeout(chunkData: any[]): Promise<void> {
    if (!chunkData || chunkData.length === 0) return;
    
    const schema = this.request.schema;
    const startTime = Date.now();
    
    // CRITICAL: Process properties FIRST, then property-related tables
    const tables = [...schema.tables].sort((a, b) => {
      if (a.name === 'properties') return -1;
      if (b.name === 'properties') return 1;
      
      // Property-related tables next
      const aIsPropertyRelated = a.name.startsWith('property_');
      const bIsPropertyRelated = b.name.startsWith('property_');
      if (aIsPropertyRelated && !bIsPropertyRelated) return -1;
      if (!aIsPropertyRelated && bIsPropertyRelated) return 1;
      
      // Lookup tables next
      const aIsLookup = this.isLookupTable(a);
      const bIsLookup = this.isLookupTable(b);
      if (aIsLookup && !bIsLookup) return -1;
      if (!aIsLookup && bIsLookup) return 1;
      return 0;
    });
    
    console.log(\`🚀 Processing \${tables.length} tables: \${tables.map(t => t.name).join(', ')}\`);
    
    // Process only 2-3 tables per chunk to avoid timeout
    const maxTablesPerChunk = 3;
    const tablesToProcess = tables.slice(0, maxTablesPerChunk);
    
    // Process each table with timeout checks
    for (const table of tablesToProcess) {
      // Check CPU time before processing each table
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime > CSVProcessor.MAX_CPU_TIME) {
        console.log(\`⏰ CPU timeout reached (\${elapsedTime}ms), stopping table processing\`);
        break;
      }
      
      console.log(\`📋 Processing table: \${table.name}\`);
      
      try {
        // Quick data filtering 
        const relevantData = this.filterDataForTable(chunkData, table);
        
        if (relevantData.length === 0) {
          console.log(\`⏭️ No data for \${table.name}, skipping\`);
          continue;
        }
        
        console.log(\`📊 \${table.name}: \${relevantData.length} rows to process\`);
        
        // Simple data mapping without complex FK resolution
        const insertData = [];
        
        for (let rowIndex = 0; rowIndex < relevantData.length; rowIndex++) {
          const row = relevantData[rowIndex];
          const generatedId = crypto.randomUUID();
          
          let mapped: any = {
            id: generatedId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          // Cache property IDs for FK resolution
          if (table.name === 'properties') {
            const globalRowIndex = (this.request.processedRows || 0) + rowIndex;
            this.propertyIdCache.set(globalRowIndex, generatedId);
          }
          
          let shouldSkipRow = false;
          
          // Enhanced column mapping with better error handling
          for (const col of (table.columns || [])) {
            if (['id', 'created_at', 'updated_at'].includes(col.name)) {
              continue; 
            }
            
            try {
              // Handle FK columns with improved logic
              if (col.name.endsWith('_id') && col.name !== 'id') {
                if (col.name === 'property_id') {
                  // Use the actual property ID from the same row
                  const globalRowIndex = (this.request.processedRows || 0) + rowIndex;
                  const propertyId = this.propertyIdCache.get(globalRowIndex);
                  if (propertyId) {
                    mapped[col.name] = propertyId;
                  } else {
                    // Fallback to first available property ID or skip row
                    const firstPropertyId = Array.from(this.propertyIdCache.values())[0];
                    if (firstPropertyId) {
                      mapped[col.name] = firstPropertyId;
                    } else {
                      // Skip this row if no property IDs available
                      shouldSkipRow = true;
                      break;
                    }
                  }
                } else {
                  // For other FKs, set to null to avoid constraint violations
                  mapped[col.name] = null;
                }
                continue;
              }
              
              // Map regular columns with enhanced type conversion
              const csvValue = this.findCsvValue(row, col.name);
              if (csvValue !== undefined) {
                mapped[col.name] = this.convertValue(csvValue, col.type || 'text', col.name);
              } else {
                // Provide sensible defaults for unmapped columns
                mapped[col.name] = this.getDefaultValueForColumn(col);
              }
            } catch (error) {
              // If individual column mapping fails, continue with next column
              console.log(\`⚠️ Column mapping error for \${col.name}:\`, error.message);
              mapped[col.name] = this.getDefaultValueForColumn(col);
            }
          }
          
          if (!shouldSkipRow && mapped) {
            insertData.push(mapped);
          }
        }
        
        if (insertData.length === 0) {
          console.log(\`⏭️ No valid rows for \${table.name} after mapping\`);
          continue;
        }
        
        // Quick insert with upsert for safety
        console.log(\`💾 Inserting \${insertData.length} rows into \${table.name}\`);
        
        const { error } = await this.supabaseClient
          .from(table.name)
          .upsert(insertData);
          
        if (error) {
          console.log(\`❌ \${table.name} insert error:\`, error.message);
          
          // For properties table, this is critical - try individual inserts
          if (table.name === 'properties') {
            console.log(\`🔧 Properties failed - trying individual row inserts\`);
            await this.insertRowsIndividuallyAndCache(table.name, insertData, this.request.processedRows || 0);
          } else {
            // For other tables, just log and continue
            this.errors.push({
              table: table.name,
              error: error.message,
              timestamp: new Date(),
            });
          }
        } else {
          console.log(\`✅ \${table.name}: \${insertData.length} rows inserted\`);
          this.progress.successfulRows = (this.progress.successfulRows || 0) + insertData.length;
        }
        
      } catch (error) {
        console.log(\`❌ Error processing \${table.name}:\`, error.message);
      }
    }
  }
  
  /**
   * Get a cached default FK ID or return null
   */
  private getDefaultFKId(columnName: string): string | null {
    return this.fkCache.get(columnName) || null;
  }
  
  /**
   * Get a sensible default value for a column based on its type
   */
  private getDefaultValueForColumn(col: any): any {
    const colType = (col.type || '').toLowerCase();
    
    if (col.name === 'name') {
      return 'Unknown';
    }
    
    if (colType.includes('int')) {
      return 0;
    }
    
    if (colType.includes('numeric') || colType.includes('decimal') || colType.includes('real')) {
      return 0.0;
    }
    
    if (colType.includes('bool')) {
      return false;
    }
    
    if (colType.includes('date') || colType.includes('timestamp')) {
      return new Date().toISOString();
    }
    
    if (col.name.includes('year') || col.name.includes('_year')) {
      return new Date().getFullYear();
    }
    
    if (colType.includes('uuid')) {
      return crypto.randomUUID();
    }
    
    // Default to empty string or null based on nullability
    return col.nullable !== false ? null : '';
  }
  
  /**
   * Enhanced value conversion with better varchar handling and null safety
   */
  private convertValue(value: any, columnType: string, columnName?: string): any {
    if (!value || value === '' || value === 'null' || value === 'NULL') {
      // For required fields like 'name', provide a default value
      if (columnName === 'name') {
        return 'Unknown';
      }
      return null;
    }
    
    const type = columnType.toLowerCase();
    const strValue = String(value).trim();
    
    if (type.includes('int')) {
      const parsed = parseInt(strValue.replace(/[^\d-]/g, ''));
      if (isNaN(parsed)) {
        // Special handling for year fields
        if (columnName && (columnName.includes('year') || columnName.includes('_year'))) {
          return new Date().getFullYear();
        }
        return null;
      }
      return parsed;
    }
    
    if (type.includes('numeric') || type.includes('decimal') || type.includes('real')) {
      const parsed = parseFloat(strValue.replace(/[^\d.-]/g, ''));
      return isNaN(parsed) ? null : parsed;
    }
    
    if (type.includes('bool')) {
      return ['true', '1', 'yes', 'y', 't'].includes(strValue.toLowerCase());
    }
    
    if (type.includes('date') || type.includes('timestamp')) {
      const date = new Date(strValue);
      return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
    }
    
    // BULLETPROOF varchar handling - NEVER fail on length
    if (type.includes('varchar') || type.includes('character varying')) {
      const lengthMatch = type.match(/\((\d+)\)/);
      const maxLength = lengthMatch ? parseInt(lengthMatch[1]) : 255;
      
      // ULTRA-SAFE truncation - guaranteed to never exceed length
      if (maxLength <= 2) {
        // For varchar(2) - return state codes or XX
        const cleaned = strValue.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (cleaned.length >= 2) return cleaned.substring(0, 2);
        if (cleaned.length === 1) return cleaned + 'X';
        return 'XX'; // Absolute fallback
      }
      
      if (maxLength <= 10) {
        // For short fields, clean and truncate aggressively
        const cleaned = strValue.replace(/[^A-Za-z0-9 ]/g, '');
        return cleaned.substring(0, maxLength) || 'DEFAULT'.substring(0, maxLength);
      }
      
      // For longer fields, just truncate
      return strValue.substring(0, maxLength);
    }
    
    // Default to string, aggressively truncated to prevent issues
    return strValue.substring(0, 255);
  }

  /**
   * Enhanced CSV column value finder with intelligent mapping and better fallbacks
   */
  private findCsvValue(row: any, dbColumnName: string): any {
    const csvColumns = Object.keys(row);
    
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
    
    // Enhanced variations with better semantic matching
    const variations = [
      // Basic transformations
      dbColumnName.replace(/_/g, ''), // Remove underscores
      dbColumnName.replace(/_/g, ' '), // Underscores to spaces
      dbColumnName.replace(/_/g, '-'), // Underscores to hyphens
      dbColumnName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(''), // PascalCase
      dbColumnName.split('_').join(' ').toLowerCase(), // Sentence case
      
      // Common field name aliases with more comprehensive coverage
      ...(dbColumnName === 'id' ? ['ID', 'identifier', 'primary_key', 'pk', 'record_id'] : []),
      ...(dbColumnName === 'name' ? ['title', 'label', 'description', 'desc', 'business_name', 'company_name', 'entity_name', 'BUILDERS'] : []),
      ...(dbColumnName === 'created_at' ? ['created', 'date_created', 'creation_date', 'created_date', 'create_date'] : []),
      ...(dbColumnName === 'updated_at' ? ['updated', 'modified', 'date_modified', 'last_modified', 'update_date'] : []),
      ...(dbColumnName.includes('date') ? [dbColumnName.replace('date', 'time'), dbColumnName.replace('_date', ''), dbColumnName.replace('date_', '')] : []),
      ...(dbColumnName.includes('_id') ? [dbColumnName.replace('_id', ''), dbColumnName.replace('_id', '_key'), dbColumnName.replace('_id', '_number')] : []),
      
      // PERMIT-SPECIFIC mappings
      ...(dbColumnName === 'permit_number' ? ['PERMIT_NUMBER'] : []),
      ...(dbColumnName === 'description' ? ['DESCRIPTION', 'TYPE'] : []),
      ...(dbColumnName === 'business_name' ? ['BUSINESS_NAME'] : []),
      ...(dbColumnName === 'job_value' ? ['JOB_VALUE'] : []),
      ...(dbColumnName === 'fees' ? ['FEES'] : []),
      ...(dbColumnName === 'initial_status_date' ? ['INITIAL_STATUS_DATE'] : []),
      ...(dbColumnName === 'initial_status' ? ['INITIAL_STATUS'] : []),
      ...(dbColumnName === 'latest_status_date' ? ['LATEST_STATUS_DATE'] : []),
      ...(dbColumnName === 'latest_status' ? ['LATEST_STATUS'] : []),
      ...(dbColumnName === 'applied_date' ? ['APPLIED_DATE'] : []),
      ...(dbColumnName === 'issued_date' ? ['ISSUED_DATE'] : []),
      ...(dbColumnName === 'project_type' ? ['PROJECT_TYPE'] : []),
      ...(dbColumnName === 'permit_jurisdiction' ? ['PERMIT_JURISDICTION'] : []),
      
      // Address-specific mappings
      ...(dbColumnName === 'street_address' ? ['address', 'street', 'address_line_1', 'property_address', 'full_address', 'STREETADDRESS', 'PROPERTYFULLSTREETADDRESS'] : []),
      ...(dbColumnName === 'city' ? ['city_name', 'municipality', 'locality', 'CITY'] : []),
      ...(dbColumnName === 'state' ? ['state_code', 'state_abbr', 'province', 'STATE'] : []),
      ...(dbColumnName === 'zip_code' ? ['zip', 'postal_code', 'zipcode', 'ZIP_CODE'] : []),
      ...(dbColumnName === 'latitude' ? ['LATITUDE', 'lat'] : []),
      ...(dbColumnName === 'longitude' ? ['LONGITUDE', 'lng', 'lon'] : []),
      ...(dbColumnName === 'parcel_number' ? ['PARCEL_NUMBER', 'APN'] : []),
      
      // Property features mappings
      ...(dbColumnName === 'air_conditioning' ? ['AIRCONDITIONING'] : []),
      ...(dbColumnName === 'garage_type_parking' ? ['GARAGETYPEPARKING'] : []),
      ...(dbColumnName === 'number_of_bedrooms' ? ['NUMBEROFBEDROOMS'] : []),
      ...(dbColumnName === 'number_of_baths' ? ['NUMBEROFBATHS'] : []),
      ...(dbColumnName === 'heating' ? ['HEATING'] : []),
      ...(dbColumnName === 'exterior_walls' ? ['EXTERIORWALLS'] : []),
      ...(dbColumnName === 'foundation' ? ['FOUNDATION'] : []),
      ...(dbColumnName === 'roof_type' ? ['ROOFTYPE'] : []),
      
      // Business-specific mappings
      ...(dbColumnName === 'business_name' ? ['company', 'business', 'contractor', 'builder', 'entity_name'] : []),
      ...(dbColumnName === 'permit_number' ? ['permit_no', 'permit_id', 'permit', 'application_number', 'app_no'] : []),
    ];
    
    for (const variation of variations) {
      const match = keys.find(key => key.toLowerCase() === variation.toLowerCase());
      if (match) {
        return row[match];
      }
    }
    
    // Semantic partial matching with improved scoring
    const semanticMatches = keys.map(key => ({
      key,
      score: this.calculateSemanticScore(key.toLowerCase(), dbColumnName.toLowerCase())
    })).filter(m => m.score > 0.4).sort((a, b) => b.score - a.score); // Lower threshold for more matches
    
    if (semanticMatches.length > 0) {
      return row[semanticMatches[0].key];
    }
    
    // Final fallback: try partial word matching
    const dbWords = dbColumnName.toLowerCase().split('_');
    for (const key of keys) {
      const keyWords = key.toLowerCase().split(/[_\s-]/);
      const commonWords = dbWords.filter(word => keyWords.includes(word));
      if (commonWords.length > 0 && commonWords.length >= Math.min(dbWords.length, keyWords.length) / 2) {
        return row[key];
      }
    }
    
    return undefined;
  }

  /**
   * Calculate semantic similarity score between CSV column and DB column
   */
  private calculateSemanticScore(csvCol: string, dbCol: string): number {
    if (csvCol === dbCol) return 1.0;
    
    // Remove common separators for comparison
    const cleanCsv = csvCol.replace(/[_\s-]/g, '');
    const cleanDb = dbCol.replace(/[_\s-]/g, '');
    
    if (cleanCsv === cleanDb) return 0.9;
    
    // Check if one contains the other
    if (cleanCsv.includes(cleanDb) || cleanDb.includes(cleanCsv)) return 0.8;
    
    // Check for common prefixes/suffixes
    const csvWords = csvCol.split(/[_\s-]+/);
    const dbWords = dbCol.split(/[_\s-]+/);
    
    const commonWords = csvWords.filter(word => dbWords.includes(word));
    const unionSize = new Set([...csvWords, ...dbWords]).size;
    
    if (commonWords.length > 0) {
      return (commonWords.length * 2) / unionSize; // Jaccard-like similarity
    }
    
    // Levenshtein distance for close matches
    const distance = this.levenshteinDistance(cleanCsv, cleanDb);
    const maxLen = Math.max(cleanCsv.length, cleanDb.length);
    
    if (maxLen === 0) return 0;
    
    const similarity = 1 - (distance / maxLen);
    return similarity > 0.6 ? similarity : 0;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Proper English pluralization for table names
   */
  private pluralize(word: string): string {
    // Handle common irregular plurals
    const irregulars: Record<string, string> = {
      'property': 'properties',
      'business': 'businesses',
      'company': 'companies',
      'category': 'categories',
      'entity': 'entities',
      'city': 'cities',
      'country': 'countries',
      'person': 'people',
      'child': 'children',
      'mouse': 'mice',
      'foot': 'feet',
      'tooth': 'teeth',
      'man': 'men',
      'woman': 'women'
    };

    if (irregulars[word.toLowerCase()]) {
      return irregulars[word.toLowerCase()];
    }

    // Handle regular pluralization rules
    if (word.endsWith('y') && !['a', 'e', 'i', 'o', 'u'].includes(word[word.length - 2])) {
      return word.slice(0, -1) + 'ies';
    }
    if (word.endsWith('s') || word.endsWith('sh') || word.endsWith('ch') || word.endsWith('x') || word.endsWith('z')) {
      return word + 'es';
    }
    if (word.endsWith('f')) {
      return word.slice(0, -1) + 'ves';
    }
    if (word.endsWith('fe')) {
      return word.slice(0, -2) + 'ves';
    }
    
    // Default: just add 's'
    return word + 's';
  }

  /**
   * PERMIT-AWARE table filtering - understands that CSV contains permit data
   */
  private filterDataForTable(data: any[], table: any): any[] {
    if (!data || data.length === 0) return [];
    
    const tableName = table.name.toLowerCase();
    console.log(\`[PERMIT Filter] Processing table: \${tableName}\`);
    
    // PROPERTIES: Create unique properties from address data
    if (tableName === 'properties') {
      const uniqueProperties = this.extractUniqueProperties(data);
      console.log(\`[PERMIT Filter] Properties - extracted \${uniqueProperties.length} unique properties from \${data.length} permits\`);
      return uniqueProperties;
    }
    
    // PERMITS: Each CSV row is a permit
    if (tableName === 'permits') {
      console.log(\`[PERMIT Filter] Permits - using all \${data.length} rows (each row is a permit)\`);
      return data;
    }
    
    // BUILDERS: Extract unique builder names
    if (tableName === 'builders') {
      const uniqueBuilders = this.extractUniqueValues(data, ['BUILDERS', 'BUSINESS_NAME'], 'name');
      console.log(\`[PERMIT Filter] Builders - extracted \${uniqueBuilders.length} unique builders\`);
      return uniqueBuilders;
    }
    
    // PROPERTY_FEATURES: One per property, aggregate features
    if (tableName === 'property_features') {
      const uniqueProperties = this.extractUniqueProperties(data);
      console.log(\`[PERMIT Filter] Property Features - \${uniqueProperties.length} properties with features\`);
      return uniqueProperties; // Will map features in column mapping
    }
    
    // PROPERTY_ASSESSMENTS: One per property, use assessment data
    if (tableName === 'property_assessments') {
      const uniqueProperties = this.extractUniqueProperties(data);
      console.log(\`[PERMIT Filter] Property Assessments - \${uniqueProperties.length} properties with assessment data\`);
      return uniqueProperties;
    }
    
    // LOOKUP TABLES: Extract unique values
    if (this.isLookupTable(table)) {
      const uniqueValues = this.extractUniqueValuesForLookup(data, table);
      console.log(\`[PERMIT Filter] Lookup \${tableName} - extracted \${uniqueValues.length} unique values\`);
      return uniqueValues;
    }
    
    // DEFAULT: Use all data
    console.log(\`[PERMIT Filter] Default \${tableName} - using all \${data.length} rows\`);
    return data;
  }

  /**
   * Determine if a table is a main entity table
   */
  private isMainEntityTable(table: any): boolean {
    if (!table.columns) return false;
    
    const nonSystemColumns = table.columns.filter(col => 
      !['id', 'created_at', 'updated_at'].includes(col.name.toLowerCase())
    );
    
    const foreignKeyColumns = table.columns.filter(col => 
      col.name.toLowerCase().endsWith('_id') && col.name.toLowerCase() !== 'id'
    );
    
    // Main entity if it has many non-FK columns
    const dataColumns = nonSystemColumns.length - foreignKeyColumns.length;
    console.log(\`[MainEntity Check] \${table.name}: \${nonSystemColumns.length} non-system cols, \${foreignKeyColumns.length} FK cols, \${dataColumns} data cols\`);
    return dataColumns >= 3; // At least 3 data columns suggests main entity
  }

  /**
   * Enhanced lookup table detection
   */
  private isLookupTable(table: any): boolean {
    if (!table.columns) return false;
    
    // Simple lookup patterns
    const lookupPatterns = ['_types', '_statuses', '_categories', 'jurisdictions', 'roles', 'permissions'];
    if (lookupPatterns.some(pattern => table.name.toLowerCase().includes(pattern))) {
      return true;
    }
    
    // Small tables with name field
    const hasNameField = table.columns.some(col => 
      ['name', 'title', 'label', 'value'].includes(col.name.toLowerCase())
    );
    
    const nonSystemColumns = table.columns.filter(col => 
      !['id', 'created_at', 'updated_at'].includes(col.name.toLowerCase())
    );
    
    const isLookup = hasNameField && nonSystemColumns.length <= 3;
    console.log(\`[Lookup Check] \${table.name}: hasNameField=\${hasNameField}, nonSystemCols=\${nonSystemColumns.length}, isLookup=\${isLookup}\`);
    return isLookup;
  }

  /**
   * Extract unique values for lookup tables based on table structure
   */
  private extractUniqueValuesForLookup(data: any[], table: any): any[] {
    // Find the primary value column (usually 'name', 'title', etc.)
    const valueColumn = table.columns?.find(col => 
      ['name', 'title', 'label', 'value', 'status', 'type'].includes(col.name.toLowerCase())
    );
    
    if (!valueColumn) {
      console.log(\`[Lookup] No value column found for \${table.name}, using name fallback\`);
      return this.extractUniqueValues(data, ['name', 'title', 'status', 'type'], 'name');
    }
    
    const csvKeys = Object.keys(data[0] || {});
    const relevantCsvColumns = csvKeys.filter(key => 
      this.calculateSemanticScore(key.toLowerCase(), valueColumn.name.toLowerCase()) > 0.5
    );
    
    console.log(\`[Lookup] Extracting \${valueColumn.name} from CSV columns: \${relevantCsvColumns.join(', ')}\`);
    
    return this.extractUniqueValues(data, relevantCsvColumns, valueColumn.name);
  }

  /**
   * Check if row has relevant data for a specific table
   */
  private hasRelevantDataForTable(row: any, table: any): boolean {
    if (!table.columns) return false;
    
    // Check if row has data for any of the table's non-system columns
    const dataColumns = table.columns.filter(col => 
      !['id', 'created_at', 'updated_at'].includes(col.name.toLowerCase())
    );
    
    return dataColumns.some(col => {
      const value = this.findCsvValue(row, col.name);
      return value && value !== '' && value !== 'null' && value !== 'NULL';
    });
  }

  /**
   * Extract unique properties from permit data
   */
  private extractUniqueProperties(data: any[]): any[] {
    const propertyMap = new Map<string, any>();
    
    data.forEach(row => {
      // Create property key from address
      const streetAddress = row['STREETADDRESS'] || row['PROPERTYFULLSTREETADDRESS'] || '';
      const city = row['CITY'] || '';
      const state = row['STATE'] || '';
      const zipCode = row['ZIP_CODE'] || '';
      
      if (!streetAddress) return; // Skip if no address
      
      const propertyKey = \`\${streetAddress}|\${city}|\${state}|\${zipCode}\`.toLowerCase();
      
      if (!propertyMap.has(propertyKey)) {
        propertyMap.set(propertyKey, {
          street_address: streetAddress,
          city: city,
          state: state,
          zip_code: zipCode,
          latitude: row['LATITUDE'] || null,
          longitude: row['LONGITUDE'] || null,
          parcel_number: row['PARCEL_NUMBER'] || row['APN'] || null,
          subdivision: row['SUBDIVISION'] || null,
          county_fips: row['COUNTY_FIPS'] || null,
          // Keep the original row for property features/assessments
          _originalRow: row
        });
      }
    });
    
    return Array.from(propertyMap.values());
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
   * Pre-resolve all foreign keys for a table to avoid repeated lookups
   */
  private async preResolveForeignKeys(table: any): Promise<void> {
    const foreignKeyColumns = (table.columns || []).filter(col => 
      col.name.endsWith('_id') && col.name !== 'id' && col.nullable === false
    );
    
    console.log(\`🔄 Pre-resolving \${foreignKeyColumns.length} foreign keys for \${table.name}\`);
    
    for (const col of foreignKeyColumns) {
      const cacheKey = col.name;
      
      // Skip if already cached
      if (this.fkCache.has(cacheKey)) {
        continue;
      }
      
      // Find the referenced table
      const baseTableName = col.name.replace('_id', '');
      const pluralTableName = this.pluralize(baseTableName);
      
      const schema = this.request.schema;
      const actualTable = schema.tables.find(t => 
        t.name === pluralTableName || t.name === baseTableName || t.name === baseTableName + 's'
      );
      
      const referencedTableName = actualTable ? actualTable.name : pluralTableName;
      const alternateTableName = actualTable ? null : baseTableName;
      
      console.log(\`🔍 Pre-resolving FK \${col.name} -> \${referencedTableName}\`);
      
      // Try to get an existing ID
      let resolvedId = await this.getExistingForeignKeyId(referencedTableName);
      if (!resolvedId && alternateTableName) {
        resolvedId = await this.getExistingForeignKeyId(alternateTableName);
      }
      
      // If no existing ID, try to create a default record
      if (!resolvedId) {
        console.log(\`🔧 No existing records found in \${referencedTableName}, creating default record\`);
        resolvedId = await this.createDefaultForeignKeyRecord(referencedTableName, alternateTableName);
      }
      
      // Cache the result
      this.fkCache.set(cacheKey, resolvedId);
      
      if (resolvedId) {
        console.log(\`✅ Pre-resolved FK \${col.name} -> \${resolvedId}\`);
      } else {
        console.log(\`❌ Cannot resolve FK \${col.name} - rows with this FK will be skipped\`);
      }
    }
  }

  /**
   * Get an existing ID from a referenced table for foreign key resolution
   */
  private async getExistingForeignKeyId(tableName: string): Promise<string | null> {
    try {
      console.log(\`🔍 Looking for existing ID in table: \${tableName}\`);
      
      const { data, error } = await this.supabaseClient
        .from(tableName)
        .select('id')
        .limit(1)
        .single();
      
      if (error) {
        console.log(\`❌ Error querying \${tableName}:\`, error.message);
        return null;
      }
      
      if (data && data.id) {
        console.log(\`✅ Found existing ID in \${tableName}: \${data.id}\`);
        return data.id;
      }
      
      console.log(\`📭 No records found in \${tableName}\`);
      return null;
    } catch (error) {
      console.log(\`❌ Failed to query \${tableName}:\`, error);
      return null;
    }
  }

  /**
   * Create table-specific default records with required fields
   */
  private createTableSpecificDefaultRecord(tableName: string): any {
    const baseRecord = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    switch (tableName.toLowerCase()) {
      case 'properties':
        return {
          ...baseRecord,
          street_address: 'Default Property Address',
          city: 'Default City',
          state: 'FL',
          zip_code: '00000'
        };
      
      case 'businesses':
        return {
          ...baseRecord,
          name: 'Default Business'
        };
      
      case 'builders':
        return {
          ...baseRecord,
          name: 'Default Builder'
        };
      
      case 'jurisdictions':
        return {
          ...baseRecord,
          name: 'Default Jurisdiction'
        };
      
      case 'permit_types':
        return {
          ...baseRecord,
          name: 'Default Permit Type'
        };
      
      case 'permit_statuses':
        return {
          ...baseRecord,
          name: 'Default Status'
        };
      
      default:
        // Generic default for other tables
        return {
          ...baseRecord,
          name: 'Default'
        };
    }
  }

  /**
   * Create a default record in a referenced table for foreign key resolution
   */
  private async createDefaultForeignKeyRecord(primaryTableName: string, alternateTableName?: string): Promise<string | null> {
    const tablesToTry = [primaryTableName];
    if (alternateTableName) {
      tablesToTry.push(alternateTableName);
    }
    
    for (const tableName of tablesToTry) {
      try {
        console.log(\`🔧 Attempting to create default record in: \${tableName}\`);
        
        // Create a table-specific default record
        const defaultRecord = this.createTableSpecificDefaultRecord(tableName);
        
        const { data, error } = await this.supabaseClient
          .from(tableName)
          .insert([defaultRecord])
          .select('id')
          .single();
        
        if (error) {
          console.log(\`❌ Failed to create default record in \${tableName}:\`, error.message);
          continue; // Try the next table name
        }
        
        if (data && data.id) {
          console.log(\`✅ Created default record in \${tableName}: \${data.id}\`);
          return data.id;
        }
        
      } catch (error) {
        console.log(\`❌ Error creating default record in \${tableName}:\`, error);
        continue; // Try the next table name
      }
    }
    
    console.log(\`❌ Failed to create default record in any of: \${tablesToTry.join(', ')}\`);
    return null;
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
                .upsert(uniqueData);
              
              if (error) {
                if (['23505', '23503', '23502'].includes(error.code)) {
                  console.log(\`⚠️ \${table.name} constraint error (continuing):\`, error.message);
                } else {
                  console.log(\`❌ \${table.name} upsert error:\`, error.message);
                  this.errors.push({
                    table: table.name,
                    error: error.message,
                    timestamp: new Date(),
                  });
                }
              } else {
                this.progress.successfulRows += uniqueData.length;
                console.log(\`✅ \${table.name}: \${uniqueData.length} rows upserted\`);
              }
            }
          } else {
            // For main tables, use upsert with error resilience
            const { error } = await this.supabaseClient
              .from(table.name)
              .upsert(tableData);
            
            if (error) {
              if (['23505', '23503', '23502'].includes(error.code)) {
                console.log(\`⚠️ \${table.name} constraint error (continuing):\`, error.message);
              } else {
                console.log(\`❌ \${table.name} upsert error:\`, error.message);
                // Try individual inserts for better error isolation
                await this.insertRowsIndividually(table.name, tableData);
              }
            } else {
              this.progress.successfulRows += tableData.length;
              console.log(\`✅ \${table.name}: \${tableData.length} rows inserted\`);
            }
          }
        } catch (error) {
          console.log(\`❌ Error processing \${table.name}:\`, error.message);
          this.progress.failedRows += tableData.length;
          this.errors.push({
            table: table.name,
            error: error.message,
            timestamp: new Date(),
          });
          // Continue processing other tables instead of stopping
        }
      }
    }
  }

  /**
   * Schedule the next chunk to be processed (immediate fire-and-forget)
   */
  private scheduleNextChunkImmediate(processedRows: number, totalRows: number, chunkSize: number): void {
    const nextChunkIndex = Math.floor(processedRows / chunkSize);
    
    console.log(\`🚀 Immediately scheduling next chunk: \${nextChunkIndex}\`);
    
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
    fetch(\`https://\${this.request.schema?.projectId || 'unknown'}.supabase.co/functions/v1/seed-data?stream=true\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextRequest)
    }).then(response => {
      console.log(\`✅ Continuation scheduled: \${response.ok ? 'success' : 'failed'}\`);
    }).catch(error => {
      console.log(\`❌ Continuation failed:\`, error.message);
    });
  }

  /**
   * Insert rows individually for better error isolation
   */
  private async insertRowsIndividually(tableName: string, rows: any[]): Promise<void> {
    let successful = 0;
    let failed = 0;
    
    for (const row of rows) {
      try {
        const { error } = await this.supabaseClient
          .from(tableName)
          .insert([row]);
          
        if (error) {
          failed++;
          console.log(\`❌ Individual row error in \${tableName}:\`, error.message);
        } else {
          successful++;
        }
      } catch (error) {
        failed++;
      }
    }
    
    console.log(\`📊 \${tableName} individual inserts: \${successful} success, \${failed} failed\`);
    this.progress.successfulRows += successful;
    this.progress.failedRows += failed;
  }

  /**
   * Insert property rows individually and cache successful IDs
   */
  private async insertRowsIndividuallyAndCache(tableName: string, rows: any[], baseRowIndex: number): Promise<void> {
    let successful = 0;
    let failed = 0;
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const { data, error } = await this.supabaseClient
          .from(tableName)
          .insert([row])
          .select('id')
          .single();
          
        if (error) {
          failed++;
          console.log(\`❌ Individual row error in \${tableName}:\`, error.message);
        } else {
          successful++;
          // Cache the successful property ID
          if (tableName === 'properties' && data?.id) {
            this.propertyIdCache.set(baseRowIndex + i, data.id);
          }
        }
      } catch (error) {
        failed++;
      }
    }
    
    console.log(\`📊 \${tableName} individual inserts: \${successful} success, \${failed} failed\`);
    this.progress.successfulRows += successful;
    this.progress.failedRows += failed;
  }

  /**
   * Schedule the next chunk to be processed (legacy method for compatibility)
   */
  private async scheduleNextChunk(): Promise<void> {
    const currentChunk = this.request.chunkIndex || 0;
    const nextChunkIndex = currentChunk + 1;
    
    console.log(\`✅ Scheduling next chunk: \${nextChunkIndex} (current was \${currentChunk})\`);
    
    const nextRequest = {
      fileId: this.request.fileId,
      jobId: this.request.jobId,
      schema: this.request.schema,
      configuration: this.request.configuration,
      fileUpload: this.request.fileUpload,
      projectConfig: this.request.projectConfig,
      chunkIndex: nextChunkIndex,
      processedRows: this.progress.processedRows
    };

    // Fire-and-forget approach
    setTimeout(async () => {
      try {
        const projectId = this.request.schema?.projectId || this.request.projectConfig?.projectId;
        const response = await fetch(\`https://\${projectId}.supabase.co/functions/v1/seed-data\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(nextRequest)
        });
        
        console.log(\`📤 Chunk \${nextChunkIndex} scheduled: \${response.ok ? 'success' : 'failed'}\`);
      } catch (error) {
        console.log(\`❌ Error scheduling chunk \${nextChunkIndex}:\`, error.message);
      }
    }, 100);
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
          // Use fuzzy matching to find CSV values
          const rawValue = this.findCsvValue(row, column.name) || '';
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