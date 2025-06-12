import { TYPE_PATTERNS } from '@/lib/constants';
import { singularize, pluralize } from '@/lib/utils/naming';
import type { RelationshipHint, CSVParseResult } from '@/types/csv.types';

/**
 * Detects potential relationships between tables based on CSV data
 */
export function detectRelationships(csvResults: CSVParseResult[]): RelationshipHint[] {
  const relationships: RelationshipHint[] = [];
  
  // Single file relationship detection
  if (csvResults.length === 1) {
    relationships.push(...detectSelfReferences(csvResults[0]));
    relationships.push(...detectImplicitRelationships(csvResults[0]));
  } else {
    // Multi-file relationship detection
    relationships.push(...detectCrossTableRelationships(csvResults));
  }
  
  return relationships;
}

/**
 * Detects self-referential relationships within a single table
 */
export function detectSelfReferences(csvResult: CSVParseResult): RelationshipHint[] {
  const relationships: RelationshipHint[] = [];
  const tableName = csvResult.fileName.replace(/\.(csv|tsv|txt)$/i, '');
  
  csvResult.columns.forEach(column => {
    const columnName = column.name.toLowerCase();
    
    // Look for parent_id, manager_id, etc.
    const selfRefPatterns = [
      /^parent_?id$/,
      /^manager_?id$/,
      /^supervisor_?id$/,
      /^leader_?id$/,
      /^head_?id$/,
      /^boss_?id$/,
      /^owner_?id$/,
      /^creator_?id$/,
      /^assigned_to_?id$/,
      /^reports_to_?id$/
    ];
    
    const isSelfRef = selfRefPatterns.some(pattern => pattern.test(columnName));
    
    if (isSelfRef) {
      relationships.push({
        sourceColumn: column.name,
        targetTable: tableName,
        targetColumn: 'id',
        confidence: 0.85,
        type: 'self-reference',
        reasoning: `Self-referential relationship detected: ${column.name} likely references ${tableName}.id`
      });
    }
    
    // Also check if the column name matches the table name + _id
    const tableBaseName = singularize(tableName.toLowerCase().replace(/[^a-z0-9]/g, '_'));
    if (columnName === `${tableBaseName}_id`) {
      relationships.push({
        sourceColumn: column.name,
        targetTable: tableName,
        targetColumn: 'id',
        confidence: 0.8,
        type: 'self-reference',
        reasoning: `Column name ${column.name} suggests self-reference to ${tableName}`
      });
    }
  });
  
  return relationships;
}

/**
 * Detects implicit relationships based on naming patterns
 */
export function detectImplicitRelationships(csvResult: CSVParseResult): RelationshipHint[] {
  const relationships: RelationshipHint[] = [];
  
  csvResult.columns.forEach(column => {
    const columnName = column.name.toLowerCase();
    
    // Common foreign key patterns
    const fkPatterns = [
      { pattern: /^user_?id$/, table: 'users' },
      { pattern: /^customer_?id$/, table: 'customers' },
      { pattern: /^product_?id$/, table: 'products' },
      { pattern: /^order_?id$/, table: 'orders' },
      { pattern: /^category_?id$/, table: 'categories' },
      { pattern: /^department_?id$/, table: 'departments' },
      { pattern: /^company_?id$/, table: 'companies' },
      { pattern: /^organization_?id$/, table: 'organizations' },
      { pattern: /^project_?id$/, table: 'projects' },
      { pattern: /^team_?id$/, table: 'teams' },
      { pattern: /^group_?id$/, table: 'groups' },
      { pattern: /^role_?id$/, table: 'roles' },
      { pattern: /^status_?id$/, table: 'statuses' },
      { pattern: /^type_?id$/, table: 'types' },
      { pattern: /^account_?id$/, table: 'accounts' },
      { pattern: /^profile_?id$/, table: 'profiles' },
      { pattern: /^address_?id$/, table: 'addresses' },
      { pattern: /^location_?id$/, table: 'locations' },
      { pattern: /^country_?id$/, table: 'countries' },
      { pattern: /^state_?id$/, table: 'states' },
      { pattern: /^city_?id$/, table: 'cities' },
      { pattern: /^region_?id$/, table: 'regions' }
    ];
    
    fkPatterns.forEach(({ pattern, table }) => {
      if (pattern.test(columnName)) {
        relationships.push({
          sourceColumn: column.name,
          targetTable: table,
          targetColumn: 'id',
          confidence: 0.9,
          type: 'foreign-key',
          reasoning: `Common foreign key pattern: ${column.name} → ${table}.id`
        });
      }
    });
    
    // Generic _id pattern
    if (columnName.endsWith('_id') && columnName !== 'id') {
      const baseName = columnName.slice(0, -3);
      const targetTable = pluralize(baseName);
      
      relationships.push({
        sourceColumn: column.name,
        targetTable,
        targetColumn: 'id',
        confidence: 0.7,
        type: 'foreign-key',
        reasoning: `Foreign key pattern: ${column.name} → ${targetTable}.id`
      });
    }
    
    // Check for UUID values (potential foreign keys)
    const uuidCount = Array.from(column.uniqueValues)
      .filter(value => value && TYPE_PATTERNS.UUID.test(value))
      .length;
    
    const uuidRatio = uuidCount / column.uniqueValues.size;
    
    if (uuidRatio > 0.8 && column.uniqueValues.size > 1) {
      relationships.push({
        sourceColumn: column.name,
        confidence: 0.6,
        type: 'foreign-key',
        reasoning: `Column contains mostly UUID values (${(uuidRatio * 100).toFixed(1)}%), likely foreign key`
      });
    }
  });
  
  return relationships;
}

/**
 * Detects relationships between multiple CSV files
 */
export function detectCrossTableRelationships(csvResults: CSVParseResult[]): RelationshipHint[] {
  const relationships: RelationshipHint[] = [];
  
  // Create a map of table names to their columns
  const tableMap = new Map<string, { columns: string[]; fileName: string }>();
  
  csvResults.forEach(result => {
    const tableName = result.fileName.replace(/\.(csv|tsv|txt)$/i, '');
    tableMap.set(tableName, {
      columns: result.columns.map(col => col.name),
      fileName: result.fileName
    });
  });
  
  // For each CSV, look for potential foreign keys to other tables
  csvResults.forEach(sourceResult => {
    const sourceTableName = sourceResult.fileName.replace(/\.(csv|tsv|txt)$/i, '');
    
    sourceResult.columns.forEach(column => {
      const columnName = column.name.toLowerCase();
      
      // Check if column name suggests reference to another table
      tableMap.forEach((_, targetTableName) => {
        if (targetTableName === sourceTableName) return; // Skip self
        
        const targetSingular = singularize(targetTableName.toLowerCase());
        const targetPlural = pluralize(targetTableName.toLowerCase());
        
        // Check various naming patterns
        const patterns = [
          `${targetSingular}_id`,
          `${targetSingular}id`,
          `${targetPlural}_id`,
          `${targetPlural}id`,
          targetSingular,
          targetPlural
        ];
        
        patterns.forEach(pattern => {
          if (columnName === pattern || columnName.endsWith(`_${pattern}`)) {
            const confidence = columnName.endsWith('_id') ? 0.9 : 0.7;
            
            relationships.push({
              sourceColumn: column.name,
              targetTable: targetTableName,
              targetColumn: 'id',
              confidence,
              type: 'foreign-key',
              reasoning: `Cross-table reference: ${sourceTableName}.${column.name} → ${targetTableName}.id`
            });
          }
        });
      });
      
      // Check for many-to-many junction table patterns
      if (sourceTableName.includes('_') || sourceTableName.includes('-')) {
        const parts = sourceTableName.toLowerCase().split(/[_-]/);
        if (parts.length === 2) {
          // Potential junction table
          const [table1, table2] = parts;
          
          // Look for columns that match the table parts
          const hasTable1Ref = sourceResult.columns.some(col => 
            col.name.toLowerCase().includes(table1) && col.name.toLowerCase().includes('id')
          );
          const hasTable2Ref = sourceResult.columns.some(col => 
            col.name.toLowerCase().includes(table2) && col.name.toLowerCase().includes('id')
          );
          
          if (hasTable1Ref && hasTable2Ref) {
            relationships.push({
              sourceColumn: sourceTableName,
              confidence: 0.8,
              type: 'many-to-many',
              reasoning: `Potential junction table: ${sourceTableName} appears to link ${table1} and ${table2}`
            });
          }
        }
      }
    });
  });
  
  return relationships;
}

/**
 * Analyzes column value overlap between tables to detect relationships
 */
export function detectValueOverlapRelationships(csvResults: CSVParseResult[]): RelationshipHint[] {
  const relationships: RelationshipHint[] = [];
  
  if (csvResults.length < 2) return relationships;
  
  // Compare each pair of tables
  for (let i = 0; i < csvResults.length; i++) {
    for (let j = i + 1; j < csvResults.length; j++) {
      const table1 = csvResults[i];
      const table2 = csvResults[j];
      
      const table1Name = table1.fileName.replace(/\.(csv|tsv|txt)$/i, '');
      const table2Name = table2.fileName.replace(/\.(csv|tsv|txt)$/i, '');
      
      // Compare columns for value overlap
      table1.columns.forEach(col1 => {
        table2.columns.forEach(col2 => {
          // Skip if columns have same name (likely comparing ID columns)
          if (col1.name.toLowerCase() === col2.name.toLowerCase()) return;
          
          // Calculate value overlap
          const overlap = calculateValueOverlap(col1.uniqueValues, col2.uniqueValues);
          
          if (overlap.ratio > 0.5 && overlap.commonValues > 2) {
            const confidence = Math.min(overlap.ratio * 0.8, 0.9);
            
            relationships.push({
              sourceColumn: col1.name,
              targetTable: table2Name,
              targetColumn: col2.name,
              confidence,
              type: 'foreign-key',
              reasoning: `High value overlap (${(overlap.ratio * 100).toFixed(1)}%) between ${table1Name}.${col1.name} and ${table2Name}.${col2.name}`
            });
          }
        });
      });
    }
  }
  
  return relationships;
}

/**
 * Calculates the overlap between two sets of values
 */
function calculateValueOverlap(set1: Set<string>, set2: Set<string>): {
  ratio: number;
  commonValues: number;
  totalUnique: number;
} {
  const common = new Set([...set1].filter(value => set2.has(value)));
  const totalUnique = new Set([...set1, ...set2]).size;
  
  return {
    ratio: common.size / Math.min(set1.size, set2.size),
    commonValues: common.size,
    totalUnique
  };
}

/**
 * Suggests optimal relationship types based on cardinality analysis
 */
export function analyzeRelationshipCardinality(
  _sourceColumn: string,
  _targetColumn: string,
  sourceValues: Set<string>,
  targetValues: Set<string>
): {
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  confidence: number;
  reasoning: string;
} {
  const sourceUnique = sourceValues.size;
  const targetUnique = targetValues.size;
  const sourceTotal = sourceValues.size; // Assuming no duplicates in the set
  const targetTotal = targetValues.size;
  
  // Calculate uniqueness ratios
  const sourceUniqueRatio = sourceUnique / sourceTotal;
  const targetUniqueRatio = targetUnique / targetTotal;
  
  // One-to-One: Both sides mostly unique
  if (sourceUniqueRatio > 0.9 && targetUniqueRatio > 0.9) {
    return {
      type: 'one-to-one',
      confidence: Math.min(sourceUniqueRatio, targetUniqueRatio),
      reasoning: 'High uniqueness on both sides suggests one-to-one relationship'
    };
  }
  
  // One-to-Many: Source unique, target not unique
  if (sourceUniqueRatio > 0.9 && targetUniqueRatio < 0.7) {
    return {
      type: 'one-to-many',
      confidence: sourceUniqueRatio,
      reasoning: 'Source values are unique while target values repeat, suggesting one-to-many'
    };
  }
  
  // Many-to-Many: Neither side is particularly unique
  if (sourceUniqueRatio < 0.7 && targetUniqueRatio < 0.7) {
    return {
      type: 'many-to-many',
      confidence: 0.6,
      reasoning: 'Low uniqueness on both sides suggests many-to-many relationship'
    };
  }
  
  // Default to one-to-many (most common)
  return {
    type: 'one-to-many',
    confidence: 0.5,
    reasoning: 'Default assumption based on common database patterns'
  };
}

/**
 * Filters and ranks relationship hints by confidence and relevance
 */
export function rankRelationships(relationships: RelationshipHint[]): RelationshipHint[] {
  // Remove duplicates and low-confidence relationships
  const filtered = relationships.filter(rel => rel.confidence > 0.3);
  
  // Group by source column and keep only the highest confidence relationship per column
  const grouped = new Map<string, RelationshipHint>();
  
  filtered.forEach(rel => {
    const existing = grouped.get(rel.sourceColumn);
    if (!existing || rel.confidence > existing.confidence) {
      grouped.set(rel.sourceColumn, rel);
    }
  });
  
  // Sort by confidence (highest first)
  return Array.from(grouped.values()).sort((a, b) => b.confidence - a.confidence);
}