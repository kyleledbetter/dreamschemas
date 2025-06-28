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

console.log('\ud83e\uddee AI Schema Analysis:', SCHEMA_CONFIG.tableAnalysis);`,

    tableProcessors: `
// Advanced AI-Schema-Aware Table Processing

// String similarity functions for intelligent column matching
const calculateStringSimilarity = (str1, str2) => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  if (longer.length === 0) return 1.0;
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

const levenshteinDistance = (str1, str2) => {
  const matrix = Array(str2.length + 1).fill().map(() => Array(str1.length + 1).fill(0));
  for (let i = 0; i <= str2.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      matrix[i][j] = str2[i-1] === str1[j-1] ? matrix[i-1][j-1] : 
        Math.min(matrix[i-1][j-1], matrix[i][j-1], matrix[i-1][j]) + 1;
    }
  }
  return matrix[str2.length][str1.length];
};

const normalizeColumnName = (name) => name?.toLowerCase().trim().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || '';

// Advanced column matching using AI schema information
const findBestColumnMatch = (csvHeader, targetColumns, tableType) => {
  try {
    if (!csvHeader || !targetColumns?.length) return null;
    
    // Ensure csvHeader is a string
    const headerStr = String(csvHeader).trim();
    if (!headerStr) return null;
    
    const normalizedCsv = normalizeColumnName(headerStr);
    if (!normalizedCsv) return null;
    
    // Exact match first
    const exactMatch = targetColumns.find(col => {
      try {
        return normalizeColumnName(String(col)) === normalizedCsv;
      } catch {
        return false;
      }
    });
    if (exactMatch) return exactMatch;
    
    // Fuzzy matching with table-type-aware scoring
    let bestMatch = null;
    let bestScore = 0;
    const threshold = tableType === 'lookup' ? 0.4 : 0.6; // Even lower threshold for lookup tables
    
    targetColumns.forEach(dbColumn => {
      try {
        const normalizedDb = normalizeColumnName(String(dbColumn));
        if (!normalizedDb) return;
        
        const score = calculateStringSimilarity(normalizedCsv, normalizedDb);
        if (score > bestScore && score >= threshold) {
          bestScore = score;
          bestMatch = dbColumn;
        }
      } catch (error) {
        console.warn(\`Column matching error for \${dbColumn}: \${error.message}\`);
      }
    });
    
    return bestMatch;
  } catch (error) {
    console.error(\`findBestColumnMatch error: \${error.message}\`);
    return null;
  }
};

// Build dependency-aware table processing order
const buildTableProcessingOrder = () => {
  const tables = SCHEMA_CONFIG.tableAnalysis;
  const sorted = [];
  const visited = new Set();
  const visiting = new Set();
  
  const visit = (tableName) => {
    if (visiting.has(tableName)) return; // Circular dependency
    if (visited.has(tableName)) return;
    
    visiting.add(tableName);
    visited.add(tableName);
    
    // Visit dependencies first (tables this table references)
    const tableInfo = tables.find(t => t.name === tableName);
    if (tableInfo?.foreignKeys) {
      tableInfo.foreignKeys.forEach(fk => {
        if (!fk.targetTable.startsWith('auth.') && tables.find(t => t.name === fk.targetTable)) {
          visit(fk.targetTable);
        }
      });
    }
    
    visiting.delete(tableName);
    sorted.push(tableName);
  };
  
  // Process lookup tables first, then data tables, then junction tables
  const lookupTables = tables.filter(t => t.type === 'lookup').map(t => t.name);
  const dataTables = tables.filter(t => t.type === 'data').map(t => t.name);
  const junctionTables = tables.filter(t => t.type === 'junction').map(t => t.name);
  
  [...lookupTables, ...dataTables, ...junctionTables].forEach(visit);
  
  return sorted;
};

const TABLE_PROCESSING_ORDER = buildTableProcessingOrder();
console.log('\ud83c\udfd7\ufe0f Advanced Table Processing Order:', TABLE_PROCESSING_ORDER);

// AI-Schema-Aware data filtering for each table type
const filterDataForTable = (data, tableName) => {
  console.log(\`\ud83d\udccb Filtering \${data.length} rows for \${tableName}...\`);
  
  const tableInfo = SCHEMA_CONFIG.tableAnalysis.find(t => t.name === tableName);
  if (!tableInfo) {
    console.warn(\`\u26a0\ufe0f  Unknown table: \${tableName}\`);
    return [];
  }
  
  console.log(\`\ud83d\udd0d \${tableName}: Detected as \${tableInfo.type} table\`);
  
  if (tableInfo.type === 'lookup') {
    return filterDataForLookupTable(data, tableInfo);
  } else if (tableInfo.type === 'junction') {
    return filterDataForJunctionTable(data, tableInfo);
  } else {
    return filterDataForDataTable(data, tableInfo);
  }
};

const filterDataForLookupTable = (data, tableInfo) => {
  console.log(\`\ud83c\udff7\ufe0f  \${tableInfo.name}: Processing lookup table for \${tableInfo.nonSystemColumns.join(', ')}\`);
  
  const csvHeaders = data.length > 0 ? Object.keys(data[0]) : [];
  
  if (csvHeaders.length === 0) {
    console.warn(\`\u26a0\ufe0f  \${tableInfo.name}: No CSV data available for lookup table\`);
    return [];
  }
  
  console.log(\`\ud83d\udccb \${tableInfo.name}: Available CSV headers: \${csvHeaders.join(', ')}\`);
  console.log(\`\ud83c\udfaf \${tableInfo.name}: Target columns: \${tableInfo.nonSystemColumns.join(', ')}\`);
  
  // For lookup tables, we need to extract unique values for the lookup column
  const targetColumn = tableInfo.nonSystemColumns[0] || 'name';
  
  // SEMANTIC COLUMN MATCHING: Find CSV columns that semantically match this table
  const tableName = tableInfo.name.toLowerCase();
  const matchingColumns = findSemanticColumnMatches(tableName, csvHeaders);
  
  console.log(\`\ud83e\udd16 \${tableInfo.name}: Semantic matching results:\`);
  if (matchingColumns.length > 0) {
    matchingColumns.slice(0, 3).forEach((match, idx) => {
      console.log(\`   \${idx + 1}. '\${match.header}' (score: \${match.score.toFixed(2)})\`);
    });
  } else {
    console.log(\`   No matches found above threshold (0.3)\`);
  }
  
  if (matchingColumns.length === 0) {
    console.warn(\`\u26a0\ufe0f  \${tableInfo.name}: No semantically matching columns found\`);
    console.log(\`\ud83d\udccb Available CSV headers: \${csvHeaders.join(', ')}\`);
    return [];
  }
  
  const bestSourceColumn = matchingColumns[0].header;
  console.log(\`\ud83c\udfaf \${tableInfo.name}: Selected '\${bestSourceColumn}' (score: \${matchingColumns[0].score.toFixed(2)}) as source for '\${targetColumn}'\`);
  
  // Extract ALL unique non-empty values from the source column
  console.log(\`\ud83d\udd0d \${tableInfo.name}: Extracting values from column '\${bestSourceColumn}'\`);
  console.log(\`\ud83d\udccb \${tableInfo.name}: Sample raw values: \${data.slice(0, 3).map(row => row[bestSourceColumn]).join(', ')}\`);
  
  const allValues = data
    .map(row => row[bestSourceColumn])
    .filter(val => val != null && val !== '' && String(val).trim() !== '')
    .map(val => String(val).trim());
  
  const uniqueValues = [...new Set(allValues)];
  
  console.log(\`\ud83d\udccb \${tableInfo.name}: Found \${allValues.length} total values, \${uniqueValues.length} unique values\`);
  console.log(\`\ud83d\udd0d \${tableInfo.name}: Unique values: \${uniqueValues.slice(0, 10).join(', ')}\${uniqueValues.length > 10 ? '...' : ''}\`);
  
  if (uniqueValues.length === 0) {
    console.warn(\`\u26a0\ufe0f  \${tableInfo.name}: No valid values found in column '\${bestSourceColumn}'\`);
    return [];
  }
  
  // Create lookup table records
  const lookupRecords = uniqueValues.map(value => ({ [targetColumn]: value }));
  
  console.log(\`\u2705 \${tableInfo.name}: Generated \${lookupRecords.length} lookup records from '\${bestSourceColumn}'\`);
  return lookupRecords;
};

// NEW: Semantic column matching function
const findSemanticColumnMatches = (tableName, csvHeaders) => {
  const matches = [];
  
  csvHeaders.forEach(header => {
    const score = calculateSemanticSimilarity(tableName, header);
    if (score > 0) {
      matches.push({ header, score });
    }
  });
  
  // Sort by score descending and return matches above threshold
  return matches
    .sort((a, b) => b.score - a.score)
    .filter(match => match.score >= 0.3); // Minimum similarity threshold
};

// NEW: Calculate semantic similarity between table name and CSV column
const calculateSemanticSimilarity = (tableName, csvHeader) => {
  const table = tableName.toLowerCase();
  const header = csvHeader.toLowerCase();
  
  let score = 0;
  
  // EXACT MATCHES - Highest priority
  if (header === table || header === table.replace(/s$/, '')) {
    score += 10; // Exact match
  }
  
  // DIRECT SEMANTIC MATCHES - High priority with more specific mappings
  const semanticMappings = {
    'builders': ['builder', 'builders', 'contractor', 'developer', 'construction_company'],
    'business_names': ['business_name', 'business', 'company', 'firm', 'corp', 'organization', 'contractor'],
    'jurisdictions': ['permit_jurisdiction', 'jurisdiction', 'county', 'city', 'municipality', 'district'],
    'permit_types': ['type', 'permit_type'],  // When table is permit_types, 'type' should match
    'permit_subtypes': ['subtype', 'permit_subtype'], // When table is permit_subtypes, 'subtype' should match  
    'permit_statuses': ['status', 'initial_status', 'latest_status', 'permit_status'],
    'project_types': ['project_type'], // When table is project_types, 'project_type' should match
    'loan_types': ['loantype', 'loan_type'],
    'transaction_types': ['transactiontype', 'transaction_type'],
    'product_classes': ['productclass', 'product_class'],
    'product_types': ['producttype', 'product_type'],
    
    // NEW: Special mappings for permits table - it should NOT directly match lookup columns
    // Instead, permits table will map these via foreign keys during column mapping
    'permits': ['permit', 'permit_number', 'permit_id']
  };
  
  // Check if this table has specific semantic mappings
  const tableKey = table.replace(/s$/, ''); // Remove plural
  if (semanticMappings[table] || semanticMappings[tableKey]) {
    const keywords = semanticMappings[table] || semanticMappings[tableKey];
    keywords.forEach(keyword => {
      if (header.includes(keyword)) {
        score += 5; // Strong semantic match
      }
    });
  }
  
  // SUBSTRING MATCHES - Medium priority  
  if (header.includes(table.replace(/s$/, ''))) {
    score += 3; // Table name appears in header
  }
  
  if (table.replace(/s$/, '').includes(header.replace(/s$/, ''))) {
    score += 2; // Header appears in table name
  }
  
  // PARTIAL WORD MATCHES - Lower priority
  const tableWords = table.split('_');
  const headerWords = header.split(/[_\\s]+/);
  
  tableWords.forEach(tableWord => {
    headerWords.forEach(headerWord => {
      if (tableWord === headerWord) {
        score += 1.5; // Exact word match
      } else if (tableWord.length > 3 && headerWord.length > 3) {
        const similarity = calculateStringSimilarity(tableWord, headerWord);
        if (similarity > 0.7) {
          score += similarity; // Fuzzy word match
        }
      }
    });
  });
  
  // PATTERN BONUSES
  if (table.includes('type') && header.includes('type')) {
    score += 2;
  }
  
  if (table.includes('name') && header.includes('name')) {
    score += 2;
  }
  
  // PENALTY for generic terms when we need specific matches
  if (score <= 1 && (header.includes('name') || header.includes('type') || header.includes('id'))) {
    score = 0; // Don't match generic columns to specific tables
  }
  
  return score;
};

// NEW: Find CSV column that should be mapped to a foreign key via lookup table
const findForeignKeySourceColumn = (lookupTableName, csvHeaders) => {
  // Use the existing semantic matching logic to find the best CSV column
  // for the lookup table, which becomes the source for the foreign key
  const matches = [];
  
  csvHeaders.forEach(header => {
    const score = calculateSemanticSimilarity(lookupTableName, header);
    if (score > 0) {
      matches.push({ header, score });
    }
  });
  
  // Sort by score and return the best match if above threshold
  const sortedMatches = matches
    .sort((a, b) => b.score - a.score)
    .filter(match => match.score >= 0.3);
    
  return sortedMatches.length > 0 ? sortedMatches[0].header : null;
};

const filterDataForDataTable = (data, tableInfo) => {
  // For data tables, include all rows but we'll filter columns during mapping
  const filtered = data.filter(row => row && typeof row === 'object');
  console.log(\`\ud83d\udcca \${tableInfo.name}: \${filtered.length} data rows\`);
  return filtered;
};

const filterDataForJunctionTable = (data, tableInfo) => {
  // Junction tables are typically populated based on relationships in the data
  // For now, treat them like data tables
  return filterDataForDataTable(data, tableInfo);
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
  const tableInfo = SCHEMA_CONFIG.tableAnalysis.find(t => t.name === tableName);
  return tableInfo ? tableInfo.nonSystemColumns : [];
};

// Advanced type-aware value conversion
const convertValue = (value, column) => {
  if (value == null || value === '') return null;
  
  const str = String(value).trim();
  const type = column.type.toLowerCase();
  
  try {
    switch (type) {
      case 'uuid':
        // Validate UUID format or generate new one
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str) 
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
    console.warn(\`\u26a0\ufe0f  Value conversion failed for \${column.name} (\${type}): \${error.message}\`);
    return null;
  }
};

// Advanced schema-aware CSV to table mapping
const mapCSVToTableColumns = (csvRow, tableName) => {
  try {
    console.log(\`\ud83d\udd04 \${tableName}: AI-schema-aware mapping...\`);
    
    if (!csvRow || typeof csvRow !== 'object') {
      console.error(\`\u274c \${tableName}: Invalid CSV row data\`);
      return null;
    }
    
    const tableSchema = getTableSchema(tableName);
    const tableInfo = SCHEMA_CONFIG.tableAnalysis.find(t => t.name === tableName);
    
    if (!tableSchema || !tableInfo) {
      console.error(\`\u274c \${tableName}: Schema not found\`);
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
    
    // Get target columns for this table
    const targetColumns = getTableColumns(tableName);
    const csvHeaders = Object.keys(csvRow).filter(key => key != null);
    
    console.log(\`\ud83d\udccb \${tableName}: Mapping \${csvHeaders.length} CSV fields to \${targetColumns.length} target columns\`);
    
    // Map each target column to best CSV field
    targetColumns.forEach(targetCol => {
      try {
        const column = tableSchema.columns.find(c => c.name === targetCol);
        if (!column) return;
        
        let bestCsvHeader = null;
        let isFromForeignKeyMapping = false;
        
        // SPECIAL HANDLING for foreign key columns (ending in _id)
        if (targetCol.endsWith('_id') && tableInfo.type === 'data') {
          const lookupTableName = targetCol.replace('_id', 's'); // business_name_id -> business_names
          bestCsvHeader = findForeignKeySourceColumn(lookupTableName, csvHeaders);
          isFromForeignKeyMapping = !!bestCsvHeader;
          
          if (bestCsvHeader) {
            console.log(\`🔗 \${tableName}: Foreign key mapping: "\${bestCsvHeader}" → \${targetCol} (via \${lookupTableName})\`);
          }
        }
        
        // If no foreign key mapping found, use regular column matching
        if (!bestCsvHeader) {
          bestCsvHeader = findBestColumnMatch(targetCol, csvHeaders, tableInfo.type);
        }
        
        if (bestCsvHeader && csvRow[bestCsvHeader] != null && csvRow[bestCsvHeader] !== '') {
          try {
            let convertedValue;
            
            if (isFromForeignKeyMapping) {
              // For foreign keys, store the original value - it will be resolved later
              convertedValue = String(csvRow[bestCsvHeader]).trim();
              console.log(\`🔑 \${tableName}: Storing FK reference value: \${convertedValue} for \${targetCol}\`);
            } else {
              convertedValue = convertValue(csvRow[bestCsvHeader], column);
            }
            
            if (convertedValue !== null && convertedValue !== undefined) {
              mapped[targetCol] = convertedValue;
              mappedFields.push(\`"\${bestCsvHeader}" → \${targetCol} (\${column.type})\${isFromForeignKeyMapping ? ' [FK]' : ''}\`);
            }
          } catch (error) {
            conversionErrors.push(\`\${targetCol}: \${error.message}\`);
            console.warn(\`\u26a0\ufe0f  \${tableName}: Conversion error for \${targetCol}: \${error.message}\`);
          }
        } else {
          // Check if column is nullable or has default
          if (!column.nullable && !column.defaultValue) {
            console.warn(\`\u26a0\ufe0f  \${tableName}: Required column \${targetCol} has no matching CSV data\`);
          }
        }
      } catch (error) {
        console.error(\`\u274c \${tableName}: Error processing column \${targetCol}: \${error.message}\`);
      }
    });
    
    // Log unmapped CSV fields
    csvHeaders.forEach(csvHeader => {
      try {
        const isSystemField = ['id', 'created_at', 'updated_at'].includes(normalizeColumnName(csvHeader));
        const isMapped = mappedFields.some(field => field.includes(\`"\${csvHeader}"\`));
        
        if (!isSystemField && !isMapped) {
          skippedFields.push(csvHeader);
        }
      } catch (error) {
        console.warn(\`\u26a0\ufe0f  Error checking CSV header \${csvHeader}: \${error.message}\`);
      }
    });
    
    console.log(\`\ud83c\udfaf \${tableName}: Mapping complete\`);
    console.log(\`   \u2705 Mapped (\${mappedFields.length}): \${mappedFields.slice(0, 3).join(', ')}\${mappedFields.length > 3 ? '...' : ''}\`);
    
    if (skippedFields.length > 0) {
      console.log(\`   \u23ed\ufe0f  Skipped (\${skippedFields.length}): \${skippedFields.slice(0, 3).join(', ')}\${skippedFields.length > 3 ? '...' : ''}\`);
    }
    
    if (conversionErrors.length > 0) {
      console.log(\`   \u26a0\ufe0f  Conversion errors (\${conversionErrors.length}): \${conversionErrors.slice(0, 2).join(', ')}\`);
    }
    
    // Check if we have any meaningful data mapped
    const meaningfulFieldCount = mappedFields.length;
    if (meaningfulFieldCount === 0) {
      console.warn(\`\u26a0\ufe0f  \${tableName}: No meaningful data could be mapped from CSV\`);
      return null;
    }
    
    return mapped;
    
  } catch (error) {
    console.error(\`\u274c \${tableName}: Fatal mapping error: \${error.message}\`);
    return null;
  }
};`,

    relationshipResolvers: `
// Advanced Foreign Key Resolution System
class AdvancedForeignKeyResolver {
  constructor(supabaseClient) {
    this.client = supabaseClient;
    this.cache = new Map(); // Cache FK lookups for performance
    this.lookupMaps = new Map(); // Cache complete lookup tables
  }
  
  // Pre-load lookup table data for fast FK resolution
  async preloadLookupTable(tableName) {
    if (this.lookupMaps.has(tableName)) return;
    
    console.log(\`\ud83d\udccb Pre-loading lookup table: \${tableName}\`);
    
    try {
      const { data, error } = await this.client
        .from(tableName)
        .select('id, name')
        .limit(1000);
      
      if (error) {
        console.warn(\`\u26a0\ufe0f  Failed to preload \${tableName}: \${error.message}\`);
        this.lookupMaps.set(tableName, new Map());
        return;
      }
      
      const lookupMap = new Map();
      data?.forEach(row => {
        // Map both name->id and id->id for flexible lookup
        if (row.name) lookupMap.set(row.name.toLowerCase().trim(), row.id);
        lookupMap.set(row.id, row.id);
      });
      
      this.lookupMaps.set(tableName, lookupMap);
      console.log(\`\u2705 Loaded \${lookupMap.size} entries for \${tableName}\`);
      
    } catch (error) {
      console.error(\`\u274c Failed to preload \${tableName}:\`, error.message);
      this.lookupMaps.set(tableName, new Map());
    }
  }
  
  // Resolve a foreign key value
  async resolveForeignKey(value, targetTable, sourceColumn) {
    if (!value || value === '') return null;
    
    const cacheKey = \`\${targetTable}:\${value}\`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    let resolvedId = null;
    
    try {
      // Handle special Supabase auth users table
      if (targetTable === 'auth.users') {
        // For auth.users, we'll pass through the value assuming it's a valid user_id
        // In production, you might want to validate this
        resolvedId = value;
      } else {
        // For lookup tables, try to resolve by name or id
        await this.preloadLookupTable(targetTable);
        const lookupMap = this.lookupMaps.get(targetTable);
        
        if (lookupMap) {
          // First try exact ID match
          if (lookupMap.has(value)) {
            resolvedId = lookupMap.get(value);
          } else {
            // Try name-based lookup (case-insensitive)
            const normalizedValue = String(value).toLowerCase().trim();
            resolvedId = lookupMap.get(normalizedValue);
          }
        }
        
        // If still not found and it looks like a UUID, pass it through
        if (!resolvedId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3}-[0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
          resolvedId = value;
        }
      }
      
      this.cache.set(cacheKey, resolvedId);
      return resolvedId;
      
    } catch (error) {
      console.warn(\`\u26a0\ufe0f  FK resolution failed for \${sourceColumn} -> \${targetTable}: \${error.message}\`);
      return null;
    }
  }
}

// Main foreign key resolution function
const resolveForeignKeys = async (data, tableName, supabaseClient) => {
  console.log(\`\ud83d\udd17 \${tableName}: Resolving foreign keys for \${data.length} rows...\`);
  
  const tableInfo = SCHEMA_CONFIG.tableAnalysis.find(t => t.name === tableName);
  if (!tableInfo || !tableInfo.foreignKeys.length) {
    console.log(\`\u23ed\ufe0f  \${tableName}: No foreign keys to resolve\`);
    return data;
  }
  
  const resolver = new AdvancedForeignKeyResolver(supabaseClient);
  const resolvedData = [];
  const errors = [];
  
  console.log(\`\ud83d\udd0d \${tableName}: Found \${tableInfo.foreignKeys.length} FK columns: \${tableInfo.foreignKeys.map(fk => fk.column).join(', ')}\`);
  
  // Pre-load all referenced lookup tables
  const referencedTables = [...new Set(tableInfo.foreignKeys.map(fk => fk.targetTable))];
  await Promise.all(
    referencedTables
      .filter(table => !table.startsWith('auth.'))
      .map(table => resolver.preloadLookupTable(table))
  );
  
  for (const row of data) {
    const resolvedRow = { ...row };
    let hasErrors = false;
    
    // Resolve each foreign key in this row
    for (const fk of tableInfo.foreignKeys) {
      const originalValue = row[fk.column];
      
      if (originalValue != null && originalValue !== '') {
        try {
          const resolvedValue = await resolver.resolveForeignKey(
            originalValue, 
            fk.targetTable, 
            fk.column
          );
          
          if (resolvedValue) {
            resolvedRow[fk.column] = resolvedValue;
          } else {
            console.warn(\`\u26a0\ufe0f  \${tableName}: Could not resolve FK \${fk.column}="\${originalValue}" -> \${fk.targetTable}\`);
            
            // Check if the column is nullable
            const tableSchema = SCHEMA_CONFIG.tables.find(t => t.name === tableName);
            const column = tableSchema?.columns.find(c => c.name === fk.column);
            
            if (column?.nullable) {
              resolvedRow[fk.column] = null; // Set to null if nullable
            } else {
              hasErrors = true;
              errors.push(\`Required FK \${fk.column}="\${originalValue}" could not be resolved\`);
            }
          }
        } catch (error) {
          console.error(\`\u274c \${tableName}: FK resolution error for \${fk.column}:\`, error.message);
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
    console.warn(\`\u26a0\ufe0f  \${tableName}: \${errors.length} FK resolution errors (showing first 3):\`);
    errors.slice(0, 3).forEach(error => console.warn(\`   - \${error}\`));
  }
  
  console.log(\`\u2705 \${tableName}: FK resolution complete - \${resolvedData.length}/\${data.length} rows resolved\`);
  
  if (resolvedData.length > 0 && tableInfo.foreignKeys.length > 0) {
    const sampleRow = resolvedData[0];
    const fkSample = tableInfo.foreignKeys
      .filter(fk => sampleRow[fk.column])
      .map(fk => \`\${fk.column}=\${sampleRow[fk.column]}\`)
      .slice(0, 2);
    
    if (fkSample.length > 0) {
      console.log(\`\ud83d\udd0d \${tableName}: Sample resolved FKs: \${fkSample.join(', ')}\`);
    }
  }
  
  return resolvedData;
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
  const tableInfo = SCHEMA_CONFIG.tableAnalysis.find(t => t.name === tableName);
  
  if (!tableSchema || !tableInfo) {
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
        case 'uuid':
          if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{3}-[0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
            warnings.push(\`Field '\${fieldName}' should be a valid UUID format\`);
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
    !['id', 'created_at', 'updated_at'].includes(key) &&
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
  
  console.log(\`\ud83d\udccb \${tableName}: Validating \${batch.length} rows...\`);
  
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
  console.log(\`\ud83d\udcca \${tableName}: \${validRows.length} valid, \${invalidRows.length} invalid rows\`);
  
  if (allWarnings.length > 0 && allWarnings.length <= 10) {
    console.log(\`\u26a0\ufe0f  \${tableName}: \${allWarnings.length} validation warnings:\`);
    allWarnings.slice(0, 5).forEach(warning => console.warn(\`   - \${warning}\`));
    if (allWarnings.length > 5) {
      console.warn(\`   ... and \${allWarnings.length - 5} more warnings\`);
    }
  }
  
  if (invalidRows.length > 0) {
    console.error(\`\u274c \${tableName}: \${invalidRows.length} validation errors (showing first 3):\`);
    invalidRows.slice(0, 3).forEach(invalid => {
      console.error(\`   Row \${invalid.index}: \${invalid.errors.join(', ')}\`);
    });
  }
  
  if (validRows.length > 0) {
    const sampleRow = validRows[0];
    const sampleFields = Object.keys(sampleRow)
      .filter(key => !['id', 'created_at', 'updated_at'].includes(key))
      .slice(0, 3);
    
    if (sampleFields.length > 0) {
      console.log(\`\ud83d\udd0d \${tableName}: Sample valid row fields: \${sampleFields.join(', ')}\`);
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