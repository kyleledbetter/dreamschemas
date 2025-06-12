import { POSTGRES_RESERVED_WORDS, NAMING_CONVENTIONS } from '@/lib/constants';

/**
 * Converts a string to snake_case format
 */
export function toSnakeCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Converts a string to PascalCase format
 */
export function toPascalCase(str: string): string {
  return str
    .trim()
    .split(/[^a-zA-Z0-9]/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Converts a string to camelCase format
 */
export function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Pluralizes a table name following English rules
 */
export function pluralize(word: string): string {
  const lower = word.toLowerCase();
  
  // Irregular plurals
  const irregulars: Record<string, string> = {
    person: 'people',
    child: 'children',
    foot: 'feet',
    tooth: 'teeth',
    mouse: 'mice',
    goose: 'geese'
  };
  
  if (irregulars[lower]) {
    return irregulars[lower];
  }
  
  // Words ending in 's', 'ss', 'sh', 'ch', 'x', 'z'
  if (/[sxz]$/.test(lower) || /[cs]h$/.test(lower)) {
    return word + 'es';
  }
  
  // Words ending in consonant + 'y'
  if (/[^aeiou]y$/.test(lower)) {
    return word.slice(0, -1) + 'ies';
  }
  
  // Words ending in 'f' or 'fe'
  if (/fe?$/.test(lower)) {
    return word.replace(/fe?$/, 'ves');
  }
  
  // Default: add 's'
  return word + 's';
}

/**
 * Singularizes a table name
 */
export function singularize(word: string): string {
  const lower = word.toLowerCase();
  
  // Irregular plurals (reverse)
  const irregulars: Record<string, string> = {
    people: 'person',
    children: 'child',
    feet: 'foot',
    teeth: 'tooth',
    mice: 'mouse',
    geese: 'goose'
  };
  
  if (irregulars[lower]) {
    return irregulars[lower];
  }
  
  // Words ending in 'ies'
  if (/ies$/.test(lower)) {
    return word.slice(0, -3) + 'y';
  }
  
  // Words ending in 'ves'
  if (/ves$/.test(lower)) {
    return word.slice(0, -3) + 'f';
  }
  
  // Words ending in 'es' (but not 'oes' or 'ues')
  if (/[sxz]es$/.test(lower) || /[cs]hes$/.test(lower)) {
    return word.slice(0, -2);
  }
  
  // Words ending in 's' (but not 'ss')
  if (/[^s]s$/.test(lower)) {
    return word.slice(0, -1);
  }
  
  return word;
}

/**
 * Sanitizes a name to be valid for PostgreSQL
 */
export function sanitizeName(name: string, type: 'table' | 'column' | 'index' | 'constraint' = 'column'): string {
  let sanitized = toSnakeCase(name);
  
  // Handle empty or invalid names
  if (!sanitized || sanitized === '_') {
    sanitized = type === 'table' ? 'untitled_table' : 'untitled_column';
  }
  
  // Ensure it doesn't start with a number
  if (/^\d/.test(sanitized)) {
    sanitized = type + '_' + sanitized;
  }
  
  // Handle reserved words
  if (POSTGRES_RESERVED_WORDS.has(sanitized)) {
    sanitized = sanitized + '_value';
  }
  
  // Ensure it matches naming convention
  const pattern = NAMING_CONVENTIONS[type.toUpperCase() as keyof typeof NAMING_CONVENTIONS];
  if (!pattern.test(sanitized)) {
    // If it still doesn't match, ensure it's at least valid
    sanitized = sanitized.replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (!sanitized) {
      sanitized = type === 'table' ? 'table_1' : 'column_1';
    }
  }
  
  return sanitized;
}

/**
 * Generates a valid table name from a CSV filename
 */
export function generateTableName(filename: string, options: { pluralize?: boolean } = {}): string {
  // Remove file extension
  let name = filename.replace(/\.(csv|tsv|txt)$/i, '');
  
  // Basic sanitization
  name = sanitizeName(name, 'table');
  
  // Pluralize if requested
  if (options.pluralize) {
    name = pluralize(name);
  }
  
  return name;
}

/**
 * Generates a foreign key column name
 */
export function generateForeignKeyName(referencedTable: string): string {
  const singular = singularize(referencedTable);
  return sanitizeName(singular + '_id', 'column');
}

/**
 * Generates an index name
 */
export function generateIndexName(tableName: string, columns: string[], unique = false): string {
  const prefix = unique ? 'uk' : 'idx';
  const columnsPart = columns.slice(0, 3).join('_'); // Limit to first 3 columns
  const name = `${prefix}_${tableName}_${columnsPart}`;
  return sanitizeName(name, 'index');
}

/**
 * Generates a constraint name
 */
export function generateConstraintName(
  type: 'pk' | 'fk' | 'uk' | 'ck',
  tableName: string,
  columnName?: string
): string {
  const parts = [type, tableName];
  if (columnName) {
    parts.push(columnName);
  }
  const name = parts.join('_');
  return sanitizeName(name, 'constraint');
}

/**
 * Validates if a name is valid for PostgreSQL
 */
export function isValidName(name: string, type: 'table' | 'column' | 'index' | 'constraint' = 'column'): boolean {
  if (!name || name.length === 0) {
    return false;
  }
  
  // Check length limits
  const maxLength = type === 'table' || type === 'column' ? 63 : 63;
  if (name.length > maxLength) {
    return false;
  }
  
  // Check pattern
  const pattern = NAMING_CONVENTIONS[type.toUpperCase() as keyof typeof NAMING_CONVENTIONS];
  if (!pattern.test(name)) {
    return false;
  }
  
  // Check reserved words
  if (POSTGRES_RESERVED_WORDS.has(name.toLowerCase())) {
    return false;
  }
  
  return true;
}

/**
 * Suggests alternative names if the given name is invalid
 */
export function suggestAlternativeNames(name: string, type: 'table' | 'column' = 'column'): string[] {
  const suggestions: string[] = [];
  
  // Try basic sanitization
  const sanitized = sanitizeName(name, type);
  if (sanitized !== name) {
    suggestions.push(sanitized);
  }
  
  // Try with suffix
  suggestions.push(sanitized + '_value');
  suggestions.push(sanitized + '_data');
  
  // Try with prefix
  if (type === 'table') {
    suggestions.push('tbl_' + sanitized);
  } else {
    suggestions.push('col_' + sanitized);
  }
  
  // Remove duplicates and invalid names
  return [...new Set(suggestions)].filter(s => isValidName(s, type));
}