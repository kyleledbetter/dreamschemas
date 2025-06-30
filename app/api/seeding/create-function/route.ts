/**
 * API Route: Create Dynamic seed-data Edge Function in user's Supabase project
 * Phase 10: AI-Powered Dynamic Data Seeding & Large File Processing
 */

import { NextRequest, NextResponse } from "next/server";
import { generateDynamicSeederFunction } from "@/lib/edge-functions/dynamic-seeder-template";
import type { DatabaseSchema } from "@/types/schema.types";

interface CreateFunctionRequest {
  projectId: string;
  schema: DatabaseSchema;
  csvMetadata?: {
    headers: string[];
    sampleData: Record<string, unknown>[];
    totalRows: number;
  }[];
  useSimpleVersion?: boolean;
}

interface SeedingLogic {
  tableProcessors: string;
  columnMappers: string;
  relationshipResolvers: string;
  validationRules: string;
  constants: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateFunctionRequest = await request.json();
    const { projectId, schema } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      );
    }

    if (!schema) {
      return NextResponse.json(
        { error: "Database schema is required" },
        { status: 400 }
      );
    }

    if (!schema.tables || !Array.isArray(schema.tables) || schema.tables.length === 0) {
      return NextResponse.json(
        { error: "Schema must contain at least one table" },
        { status: 400 }
      );
    }

    // Ensure schema has required properties
    if (!schema.relationships) {
      schema.relationships = [];
    }

    console.log(`📋 Schema validation passed: ${schema.tables.length} tables, ${schema.relationships.length} relationships`);
    console.log(`🏗️ Table names: ${schema.tables.map(t => t.name).join(', ')}`);
    console.log(`📊 Sample table columns: ${schema.tables[0]?.columns?.map(c => c.name).join(', ') || 'none'}`);

    // Get OAuth token from Authorization header
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required. Please provide a valid access token." },
        { status: 401 }
      );
    }

    console.log(`🚀 Generating dynamic edge function for schema with ${schema.tables.length} tables (v4.0 - AI-Schema-Aware Edition)`);

    // Build comprehensive schema analysis for intelligent processing
    const tableAnalysis = analyzeSchemaStructure(schema);

    // Generate the seeding logic using the advanced AI-schema-aware generator
    const seedingLogic = generateAdvancedSeedingLogic(schema, tableAnalysis);

    // Step 2: Generate the complete edge function using the template
    const functionSource = generateDynamicSeederFunction(seedingLogic);

    console.log(`📋 Generated edge function (${functionSource.length} chars) with AI-schema-aware logic`);

    // Step 3: Deploy the Edge Function using the Supabase Management API
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

    // Deploy the Edge Function
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
      console.error("Failed to deploy dynamic Edge Function:", errorText);
      
      return NextResponse.json(
        { error: `Failed to deploy Edge Function: ${errorText}` },
        { status: deployResponse.status }
      );
    }

    const functionData = await deployResponse.json();

    return NextResponse.json({
      success: true,
      message: `Advanced AI-Schema-Aware Edge Function deployed successfully for ${schema.tables.length} tables`,
      functionUrl: `https://${projectId}.supabase.co/functions/v1/seed-data`,
      function: functionData,
      version: "ai-schema-aware-v4",
      metadata: {
        tablesCount: schema.tables.length,
        relationshipsCount: schema.relationships.length,
        tableTypes: tableAnalysis.reduce((acc: Record<string, number>, t: { type: string }) => {
          acc[t.type] = (acc[t.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        features: [
          "UUID Generation with uuid_generate_v4()",
          "Advanced Foreign Key Resolution", 
          "Schema-Aware Column Mapping",
          "Type-Aware Data Validation",
          "Dependency-Based Table Processing"
        ]
      }
    });
  } catch (error) {
    console.error("Error creating dynamic Edge Function:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Analyzes AI-generated schema to understand table types and relationships
 */
function analyzeSchemaStructure(schema: DatabaseSchema) {
    return schema.tables.map(table => {
      // Analyze table structure to determine its type
      const nonSystemColumns = table.columns.filter(col => 
        !['id', 'created_at', 'updated_at'].includes(col.name)
      );
      
      // Check if it's a lookup table (typically has only name/title + maybe one other field)
      const isLookupTable = nonSystemColumns.length <= 2 && 
        nonSystemColumns.some(col => 
          col.name.includes('name') || col.name.includes('title') || col.name.includes('status')
        );
      
      // Check if it's a junction table (for many-to-many relationships)
      const isJunctionTable = nonSystemColumns.length <= 3 && 
        nonSystemColumns.filter(col => col.name.endsWith('_id')).length >= 2;
      
      // Find foreign key columns
      const foreignKeys = table.columns.filter(col => 
        col.name.endsWith('_id') && 
        (col.constraints.some(c => c.type === 'FOREIGN KEY') || col.name === 'user_id')
      );
      
      // Determine source CSV columns for this table
      const sourceColumns = table.columns
        .filter(col => col.originalCSVColumn)
        .map(col => col.originalCSVColumn!);
      
      return {
        name: table.name,
        type: isJunctionTable ? 'junction' : isLookupTable ? 'lookup' : 'data',
        nonSystemColumns: nonSystemColumns.map(col => col.name),
        foreignKeys: foreignKeys.map(fk => ({
          column: fk.name,
          targetTable: fk.name === 'user_id' ? 'auth.users' : 
            fk.name.replace('_id', '') + 's' // Simple pluralization
        })),
        sourceColumns,
        columnCount: table.columns.length
      };
    });
}

/**
 * Generate advanced AI-schema-aware seeding logic
 * Handles proper UUID generation, sophisticated table relationships, and normalization
 */
function generateAdvancedSeedingLogic(schema: DatabaseSchema, tableAnalysis: ReturnType<typeof analyzeSchemaStructure>): SeedingLogic {
  console.log("🔧 Generating advanced AI-schema-aware seeding logic...");
  console.log(`🏗️ Processing ${schema.tables.length} tables: ${schema.tables.map(t => t.name).join(', ')}`);
  console.log(`🔗 Processing ${schema.relationships.length} relationships`);
  
  const relationships = schema.relationships;

  return {
    constants: `
// Advanced AI-Schema-Aware Configuration
const SCHEMA_CONFIG = {
  batchSize: 50,
  maxRetries: 3,
  timeoutMs: 1200,
  tables: ${JSON.stringify(schema.tables)},
  relationships: ${JSON.stringify(relationships)},
  tableAnalysis: ${JSON.stringify(tableAnalysis)}
};

const PERFORMANCE_CONFIG = {
  enableCaching: true,
  logLevel: 'info',
  validateData: true,
  complexityScore: ${schema.tables.length * 2 + schema.relationships.length},
  useUUIDGeneration: true,
  enableFKResolution: true
};

// UUID Generation Helper - Uses PostgreSQL's uuid_generate_v4()
const generateUUID = () => {
  // In edge functions, we'll use crypto.randomUUID() as fallback
  // but ensure proper UUID format for PostgreSQL
  return crypto.randomUUID();
};

// Table Type Analysis from AI Schema
const TABLE_TYPES = {
${tableAnalysis.map(t => `  "${t.name}": "${t.type}"`).join(',\n')}
};

console.log('🧠 AI Schema Analysis:', SCHEMA_CONFIG.tableAnalysis);`,

    tableProcessors: `
// Advanced AI-Schema-Aware Table Processing

// String similarity functions for intelligent column matching
const calculateStringSimilarity = (str1, str2) => {
  try {
    // Null safety checks
    if (str1 == null || str2 == null) return 0;
    
    // Convert to strings and ensure they're valid
    const s1 = String(str1 || '');
    const s2 = String(str2 || '');
    
    // Empty string checks
    if (s1.length === 0 && s2.length === 0) return 1.0;
    if (s1.length === 0 || s2.length === 0) return 0;
    
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  } catch (error) {
    console.warn(\`calculateStringSimilarity error: \${error.message}\`);
    return 0;
  }
};

const levenshteinDistance = (str1, str2) => {
  try {
    // Null safety checks
    if (str1 == null || str2 == null) return Math.max(String(str1 || '').length, String(str2 || '').length);
    
    // Convert to strings and ensure they're valid
    const s1 = String(str1 || '');
    const s2 = String(str2 || '');
    
    // Quick checks for empty strings
    if (s1.length === 0) return s2.length;
    if (s2.length === 0) return s1.length;
    
    const matrix = Array(s2.length + 1).fill().map(() => Array(s1.length + 1).fill(0));
    
    for (let i = 0; i <= s2.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= s1.length; j++) matrix[0][j] = j;
    
    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        matrix[i][j] = s2[i-1] === s1[j-1] ? matrix[i-1][j-1] : 
          Math.min(matrix[i-1][j-1], matrix[i][j-1], matrix[i-1][j]) + 1;
      }
    }
    
    return matrix[s2.length][s1.length];
  } catch (error) {
    console.warn(\`levenshteinDistance error: \${error.message}\`);
    return 999; // Return high distance on error
  }
};

const normalizeColumnName = (name) => {
  try {
    if (name == null || name === undefined) return '';
    const str = String(name || '').toLowerCase().trim();
    if (!str) return '';
    return str.replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  } catch (error) {
    console.warn(\`normalizeColumnName error: \${error.message}\`);
    return '';
  }
};

// Advanced column matching using AI schema information
const findBestColumnMatch = (csvHeader, targetColumns, tableType) => {
  try {
    // Enhanced null/undefined checks
    if (csvHeader == null || csvHeader === undefined) return null;
    if (!targetColumns || !Array.isArray(targetColumns) || targetColumns.length === 0) return null;
    
    // Ensure csvHeader is a string and handle edge cases
    let headerStr;
    try {
      headerStr = String(csvHeader || '').trim();
    } catch (stringError) {
      console.warn(\`Error converting csvHeader to string: \${stringError.message}\`);
      return null;
    }
    
    if (!headerStr || headerStr.length === 0) return null;
    
    const normalizedCsv = normalizeColumnName(headerStr);
    if (!normalizedCsv || normalizedCsv.length === 0) return null;
    
    // Exact match first with better error handling
    const exactMatch = targetColumns.find(col => {
      try {
        if (col == null || col === undefined) return false;
        const normalizedCol = normalizeColumnName(String(col || ''));
        return normalizedCol === normalizedCsv;
      } catch (error) {
        console.warn(\`Error in exact match for column \${col}: \${error.message}\`);
        return false;
      }
    });
    if (exactMatch) return exactMatch;
    
    // Fuzzy matching with enhanced error handling
    let bestMatch = null;
    let bestScore = 0;
    const threshold = 0.5; // Standard threshold
    
    // Use for...of instead of forEach for better error control
    for (const dbColumn of targetColumns) {
      try {
        if (dbColumn == null || dbColumn === undefined) continue;
        
        const normalizedDb = normalizeColumnName(String(dbColumn || ''));
        if (!normalizedDb || normalizedDb.length === 0) continue;
        
        const score = calculateStringSimilarity(normalizedCsv, normalizedDb);
        
        // Ensure score is a valid number
        if (typeof score === 'number' && !isNaN(score) && score > bestScore && score >= threshold) {
          bestScore = score;
          bestMatch = dbColumn;
        }
      } catch (error) {
        console.warn(\`Column matching error for \${dbColumn}: \${error.message}\`);
        // Continue with next column instead of breaking
        continue;
      }
    }
    
    return bestMatch;
  } catch (error) {
    console.error(\`findBestColumnMatch fatal error: \${error.message}\`);
    return null;
  }
};

// Build dependency-aware table processing order based on actual schema
const buildTableProcessingOrder = () => {
  const tables = SCHEMA_CONFIG.tables;
  const sorted = [];
  const visited = new Set();
  const visiting = new Set();
  
  // Create a map of table relationships
  const tableRefs = new Map();
  tables.forEach(table => {
    const refs = [];
    table.columns.forEach(col => {
      if (col.constraints) {
        col.constraints.forEach(constraint => {
          if (constraint.type === 'FOREIGN KEY' && constraint.referencedTable) {
            refs.push(constraint.referencedTable);
          }
        });
      }
    });
    tableRefs.set(table.name, refs);
  });
  
  const visit = (tableName) => {
    if (visiting.has(tableName)) return; // Circular dependency
    if (visited.has(tableName)) return;
    
    visiting.add(tableName);
    
    // Visit dependencies first (tables this table references)
    const refs = tableRefs.get(tableName) || [];
    refs.forEach(refTable => {
      if (tables.find(t => t.name === refTable)) {
        visit(refTable);
      }
    });
    
    visiting.delete(tableName);
    visited.add(tableName);
    sorted.push(tableName);
  };
  
  // Visit all tables
  tables.forEach(table => visit(table.name));
  
  return sorted;
};

const TABLE_PROCESSING_ORDER = buildTableProcessingOrder();
console.log('🏗️ Advanced Table Processing Order:', TABLE_PROCESSING_ORDER);

// AI-Schema-Aware data filtering for each table type
const filterDataForTable = (data, tableName) => {
  console.log(\`📋 Filtering \${data.length} rows for \${tableName}...\`);
  
  const tableInfo = SCHEMA_CONFIG.tables.find(t => t.name === tableName);
  if (!tableInfo) {
    console.warn(\`⚠️  Unknown table: \${tableName}\`);
    return [];
  }
  
  // For this schema, all tables should get all data since it's a denormalized CSV
  // The column mapping will handle which fields go to which table
  console.log(\`📊 \${tableName}: Processing all \${data.length} rows\`);
  
  return data.filter(row => row && typeof row === 'object');
};`,

    columnMappers: `
// Advanced AI-Schema-Aware Column Mapping

// Get full table schema information from AI-generated schema
const getTableSchema = (tableName) => {
  const table = SCHEMA_CONFIG.tables.find(t => t.name === tableName);
  return table || null;
};

// Get mappable columns (excluding system columns)
const getTableColumns = (tableName) => {
  const table = getTableSchema(tableName);
  if (!table) return [];
  
  return table.columns
    .filter(col => !['id', 'created_at', 'updated_at'].includes(col.name))
    .map(col => col.name);
};

// Enhanced type-aware value conversion with better TEXT/UUID handling
const convertValue = (value, column) => {
  try {
    // Enhanced null/undefined safety checks
    if (value == null || value === undefined || value === '' || value === '\\\\N') return null;
    
    // Column safety checks
    if (!column || typeof column !== 'object') {
      console.warn(\`⚠️ Invalid column definition for value conversion\`);
      return null;
    }
    
    if (!column.type || typeof column.type !== 'string') {
      console.warn(\`⚠️ Invalid column type for \${column.name || 'unknown'}\`);
      return null;
    }
    
    // Safe string conversion with error handling
    let str;
    try {
      str = String(value || '').trim();
    } catch (stringError) {
      console.warn(\`⚠️ Error converting value to string: \${stringError.message}\`);
      return null;
    }
    
    if (!str || str.length === 0) return null;
    
    const type = column.type.toLowerCase();
    
    switch (type) {
      case 'text':
        // Handle TEXT columns that might be UUIDs or regular text
        if (column.name === 'id' || column.name.endsWith('_id')) {
          // For ID fields, generate UUID if not provided or invalid
          return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3}-[0-9a-f]{3}-[0-9a-f]{12}$/i.test(str) 
            ? str : generateUUID();
        }
        // For other TEXT columns, return as string
        return str;
      
      case 'uuid':
        // Validate UUID format or generate new one
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3}-[0-9a-f]{3}-[0-9a-f]{12}$/i.test(str) 
          ? str : generateUUID();
      
      case 'smallint':
      case 'integer':
      case 'bigint':
        const int = parseInt(str, 10);
        return isNaN(int) ? null : int;
      
      case 'numeric':
      case 'decimal':
      case 'real':
      case 'double precision':
        const float = parseFloat(str);
        return isNaN(float) ? null : float;
      
      case 'boolean':
        return ['true', '1', 'yes', 'y', 'on'].includes(str.toLowerCase());
      
      case 'date':
        const date = new Date(str);
        return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
      
      case 'timestamp':
      case 'timestamptz':
        const timestamp = new Date(str);
        return isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
      
      case 'jsonb':
      case 'json':
        try {
          return typeof str === 'string' && str.startsWith('{') ? JSON.parse(str) : str;
        } catch {
          return str;
        }
      
      case 'varchar':
      case 'text':
      case 'char':
      default:
        return column.length && str.length > column.length ? str.substring(0, column.length) : str;
    }
  } catch (error) {
    console.warn(\`⚠️ Value conversion failed for \${column.name || 'unknown'} (\${column.type || 'unknown'}): \${error.message}\`);
    return null;
  }
};

// Enhanced CSV to table mapping with property-based foreign key resolution
const mapCSVToTableColumns = (csvRow, tableName) => {
  try {
    console.log(\`🔄 \${tableName}: AI-schema-aware mapping...\`);
    
    if (!csvRow || typeof csvRow !== 'object') {
      console.error(\`❌ \${tableName}: Invalid CSV row data\`);
      return null;
    }
    
    const tableSchema = getTableSchema(tableName);
    if (!tableSchema) {
      console.error(\`❌ \${tableName}: Schema not found\`);
      return null;
    }
    
    // Initialize with proper UUID and timestamps using PostgreSQL functions
    const mapped = {
      id: generateUUID(), // This will be a proper UUID for PostgreSQL
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const mappedFields = [];
    const skippedFields = [];
    const conversionErrors = [];
    
    // Get target columns for this table with safety checks
    const targetColumns = getTableColumns(tableName);
    if (!Array.isArray(targetColumns)) {
      console.error(\`❌ \${tableName}: Failed to get target columns\`);
      return null;
    }
    
    // Safely extract CSV headers with enhanced filtering
    let csvHeaders;
    try {
      csvHeaders = Object.keys(csvRow || {}).filter(key => 
        key != null && 
        key !== undefined && 
        String(key).trim().length > 0
      );
    } catch (error) {
      console.error(\`❌ \${tableName}: Error extracting CSV headers: \${error.message}\`);
      return null;
    }
    
    if (!Array.isArray(csvHeaders) || csvHeaders.length === 0) {
      console.warn(\`⚠️ \${tableName}: No valid CSV headers found\`);
      return null;
    }
    
    console.log(\`📋 \${tableName}: Mapping \${csvHeaders.length} CSV fields to \${targetColumns.length} target columns\`);
    
    // Create property address cache for foreign key resolution
    if (tableName === 'properties') {
      const addressKey = [
        csvRow['STREETADDRESS'] || csvRow['PROPERTYFULLSTREETADDRESS'] || '',
        csvRow['CITY'] || '',
        csvRow['STATE'] || '',
        csvRow['ZIP_CODE'] || ''
      ].join('|').toLowerCase().trim();
      
      if (addressKey && addressKey !== '|||') {
        mapped._addressKey = addressKey; // Store for FK resolution
      }
    }
    
    // Map each target column to best CSV field with enhanced safety
    targetColumns.forEach(targetCol => {
      try {
        // Enhanced null/undefined checks for targetCol
        if (targetCol == null || targetCol === undefined) {
          console.warn(\`⚠️ \${tableName}: Encountered null/undefined target column, skipping\`);
          return;
        }
        
        // Ensure targetCol is a valid string
        const targetColStr = String(targetCol || '').trim();
        if (!targetColStr || targetColStr.length === 0) {
          console.warn(\`⚠️ \${tableName}: Empty target column name, skipping\`);
          return;
        }
        
        const column = tableSchema.columns.find(c => c && c.name === targetColStr);
        if (!column) {
          console.warn(\`⚠️ \${tableName}: Column schema not found for \${targetColStr}\`);
          return;
        }
        
        let bestCsvHeader = null;
        let isFromForeignKeyMapping = false;
        
        // SPECIAL HANDLING for property_id foreign key columns
        if (targetColStr === 'property_id' && tableName !== 'properties') {
          // For property_id, we need to store the address components to resolve later
          const addressComponents = {
            street: csvRow['STREETADDRESS'] || csvRow['PROPERTYFULLSTREETADDRESS'] || '',
            city: csvRow['CITY'] || '',
            state: csvRow['STATE'] || '',
            zip: csvRow['ZIP_CODE'] || ''
          };
          
          const addressKey = [addressComponents.street, addressComponents.city, addressComponents.state, addressComponents.zip]
            .join('|').toLowerCase().trim();
            
          if (addressKey && addressKey !== '|||') {
            mapped[targetColStr] = addressKey; // Store address key for FK resolution
            mappedFields.push(\`"Address Components" → \${targetColStr} (FK)\`);
            console.log(\`🔗 \${tableName}: Property FK mapping: "\${addressKey}" → \${targetColStr}\`);
            return;
          }
        }
        
        // If no foreign key mapping found, use regular column matching
        if (!bestCsvHeader) {
          bestCsvHeader = findBestColumnMatch(targetColStr, csvHeaders, 'data');
        }
        
        if (bestCsvHeader && csvRow[bestCsvHeader] != null && csvRow[bestCsvHeader] !== '') {
          try {
            const convertedValue = convertValue(csvRow[bestCsvHeader], column);
            
            if (convertedValue !== null && convertedValue !== undefined) {
              mapped[targetColStr] = convertedValue;
              mappedFields.push(\`"\${bestCsvHeader}" → \${targetColStr} (\${column.type})\`);
            }
          } catch (error) {
            conversionErrors.push(\`\${targetColStr}: \${error.message}\`);
            console.warn(\`⚠️  \${tableName}: Conversion error for \${targetColStr}: \${error.message}\`);
          }
        } else {
          // Check if column is nullable or has default
          if (!column.nullable && !column.defaultValue) {
            console.warn(\`⚠️  \${tableName}: Required column \${targetColStr} has no matching CSV data\`);
          }
        }
      } catch (error) {
        console.error(\`❌ \${tableName}: Error processing column \${targetColStr || 'unknown'}: \${error.message}\`);
      }
    });
    
    // Log unmapped CSV fields with enhanced safety
    csvHeaders.forEach(csvHeader => {
      try {
        // Enhanced null/undefined checks for csvHeader
        if (csvHeader == null || csvHeader === undefined) {
          console.warn(\`⚠️ \${tableName}: Encountered null/undefined CSV header, skipping\`);
          return;
        }
        
        // Ensure csvHeader is a valid string
        const csvHeaderStr = String(csvHeader || '').trim();
        if (!csvHeaderStr || csvHeaderStr.length === 0) {
          console.warn(\`⚠️ \${tableName}: Empty CSV header name, skipping\`);
          return;
        }
        
        const normalizedHeader = normalizeColumnName(csvHeaderStr);
        const isSystemField = ['id', 'created_at', 'updated_at'].includes(normalizedHeader);
        const isMapped = mappedFields.some(field => 
          field && typeof field === 'string' && field.includes(\`"\${csvHeaderStr}"\`)
        );
        
        if (!isSystemField && !isMapped) {
          skippedFields.push(csvHeaderStr);
        }
      } catch (error) {
        console.warn(\`⚠️ \${tableName}: Error checking CSV header \${csvHeader}: \${error.message}\`);
      }
    });
    
    console.log(\`🎯 \${tableName}: Mapping complete\`);
    console.log(\`   ✅ Mapped (\${mappedFields.length}): \${mappedFields.slice(0, 3).join(', ')}\${mappedFields.length > 3 ? '...' : ''}\`);
    
    if (skippedFields.length > 0) {
      console.log(\`   ⏭️  Skipped (\${skippedFields.length}): \${skippedFields.slice(0, 3).join(', ')}\${skippedFields.length > 3 ? '...' : ''}\`);
    }
    
    if (conversionErrors.length > 0) {
      console.log(\`   ⚠️  Conversion errors (\${conversionErrors.length}): \${conversionErrors.slice(0, 2).join(', ')}\`);
    }
    
    // Check if we have any meaningful data mapped
    const meaningfulFieldCount = mappedFields.length;
    if (meaningfulFieldCount === 0) {
      console.warn(\`⚠️  \${tableName}: No meaningful data could be mapped from CSV\`);
      return null;
    }
    
    return mapped;
    
  } catch (error) {
    console.error(\`❌ \${tableName}: Fatal mapping error: \${error.message}\`);
    return null;
  }
};`,

    relationshipResolvers: `
// Global session cache for cross-table FK resolution
const SESSION_FK_CACHE = {
  propertyAddressToId: new Map(), // address -> property_id mappings
  permitAddressToId: new Map(),   // address -> permit_id mappings
  insertedRecords: new Map(),     // table -> records mappings
  
  // Store inserted records for FK resolution
  storeInsertedRecords(tableName, records) {
    if (!records || !Array.isArray(records)) return;
    
    console.log(\`📋 Storing \${records.length} inserted \${tableName} records for FK resolution\`);
    
    if (tableName === 'properties') {
      records.forEach(record => {
        if (record.id && record.street_address) {
          const addressKey = [
            record.street_address || '',
            record.city || '',
            record.state || '',
            record.zip_code || ''
          ].join('|').toLowerCase().trim();
          
          if (addressKey && addressKey !== '|||') {
            this.propertyAddressToId.set(addressKey, record.id);
            console.log(\`🏠 Cached property: \${addressKey} -> \${record.id}\`);
          }
        }
      });
      console.log(\`✅ Property cache now has \${this.propertyAddressToId.size} entries\`);
    }
    
    if (tableName === 'permits') {
      records.forEach(record => {
        if (record.id && record.property_id) {
          // For permits, we can use the property address to create permit mappings
          const propertyId = record.property_id;
          
          // Find the address key for this property
          for (const [addressKey, propId] of this.propertyAddressToId.entries()) {
            if (propId === propertyId) {
              this.permitAddressToId.set(addressKey, record.id);
              console.log(\`🏗️  Cached permit: \${addressKey} -> \${record.id}\`);
              break;
            }
          }
        }
      });
      console.log(\`✅ Permit cache now has \${this.permitAddressToId.size} entries\`);
    }
    
    // Store all records for general lookup
    if (!this.insertedRecords.has(tableName)) {
      this.insertedRecords.set(tableName, []);
    }
    this.insertedRecords.get(tableName).push(...records);
  },
  
  // Resolve FK using cached data
  resolveForeignKey(value, targetTable, sourceColumn) {
    if (!value || value === '') return null;
    
    // Handle property_id resolution
    if (sourceColumn === 'property_id' && targetTable === 'properties') {
      const resolvedId = this.propertyAddressToId.get(value);
      if (resolvedId) {
        console.log(\`🔗 Resolved property FK: \${value} -> \${resolvedId}\`);
        return resolvedId;
      } else {
        console.warn(\`⚠️  Property address not found in cache: \${value}\`);
        console.warn(\`🔍 Available addresses: \${Array.from(this.propertyAddressToId.keys()).slice(0, 3).join(', ')}\`);
        return null;
      }
    }
    
    // Handle permit_id resolution
    if (sourceColumn === 'permit_id' && targetTable === 'permits') {
      const resolvedId = this.permitAddressToId.get(value);
      if (resolvedId) {
        console.log(\`🔗 Resolved permit FK: \${value} -> \${resolvedId}\`);
        return resolvedId;
      } else {
        console.warn(\`⚠️  Permit address not found in cache: \${value}\`);
        return null;
      }
    }
    
    // For other FKs, check if it's already a valid UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3}-[0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      return value;
    }
    
    console.warn(\`⚠️  Could not resolve FK: \${sourceColumn} -> \${targetTable} with value: \${value}\`);
    return null;
  }
};

// Main foreign key resolution function
const resolveForeignKeys = async (data, tableName, supabaseClient) => {
  console.log(\`🔗 \${tableName}: Resolving foreign keys for \${data.length} rows...\`);
  
  const tableSchema = SCHEMA_CONFIG.tables.find(t => t.name === tableName);
  if (!tableSchema) {
    console.log(\`⏭️  \${tableName}: No schema found\`);
    return data;
  }
  
  // Find foreign key columns
  const foreignKeys = tableSchema.columns.filter(col => 
    col.constraints && col.constraints.some(c => c.type === 'FOREIGN KEY')
  );
  
  if (foreignKeys.length === 0) {
    console.log(\`⏭️  \${tableName}: No foreign keys to resolve\`);
    return data;
  }
  
  const resolvedData = [];
  const errors = [];
  
  console.log(\`🔍 \${tableName}: Found \${foreignKeys.length} FK columns: \${foreignKeys.map(fk => fk.name).join(', ')}\`);
  
  for (const row of data) {
    // Safety check for row validity
    if (!row || typeof row !== 'object') {
      console.warn(\`⚠️ \${tableName}: Invalid row data in FK resolution, skipping\`);
      continue;
    }
    
    const resolvedRow = { ...row };
    let hasErrors = false;
    
    // Resolve each foreign key in this row
    for (const fkColumn of foreignKeys) {
      const originalValue = row[fkColumn.name];
      
      if (originalValue != null && originalValue !== '') {
        try {
          const constraint = fkColumn.constraints.find(c => c.type === 'FOREIGN KEY');
          const targetTable = constraint?.referencedTable || 'unknown';
          
          const resolvedValue = SESSION_FK_CACHE.resolveForeignKey(
            originalValue, 
            targetTable, 
            fkColumn.name
          );
          
          if (resolvedValue) {
            resolvedRow[fkColumn.name] = resolvedValue;
          } else {
            console.warn(\`⚠️  \${tableName}: Could not resolve FK \${fkColumn.name}="\${originalValue}" -> \${targetTable}\`);
            
            // Check if the column is nullable
            if (fkColumn.nullable) {
              resolvedRow[fkColumn.name] = null; // Set to null if nullable
            } else {
              hasErrors = true;
              errors.push(\`Required FK \${fkColumn.name}="\${originalValue}" could not be resolved\`);
            }
          }
        } catch (error) {
          console.error(\`❌ \${tableName}: FK resolution error for \${fkColumn.name}:\`, error.message);
          hasErrors = true;
          errors.push(\`FK resolution error: \${error.message}\`);
        }
      }
    }
    
    if (!hasErrors) {
      resolvedData.push(resolvedRow);
    }
  }
  
  if (errors.length > 0) {
    console.warn(\`⚠️  \${tableName}: \${errors.length} FK resolution errors (showing first 3):\`);
    errors.slice(0, 3).forEach(error => console.warn(\`   - \${error}\`));
  }
  
  console.log(\`✅ \${tableName}: FK resolution complete - \${resolvedData.length}/\${data.length} rows resolved\`);
  
  // Final safety check - ensure all returned data is valid
  const validResolvedData = resolvedData.filter(row => row && typeof row === 'object');
  
  if (validResolvedData.length !== resolvedData.length) {
    console.warn(\`⚠️ \${tableName}: Filtered out \${resolvedData.length - validResolvedData.length} invalid rows from FK resolution\`);
  }
  
  return validResolvedData;
};`,

    validationRules: `
// Advanced Schema-Aware Validation
const validateRowForTable = (row, tableName) => {
  const errors = [];
  const warnings = [];
  
  if (!row || typeof row !== 'object') {
    errors.push('Row is not a valid object');
    return { isValid: false, errors, warnings };
  }
  
  const tableSchema = SCHEMA_CONFIG.tables.find(t => t.name === tableName);
  
  if (!tableSchema) {
    warnings.push(\`Unknown table schema for \${tableName}\`);
    return { isValid: true, errors, warnings }; // Allow unknown tables
  }
  
  // Check required fields
  const requiredColumns = tableSchema.columns.filter(col => 
    !col.nullable && 
    !col.defaultValue &&
    !['id', 'created_at', 'updated_at'].includes(col.name)
  );
  
  requiredColumns.forEach(col => {
    const value = row[col.name];
    if (value == null || value === '') {
      errors.push(\`Required field '\${col.name}' is missing or empty\`);
    }
  });
  
  // Validate data types and constraints
  Object.keys(row).forEach(fieldName => {
    const column = tableSchema.columns.find(c => c.name === fieldName);
    if (!column) return; // Skip unknown fields
    
    const value = row[fieldName];
    if (value == null || value === '') return; // Skip empty values
    
    // Type-specific validation
    try {
      switch (column.type.toLowerCase()) {
        case 'text':
        case 'uuid':
          // For ID fields, check UUID format
          if (fieldName === 'id' || fieldName.endsWith('_id')) {
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3}-[0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
              warnings.push(\`Field '\${fieldName}' should be a valid UUID format\`);
            }
          }
          break;
          
        case 'smallint':
          const smallInt = parseInt(value, 10);
          if (isNaN(smallInt) || smallInt < -32768 || smallInt > 32767) {
            errors.push(\`Field '\${fieldName}' must be a valid smallint (-32768 to 32767)\`);
          }
          break;
          
        case 'integer':
          const int = parseInt(value, 10);
          if (isNaN(int) || int < -2147483648 || int > 2147483647) {
            errors.push(\`Field '\${fieldName}' must be a valid integer\`);
          }
          break;
          
        case 'varchar':
          if (column.length && String(value).length > column.length) {
            errors.push(\`Field '\${fieldName}' exceeds maximum length of \${column.length}\`);
          }
          break;
          
        case 'boolean':
          const boolStr = String(value).toLowerCase();
          if (!['true', 'false', '1', '0', 'yes', 'no', 'y', 'n', 'on', 'off'].includes(boolStr)) {
            warnings.push(\`Field '\${fieldName}' may not be a valid boolean value\`);
          }
          break;
          
        case 'timestamp':
        case 'timestamptz':
        case 'date':
          if (isNaN(new Date(value).getTime())) {
            errors.push(\`Field '\${fieldName}' must be a valid date/timestamp\`);
          }
          break;
          
        case 'jsonb':
        case 'json':
          if (typeof value === 'string' && value.startsWith('{')) {
            try {
              JSON.parse(value);
            } catch {
              errors.push(\`Field '\${fieldName}' contains invalid JSON\`);
            }
          }
          break;
      }
    } catch (error) {
      warnings.push(\`Validation error for \${fieldName}: \${error.message}\`);
    }
  });
  
  // Check if row has meaningful data (beyond system fields)
  const meaningfulFields = Object.keys(row).filter(key => 
    !['id', 'created_at', 'updated_at', '_addressKey'].includes(key) &&
    row[key] != null && 
    row[key] !== ''
  );
  
  if (meaningfulFields.length === 0) {
    errors.push('Row contains no meaningful data fields');
  }
  
  return { 
    isValid: errors.length === 0, 
    errors, 
    warnings 
  };
};

const validateBatch = (batch, tableName) => {
  const validRows = [];
  const invalidRows = [];
  const allWarnings = [];
  
  console.log(\`📋 \${tableName}: Validating \${batch.length} rows...\`);
  
  batch.forEach((row, index) => {
    const validation = validateRowForTable(row, tableName);
    
    if (validation.isValid) {
      validRows.push(row);
      if (validation.warnings.length > 0) {
        allWarnings.push(...validation.warnings.map(w => \`Row \${index}: \${w}\`));
      }
    } else {
      invalidRows.push({ 
        row, 
        errors: validation.errors, 
        warnings: validation.warnings,
        index 
      });
    }
  });
  
  // Log validation summary
  console.log(\`📊 \${tableName}: \${validRows.length} valid, \${invalidRows.length} invalid rows\`);
  
  if (allWarnings.length > 0 && allWarnings.length <= 10) {
    console.log(\`⚠️  \${tableName}: \${allWarnings.length} validation warnings:\`);
    allWarnings.slice(0, 5).forEach(warning => console.warn(\`   - \${warning}\`));
    if (allWarnings.length > 5) {
      console.warn(\`   ... and \${allWarnings.length - 5} more warnings\`);
    }
  }
  
  if (invalidRows.length > 0) {
    console.error(\`❌ \${tableName}: \${invalidRows.length} validation errors (showing first 3):\`);
    invalidRows.slice(0, 3).forEach(invalid => {
      console.error(\`   Row \${invalid.index}: \${invalid.errors.join(', ')}\`);
    });
  }
  
  if (validRows.length > 0) {
    const sampleRow = validRows[0];
    const sampleFields = Object.keys(sampleRow)
      .filter(key => !['id', 'created_at', 'updated_at', '_addressKey'].includes(key))
      .slice(0, 3);
    
    if (sampleFields.length > 0) {
      console.log(\`🔍 \${tableName}: Sample valid row fields: \${sampleFields.join(', ')}\`);
    }
  }
  
  return { 
    validRows, 
    invalidRows: invalidRows.map(invalid => ({
      ...invalid.row,
      _validationErrors: invalid.errors,
      _validationWarnings: invalid.warnings
    }))
  };
};`,
  };
}