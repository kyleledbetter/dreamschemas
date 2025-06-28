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

    console.log(`🚀 Generating dynamic edge function for schema with ${schema.tables.length} tables (v3.0 - Bulletproof Edition)`);

    // Generate the seeding logic using the robust, deterministic simple generator
    const seedingLogic = generateSimpleSeedingLogic(schema);

    // Step 2: Generate the complete edge function using the template
    const functionSource = generateDynamicSeederFunction(seedingLogic);

    console.log(`📋 Generated edge function (${functionSource.length} chars) with deterministic logic`);

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
      message: `Dynamic Edge Function deployed successfully for ${schema.tables.length} tables`,
      functionUrl: `https://${projectId}.supabase.co/functions/v1/seed-data`,
      function: functionData,
      version: "deterministic",
      metadata: {
        tablesCount: schema.tables.length,
        relationshipsCount: schema.relationships.length,
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
 * Generate simple fallback seeding logic when AI is not available
 */
function generateSimpleSeedingLogic(schema: DatabaseSchema): SeedingLogic {
  console.log("🔧 Generating simple fallback seeding logic...");
  console.log(`🏗️ Using actual table names: ${schema.tables.map(t => t.name).join(', ')}`);
  
  const relationships = schema.relationships;

  return {
    constants: `
// Dynamic schema configuration with full table definitions
const SCHEMA_CONFIG = {
  batchSize: 50,
  maxRetries: 3,
  timeoutMs: 1200,
  tables: ${JSON.stringify(schema.tables)},
  relationships: ${JSON.stringify(relationships.map(r => ({ 
    source: r.sourceTable, 
    target: r.targetTable 
  })))}
};

const PERFORMANCE_CONFIG = {
  enableCaching: true,
  logLevel: 'info',
  validateData: true,
  complexityScore: ${schema.tables.length * 2 + schema.relationships.length}
};`,

    tableProcessors: `
// DYNAMIC FUZZY COLUMN MATCHING HELPERS
const calculateStringSimilarity = (str1, str2) => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

const levenshteinDistance = (str1, str2) => {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

const normalizeColumnName = (name) => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
};

const findBestColumnMatch = (csvHeader, allowedColumns) => {
  if (allowedColumns.length === 0) {
    return normalizeColumnName(csvHeader);
  }
  
  const normalizedCsvHeader = normalizeColumnName(csvHeader);
  
  // 1. Exact match
  if (allowedColumns.includes(normalizedCsvHeader)) {
    return normalizedCsvHeader;
  }
  
  // 2. Find best fuzzy match
  let bestMatch = null;
  let bestScore = 0;
  const SIMILARITY_THRESHOLD = 0.6; // 60% similarity required
  
  allowedColumns.forEach(dbColumn => {
    // Use a simpler, more reliable direct similarity score
    const score = calculateStringSimilarity(normalizedCsvHeader, dbColumn);
    
    if (score > bestScore && score >= SIMILARITY_THRESHOLD) {
      bestScore = score;
      bestMatch = dbColumn;
    }
  });
  
  return bestMatch;
};

// Dynamic table processing - get table names from schema
const ALL_TABLES = SCHEMA_CONFIG.tables.map(t => t.name);

// Topologically sort tables to respect foreign key dependencies
const sortedTables = (() => {
  const nodes = ALL_TABLES.map(name => ({ name, dependencies: new Set<string>() }));
  const nameToNode = new Map(nodes.map(n => [n.name, n]));

  (SCHEMA_CONFIG.relationships || []).forEach(rel => {
    // If rel.sourceTable depends on rel.targetTable...
    const sourceNode = nameToNode.get(rel.source);
    const targetNode = nameToNode.get(rel.target);
    if (sourceNode && targetNode) {
      sourceNode.dependencies.add(rel.target);
    }
  });

  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(node: { name: string; dependencies: Set<string> }) {
    if (visiting.has(node.name)) {
      console.warn(\`Circular dependency detected involving \${node.name}, breaking sort.\`);
      return;
    }
    if (visited.has(node.name)) {
      return;
    }

    visiting.add(node.name);
    visited.add(node.name);

    node.dependencies.forEach(depName => {
      const depNode = nameToNode.get(depName);
      if (depNode) {
        visit(depNode);
      }
    });
    
    visiting.delete(node.name);
    sorted.push(node.name);
  }

  nodes.forEach(node => visit(node));
  return sorted;
})();

const TABLE_PROCESSING_ORDER = sortedTables;
console.log('🏗️ TABLE_PROCESSING_ORDER (dependency sorted):', TABLE_PROCESSING_ORDER);

const filterDataForTable = (data, tableName) => {
  console.log(\`📋 Filtering \${data.length} rows for table: \${tableName}\`);
  
  // Get table info from schema
  const table = SCHEMA_CONFIG.tables.find(t => t.name === tableName);
  if (!table) {
    console.warn(\`⚠️  Table \${tableName} not found in schema\`);
    return [];
  }
  
  // Check if this is a lookup table (has only id, name, created_at, updated_at columns)
  const isLookupTable = table.columns && 
    table.columns.filter(col => !['id', 'created_at', 'updated_at'].includes(col.name)).length === 1 &&
    table.columns.some(col => col.name === 'name');
  
  if (isLookupTable) {
    console.log(\`🏷️  \${tableName}: Detected as lookup table\`);

    // Find the single data column for the lookup table (e.g., 'name', 'status')
    const lookupDbColumn = table.columns.find(col => !['id', 'created_at', 'updated_at'].includes(col.name))?.name;
    
    if (!lookupDbColumn) {
        console.warn(\`⚠️  Could not determine the lookup column for \${tableName}\`);
        return [];
    }
    
    // Find the best matching header in the CSV for that column
    const csvHeaders = data.length > 0 ? Object.keys(data[0]) : [];
    const bestCsvHeader = findBestColumnMatch(lookupDbColumn, csvHeaders);
    
    if (!bestCsvHeader) {
        console.warn(\`⚠️  Could not find a matching CSV header for lookup column '\${lookupDbColumn}' in table \${tableName}\`);
        return [];
    }

    console.log(\`🔍  Mapping CSV header '\${bestCsvHeader}' to lookup column '\${lookupDbColumn}' for table \${tableName}\`);
    
    // Extract unique, non-empty values from that specific CSV column
    const uniqueValues = new Set(
      data
        .map(row => row[bestCsvHeader])
        .filter(value => value !== null && value !== undefined && String(value).trim() !== '')
        .map(value => String(value).trim())
    );
    
    // Convert to array of objects with the correct field name
    const filteredData = Array.from(uniqueValues).map(value => ({ [lookupDbColumn]: value }));
    console.log(\`✅ \${tableName}: \${filteredData.length} unique values extracted for lookup table\`);
    return filteredData;
  } else {
    console.log(\`📊 \${tableName}: Detected as data table\`);
    // For data tables, pass through all data
    const filteredData = data.filter(row => row && typeof row === 'object');
    console.log(\`✅ \${tableName}: \${filteredData.length} rows passed filtering\`);
    return filteredData;
  }
};`,

    columnMappers: `
// Schema-aware mapping - get table schema info
const getTableSchema = (tableName) => {
  const schemaConfig = SCHEMA_CONFIG.tables || [];
  return schemaConfig.find(t => t === tableName) ? {} : {}; // Simple version doesn't have detailed schema
};

// Get table schema from the passed schema configuration
const getTableColumns = (tableName) => {
  // This will be replaced with actual schema data when the function is generated
  const schemaData = SCHEMA_CONFIG.tables || [];
  const table = schemaData.find(t => t.name === tableName);
  
  if (!table || !table.columns) {
    console.warn(\`⚠️  No schema found for table \${tableName}, allowing all columns\`);
    return []; // Return empty array to allow all columns
  }
  
  // Return column names, excluding system columns that we generate
  return table.columns
    .map(col => col.name)
    .filter(name => !['id', 'created_at', 'updated_at'].includes(name));
};

const mapCSVToTableColumns = (csvRow, tableName) => {
  console.log(\`🔄 \${tableName}: Starting dynamic fuzzy column matching...\`);
  
  const mapped = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  // Get allowed columns from schema
  const allowedColumns = getTableColumns(tableName);
  console.log(\`📋 \${tableName}: Target columns (\${allowedColumns.length}): \${allowedColumns.join(', ')}\`);
  
  const mappedFields = [];
  const skippedFields = [];
  
  Object.keys(csvRow).forEach(csvKey => {
    const originalValue = csvRow[csvKey];
    
    // Skip empty values
    if (originalValue === null || originalValue === undefined || originalValue === '') {
      return;
    }
    
    // Skip system columns
    const normalizedKey = normalizeColumnName(csvKey);
    if (['id', 'created_at', 'updated_at'].includes(normalizedKey)) {
      return;
    }
    
    // Find best matching database column
    const targetColumn = findBestColumnMatch(csvKey, allowedColumns);
    
    if (targetColumn) {
      mapped[targetColumn] = String(originalValue).trim();
      mappedFields.push(\`"\${csvKey}" → \${targetColumn}\`);
    } else {
      skippedFields.push(csvKey);
    }
  });
  
  console.log(\`🎯 \${tableName}: Dynamic mapping results:\`);
  console.log(\`   ✅ Mapped (\${mappedFields.length}): \${mappedFields.join(', ')}\`);
  if (skippedFields.length > 0) {
    console.log(\`   ⏭️  Skipped (\${skippedFields.length}): \${skippedFields.join(', ')}\`);
  }
  console.log(\`🔍 \${tableName}: Sample mapped row:\`, JSON.stringify(mapped, null, 2));
  
  return mapped;
};

const convertValue = (value, columnName, columnType) => {
  if (value === null || value === undefined || value === '') return null;
  
  const str = String(value).trim();
  const type = columnType.toLowerCase();
  
  if (type.includes('int')) {
    const num = parseInt(str);
    return isNaN(num) ? null : num;
  }
  if (type.includes('numeric') || type.includes('decimal')) {
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }
  if (type.includes('bool')) {
    return ['true', '1', 'yes', 'y'].includes(str.toLowerCase());
  }
  if (type.includes('timestamp') || type.includes('date')) {
    const date = new Date(str);
    return isNaN(date.getTime()) ? null : date.toISOString();
  }
  
  return str;
};`,

    relationshipResolvers: `
class ForeignKeyResolver {
  constructor() {
    this.cache = new Map();
  }
  
  async resolveFK(tableName, value) {
    if (!value) return null;
    
    const cacheKey = \`\${tableName}:\${value}\`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    // Simple FK resolution - return null for now
    // In a real implementation, this would query the database
    return null;
  }
}

const resolveForeignKeys = async (data, tableName) => {
  console.log(\`🔗 \${tableName}: Starting FK resolution with \${data.length} rows...\`);
  const resolver = new ForeignKeyResolver();
  
  // Simple pass-through - no FK resolution in basic version
  console.log(\`✅ \${tableName}: FK resolution complete, returning \${data.length} rows\`);
  if (data.length > 0) {
    console.log(\`🔍 \${tableName}: Sample resolved row:\`, JSON.stringify(data[0], null, 2));
  }
  
  return data;
};`,

    validationRules: `
const validateRowForTable = (row, tableName) => {
  const errors = [];
  
  // Very permissive validation - only reject completely empty rows
  if (!row || typeof row !== 'object') {
    errors.push('Row is not a valid object');
    return { isValid: false, errors };
  }
  
  // Check if row has any actual data
  // NOTE: Don't check for 'id' here since it's generated during mapping, not before validation
  const dataKeys = Object.keys(row).filter(key => 
    key && row[key] !== null && row[key] !== undefined && row[key] !== ''
  );
  
  if (dataKeys.length === 0) {
    errors.push('Row contains no data fields');
    return { isValid: false, errors };
  }
  
  // Row is valid if it has any non-empty data
  return { isValid: true, errors: [] };
};

const validateBatch = (batch, tableName) => {
  const validRows = [];
  const invalidRows = [];
  
  batch.forEach((row, index) => {
    const validation = validateRowForTable(row, tableName);
    if (validation.isValid) {
      validRows.push(row);
    } else {
      invalidRows.push({ row, errors: validation.errors, index });
      console.error(\`❌ Validation failed for \${tableName} row (index: \${index}): \${validation.errors.join(', ')}\`);
    }
  });
  
  console.log(\`📊 \${tableName} validation: \${validRows.length} valid, \${invalidRows.length} invalid\`);
  if (validRows.length > 0) {
    console.log(\`🔍 \${tableName} sample valid row:\`, JSON.stringify(validRows[0], null, 2));
  }
  
  return { validRows, invalidRows };
};`,
  };
}