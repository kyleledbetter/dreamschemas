import { TYPE_PATTERNS, VALIDATION_RULES } from '@/lib/constants';
import type { PostgresType } from '@/types/schema.types';
import type { TypeInferenceResult, CSVColumn } from '@/types/csv.types';

/**
 * Analyzes a value to determine its most likely type
 */
export function analyzeValue(value: string): {
  type: PostgresType;
  confidence: number;
  metadata?: Record<string, unknown>;
} {
  if (!value || value.trim() === '') {
    return { type: 'VARCHAR', confidence: 0 };
  }
  
  const trimmed = value.trim();
  
  // UUID detection
  if (TYPE_PATTERNS.UUID.test(trimmed)) {
    return { type: 'UUID', confidence: 0.95 };
  }
  
  // Boolean detection
  if (TYPE_PATTERNS.BOOLEAN.test(trimmed)) {
    return { type: 'BOOLEAN', confidence: 0.9 };
  }
  
  // Email detection
  if (TYPE_PATTERNS.EMAIL.test(trimmed)) {
    return { 
      type: 'VARCHAR', 
      confidence: 0.9,
      metadata: { 
        isEmail: true,
        suggestedLength: 255,
        constraint: 'CHECK (email ~* \'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$\')'
      }
    };
  }
  
  // URL detection
  if (TYPE_PATTERNS.URL.test(trimmed)) {
    return { 
      type: 'TEXT', 
      confidence: 0.85,
      metadata: { 
        isUrl: true,
        constraint: 'CHECK (url ~* \'^https?://\')'
      }
    };
  }
  
  // Phone number detection
  if (TYPE_PATTERNS.PHONE.test(trimmed)) {
    return { 
      type: 'VARCHAR', 
      confidence: 0.8,
      metadata: { 
        isPhone: true,
        suggestedLength: 20
      }
    };
  }
  
  // JSON detection
  if (TYPE_PATTERNS.JSON.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return { type: 'JSONB', confidence: 0.9 };
    } catch {
      // Not valid JSON, continue with other checks
    }
  }
  
  // Integer detection
  if (TYPE_PATTERNS.INTEGER.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    if (num >= -32768 && num <= 32767) {
      return { type: 'SMALLINT', confidence: 0.9 };
    } else if (num >= -2147483648 && num <= 2147483647) {
      return { type: 'INTEGER', confidence: 0.9 };
    } else {
      return { type: 'BIGINT', confidence: 0.9 };
    }
  }
  
  // Decimal detection
  if (TYPE_PATTERNS.DECIMAL.test(trimmed)) {
    const parts = trimmed.split('.');
    const totalDigits = trimmed.replace(/[.-]/g, '').length;
    const decimalPlaces = parts[1]?.length || 0;
    
    return { 
      type: 'NUMERIC', 
      confidence: 0.85,
      metadata: {
        precision: Math.min(totalDigits, 38),
        scale: Math.min(decimalPlaces, 8)
      }
    };
  }
  
  // Date detection
  if (TYPE_PATTERNS.DATE_ISO.test(trimmed)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return { type: 'DATE', confidence: 0.85 };
    }
  }
  
  // DateTime detection
  if (TYPE_PATTERNS.DATETIME_ISO.test(trimmed)) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return { type: 'TIMESTAMPTZ', confidence: 0.85 };
    }
  }
  
  // Default to VARCHAR with length estimation
  const length = Math.max(trimmed.length, VALIDATION_RULES.DEFAULT_VARCHAR_LENGTH);
  return { 
    type: 'VARCHAR', 
    confidence: 0.5,
    metadata: { suggestedLength: Math.min(length * 1.2, VALIDATION_RULES.MAX_VARCHAR_LENGTH) }
  };
}

/**
 * Infers the best PostgreSQL type for a column based on its values
 */
export function inferColumnType(column: CSVColumn): TypeInferenceResult {
  const nonNullValues = Array.from(column.uniqueValues).filter(v => v !== null && v !== '');
  
  if (nonNullValues.length === 0) {
    return {
      type: 'VARCHAR',
      confidence: 0.1,
      reasoning: 'All values are null or empty',
      constraints: ['DEFAULT NULL'],
      examples: []
    };
  }
  
  // Analyze each unique value
  const typeAnalysis = nonNullValues.map(value => analyzeValue(value));
  
  // Count occurrences of each type
  const typeCounts = new Map<PostgresType, number>();
  const typeConfidences = new Map<PostgresType, number[]>();
  const typeMetadata = new Map<PostgresType, Record<string, unknown>[]>();
  
  typeAnalysis.forEach(analysis => {
    const count = typeCounts.get(analysis.type) || 0;
    typeCounts.set(analysis.type, count + 1);
    
    const confidences = typeConfidences.get(analysis.type) || [];
    confidences.push(analysis.confidence);
    typeConfidences.set(analysis.type, confidences);
    
    if (analysis.metadata) {
      const metadata = typeMetadata.get(analysis.type) || [];
      metadata.push(analysis.metadata);
      typeMetadata.set(analysis.type, metadata);
    }
  });
  
  // Find the most common type
  let bestType: PostgresType = 'VARCHAR';
  let bestCount = 0;
  let bestConfidence = 0;
  
  for (const [type, count] of typeCounts.entries()) {
    const confidences = typeConfidences.get(type) || [];
    const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    const score = (count / nonNullValues.length) * avgConfidence;
    
    if (score > bestConfidence) {
      bestType = type;
      bestCount = count;
      bestConfidence = score;
    }
  }
  
  // Calculate final confidence
  const consistency = bestCount / nonNullValues.length;
  const finalConfidence = Math.min(bestConfidence * consistency, 0.95);
  
  // Generate constraints and metadata
  const constraints: string[] = [];
  let suggestedLength: number | undefined;
  let suggestedPrecision: number | undefined;
  let suggestedScale: number | undefined;
  
  const metadata = typeMetadata.get(bestType) || [];
  
  // Handle VARCHAR length
  if (bestType === 'VARCHAR') {
    const lengths = metadata
      .map(m => m.suggestedLength as number)
      .filter(Boolean);
    
    if (lengths.length > 0) {
      suggestedLength = Math.max(...lengths);
    } else {
      // Calculate based on actual values
      const maxLength = Math.max(...nonNullValues.map(v => v.length));
      suggestedLength = Math.min(
        Math.max(maxLength * 1.2, VALIDATION_RULES.DEFAULT_VARCHAR_LENGTH),
        VALIDATION_RULES.MAX_VARCHAR_LENGTH
      );
    }
    
    // Add specific constraints for emails, phones, etc.
    const emailMetadata = metadata.find(m => m.isEmail);
    const phoneMetadata = metadata.find(m => m.isPhone);
    const urlMetadata = metadata.find(m => m.isUrl);
    
    if (emailMetadata && consistency > 0.8) {
      constraints.push(emailMetadata.constraint as string);
    } else if (phoneMetadata && consistency > 0.8) {
      constraints.push('CHECK (length(trim(' + column.name + ')) >= 7)');
    } else if (urlMetadata && consistency > 0.8) {
      constraints.push(urlMetadata.constraint as string);
    }
  }
  
  // Handle NUMERIC precision and scale
  if (bestType === 'NUMERIC') {
    const precisions = metadata
      .map(m => m.precision as number)
      .filter(Boolean);
    const scales = metadata
      .map(m => m.scale as number)
      .filter(Boolean);
    
    if (precisions.length > 0) {
      suggestedPrecision = Math.max(...precisions);
    }
    if (scales.length > 0) {
      suggestedScale = Math.max(...scales);
    }
  }
  
  // Check for potential enum (low cardinality)
  const uniqueRatio = column.uniqueValues.size / column.totalCount;
  if (uniqueRatio < 0.1 && column.uniqueValues.size <= 10 && column.uniqueValues.size > 1) {
    // This might be better as an enum
    if (bestType === 'VARCHAR') {
      constraints.push(`CHECK (${column.name} IN (${Array.from(column.uniqueValues).map(v => `'${v}'`).join(', ')}))`);
    }
  }
  
  // Check for NOT NULL constraint
  const nullRatio = column.nullCount / column.totalCount;
  if (nullRatio < 0.01 && column.nullCount <= 2) { // Less than 1% nulls AND max 2 null values
    constraints.push('NOT NULL');
  }
  
  // Check for UNIQUE constraint
  if (uniqueRatio > 0.95 && column.totalCount > 10) { // More than 95% unique values
    constraints.push('UNIQUE');
  }
  
  // Generate reasoning
  let reasoning = `Inferred as ${bestType} based on ${bestCount}/${nonNullValues.length} values (${(consistency * 100).toFixed(1)}% consistency)`;
  
  if (bestType === 'VARCHAR' && metadata.some(m => m.isEmail)) {
    reasoning += '. Detected email format';
  } else if (bestType === 'VARCHAR' && metadata.some(m => m.isPhone)) {
    reasoning += '. Detected phone number format';
  } else if (bestType === 'TEXT' && metadata.some(m => m.isUrl)) {
    reasoning += '. Detected URL format';
  }
  
  if (uniqueRatio < 0.1) {
    reasoning += `. Low cardinality (${column.uniqueValues.size} unique values) suggests possible enum`;
  }
  
  const result: TypeInferenceResult = {
    type: bestType,
    confidence: finalConfidence,
    reasoning,
    constraints,
    examples: nonNullValues.slice(0, 5) // First 5 examples
  };

  if (suggestedLength !== undefined) {
    result.suggestedLength = suggestedLength;
  }
  
  if (suggestedPrecision !== undefined) {
    result.suggestedPrecision = suggestedPrecision;
  }
  
  if (suggestedScale !== undefined) {
    result.suggestedScale = suggestedScale;
  }

  return result;
}

/**
 * Suggests database column name based on CSV header
 */
export function suggestColumnName(originalName: string): string {
  return originalName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .replace(/^(\d)/, 'col_$1') // Prefix with col_ if starts with number
    || 'unnamed_column';
}

/**
 * Detects potential foreign key relationships within columns
 */
export function detectPotentialForeignKeys(columns: CSVColumn[]): {
  column: string;
  potentialTarget: string;
  confidence: number;
  reasoning: string;
}[] {
  const relationships: {
    column: string;
    potentialTarget: string;
    confidence: number;
    reasoning: string;
  }[] = [];
  
  columns.forEach(column => {
    const name = column.name.toLowerCase();
    
    // Check for _id pattern
    if (name.endsWith('_id')) {
      const targetTable = name.slice(0, -3); // Remove '_id'
      const potentialTarget = targetTable + 's'; // Simple pluralization
      
      relationships.push({
        column: column.name,
        potentialTarget,
        confidence: 0.8,
        reasoning: `Column name follows foreign key pattern (*_id)`
      });
    }
    
    // Check for id pattern without underscore
    if (name.endsWith('id') && name.length > 2) {
      const targetTable = name.slice(0, -2);
      const potentialTarget = targetTable + 's';
      
      relationships.push({
        column: column.name,
        potentialTarget,
        confidence: 0.6,
        reasoning: `Column name suggests foreign key (*id)`
      });
    }
    
    // Check for UUID values (likely foreign keys)
    const uuidValues = Array.from(column.uniqueValues).filter(v => 
      v && TYPE_PATTERNS.UUID.test(v)
    );
    
    if (uuidValues.length > 0 && uuidValues.length / column.uniqueValues.size > 0.8) {
      relationships.push({
        column: column.name,
        potentialTarget: 'unknown_table',
        confidence: 0.7,
        reasoning: `Column contains UUID values, likely foreign key`
      });
    }
  });
  
  return relationships;
}

/**
 * Analyzes all columns in a CSV and returns type inference results
 */
export function analyzeCSVTypes(columns: CSVColumn[]): Record<string, TypeInferenceResult> {
  const results: Record<string, TypeInferenceResult> = {};
  
  columns.forEach(column => {
    results[column.name] = inferColumnType(column);
  });
  
  return results;
}