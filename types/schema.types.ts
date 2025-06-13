export type PostgresType = 
  | 'VARCHAR'
  | 'TEXT'
  | 'CHAR'
  | 'SMALLINT'
  | 'INTEGER'
  | 'BIGINT'
  | 'NUMERIC'
  | 'DECIMAL'
  | 'REAL'
  | 'DOUBLE PRECISION'
  | 'BOOLEAN'
  | 'DATE'
  | 'TIME'
  | 'TIMESTAMP'
  | 'TIMESTAMPTZ'
  | 'UUID'
  | 'JSONB'
  | 'JSON'
  | 'ARRAY'
  | 'ENUM';

export type ConstraintType = 
  | 'PRIMARY KEY'
  | 'FOREIGN KEY'
  | 'UNIQUE'
  | 'NOT NULL'
  | 'CHECK'
  | 'DEFAULT';

export interface ColumnConstraint {
  type: ConstraintType;
  value?: string;
  referencedTable?: string;
  referencedColumn?: string;
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

export interface Column {
  id: string;
  name: string;
  type: PostgresType;
  length?: number;
  precision?: number;
  scale?: number;
  nullable: boolean;
  defaultValue?: string;
  constraints: ColumnConstraint[];
  comment?: string;
  originalCSVColumn?: string;
}

export interface Index {
  id: string;
  name: string;
  columns: string[];
  unique: boolean;
  type?: 'BTREE' | 'HASH' | 'GIN' | 'GIST';
}

export interface Table {
  id: string;
  name: string;
  columns: Column[];
  indexes: Index[];
  comment?: string;
  position?: { x: number; y: number };
}

export interface Relationship {
  id: string;
  name?: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
}

export interface RLSPolicy {
  id: string;
  tableName: string;
  name: string;
  command: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'ALL';
  using?: string;
  withCheck?: string;
  roles?: string[];
}

export interface DatabaseSchema {
  id: string;
  name: string;
  tables: Table[];
  relationships: Relationship[];
  rlsPolicies: RLSPolicy[];
  version: string;
  createdAt: Date;
  updatedAt: Date;
  projectId?: string;
}

export interface SchemaValidationError {
  id: string;
  type: 'error' | 'warning';
  table?: string;
  column?: string;
  message: string;
  suggestion?: string;
  code: string;
}

export interface SchemaValidationResult {
  isValid: boolean;
  errors: SchemaValidationError[];
  warnings: SchemaValidationError[];
}

export interface MigrationScript {
  id: string;
  name: string;
  up: string;
  down: string;
  type: 'create' | 'alter' | 'drop';
  timestamp: Date;
}

export interface SchemaExportOptions {
  format: 'migration' | 'declarative' | 'prisma' | 'typescript';
  includeRLS: boolean;
  includeIndexes: boolean;
  includeComments: boolean;
  schemaName?: string;
}

export interface SchemaExportResult {
  content: string;
  filename: string;
  type: string;
}