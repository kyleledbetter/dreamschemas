import type { DatabaseSchema } from '@/types/schema.types';
import type { CSVParseResult } from '@/types/csv.types';

export interface ValidationTest {
  id: string;
  name: string;
  description: string;
  query: string;
  expectedResult?: 'success' | 'data' | 'count';
  category: 'structure' | 'data' | 'constraints' | 'performance' | 'relationships';
  severity: 'error' | 'warning' | 'info';
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  tests: ValidationTest[];
}

/**
 * Generates comprehensive test suites for schema validation
 */
export function generateSchemaTestSuites(
  schema: DatabaseSchema,
  csvData?: CSVParseResult[]
): TestSuite[] {
  const testSuites: TestSuite[] = [];

  // Structure validation tests
  testSuites.push(generateStructureTests(schema));

  // Data integrity tests
  testSuites.push(generateDataIntegrityTests(schema));

  // Constraint validation tests
  testSuites.push(generateConstraintTests(schema));

  // Relationship tests
  testSuites.push(generateRelationshipTests(schema));

  // Performance tests
  testSuites.push(generatePerformanceTests(schema));

  // CSV data-specific tests
  if (csvData && csvData.length > 0) {
    testSuites.push(generateDataValidationTests(schema, csvData));
  }

  return testSuites;
}

/**
 * Structure validation tests - ensure all tables and columns exist
 */
function generateStructureTests(schema: DatabaseSchema): TestSuite {
  const tests: ValidationTest[] = [];

  // Test table existence
  schema.tables.forEach(table => {
    tests.push({
      id: `table_exists_${table.name}`,
      name: `Table ${table.name} exists`,
      description: `Verify that table "${table.name}" was created successfully`,
      query: `SELECT tablename FROM pg_tables WHERE tablename = '${table.name}' AND schemaname = 'public'`,
      expectedResult: 'data',
      category: 'structure',
      severity: 'error'
    });

    // Test column existence for each table
    table.columns.forEach(column => {
      tests.push({
        id: `column_exists_${table.name}_${column.name}`,
        name: `Column ${table.name}.${column.name} exists`,
        description: `Verify that column "${column.name}" exists in table "${table.name}"`,
        query: `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = '${table.name}' 
          AND column_name = '${column.name}' 
          AND table_schema = 'public'
        `,
        expectedResult: 'data',
        category: 'structure',
        severity: 'error'
      });

      // Test column data type
      tests.push({
        id: `column_type_${table.name}_${column.name}`,
        name: `Column ${table.name}.${column.name} has correct type`,
        description: `Verify that column "${column.name}" has the expected data type`,
        query: `
          SELECT data_type, character_maximum_length, numeric_precision, numeric_scale
          FROM information_schema.columns 
          WHERE table_name = '${table.name}' 
          AND column_name = '${column.name}' 
          AND table_schema = 'public'
        `,
        expectedResult: 'data',
        category: 'structure',
        severity: 'warning'
      });
    });
  });

  return {
    id: 'structure_tests',
    name: 'Structure Validation',
    description: 'Tests to verify that all tables, columns, and data types are created correctly',
    tests
  };
}

/**
 * Data integrity tests - check for valid data and constraints
 */
function generateDataIntegrityTests(schema: DatabaseSchema): TestSuite {
  const tests: ValidationTest[] = [];

  schema.tables.forEach(table => {
    // Test for NULL values in NOT NULL columns
    const notNullColumns = table.columns.filter(col => 
      !col.nullable || col.constraints.some(c => c.type === 'NOT NULL')
    );

    notNullColumns.forEach(column => {
      tests.push({
        id: `not_null_${table.name}_${column.name}`,
        name: `No NULL values in ${table.name}.${column.name}`,
        description: `Verify that column "${column.name}" contains no NULL values`,
        query: `SELECT COUNT(*) as null_count FROM "${table.name}" WHERE "${column.name}" IS NULL`,
        expectedResult: 'count',
        category: 'data',
        severity: 'error'
      });
    });

    // Test for unique constraints
    const uniqueColumns = table.columns.filter(col =>
      col.constraints.some(c => c.type === 'UNIQUE' || c.type === 'PRIMARY KEY')
    );

    uniqueColumns.forEach(column => {
      tests.push({
        id: `unique_${table.name}_${column.name}`,
        name: `Unique values in ${table.name}.${column.name}`,
        description: `Verify that column "${column.name}" contains only unique values`,
        query: `
          SELECT COUNT(*) as total_count, COUNT(DISTINCT "${column.name}") as unique_count 
          FROM "${table.name}"
        `,
        expectedResult: 'data',
        category: 'data',
        severity: 'error'
      });
    });

    // Test primary key existence
    const primaryKeyColumns = table.columns.filter(col =>
      col.constraints.some(c => c.type === 'PRIMARY KEY')
    );

    if (primaryKeyColumns.length > 0) {
      tests.push({
        id: `primary_key_${table.name}`,
        name: `Primary key constraint on ${table.name}`,
        description: `Verify that table "${table.name}" has a primary key constraint`,
        query: `
          SELECT constraint_name 
          FROM information_schema.table_constraints 
          WHERE table_name = '${table.name}' 
          AND constraint_type = 'PRIMARY KEY' 
          AND table_schema = 'public'
        `,
        expectedResult: 'data',
        category: 'constraints',
        severity: 'error'
      });
    }
  });

  return {
    id: 'data_integrity_tests',
    name: 'Data Integrity',
    description: 'Tests to verify data quality and constraint compliance',
    tests
  };
}

/**
 * Constraint validation tests
 */
function generateConstraintTests(schema: DatabaseSchema): TestSuite {
  const tests: ValidationTest[] = [];

  schema.tables.forEach(table => {
    // Test CHECK constraints
    table.columns.forEach(column => {
      const checkConstraints = column.constraints.filter(c => c.type === 'CHECK');
      
      checkConstraints.forEach((constraint, index) => {
        tests.push({
          id: `check_constraint_${table.name}_${column.name}_${index}`,
          name: `Check constraint on ${table.name}.${column.name}`,
          description: `Verify check constraint: ${constraint.value}`,
          query: `
            SELECT COUNT(*) as violation_count 
            FROM "${table.name}" 
            WHERE NOT (${constraint.value})
          `,
          expectedResult: 'count',
          category: 'constraints',
          severity: 'error'
        });
      });
    });

    // Test indexes
    table.indexes.forEach(index => {
      tests.push({
        id: `index_exists_${index.name}`,
        name: `Index ${index.name} exists`,
        description: `Verify that index "${index.name}" was created`,
        query: `
          SELECT indexname 
          FROM pg_indexes 
          WHERE indexname = '${index.name}' 
          AND tablename = '${table.name}'
          AND schemaname = 'public'
        `,
        expectedResult: 'data',
        category: 'structure',
        severity: 'warning'
      });
    });
  });

  return {
    id: 'constraint_tests',
    name: 'Constraint Validation',
    description: 'Tests to verify that all constraints are properly implemented and enforced',
    tests
  };
}

/**
 * Relationship validation tests
 */
function generateRelationshipTests(schema: DatabaseSchema): TestSuite {
  const tests: ValidationTest[] = [];

  schema.relationships.forEach(relationship => {
    // Test foreign key constraint existence
    tests.push({
      id: `foreign_key_${relationship.id}`,
      name: `Foreign key relationship ${relationship.sourceTable} → ${relationship.targetTable}`,
      description: `Verify foreign key from ${relationship.sourceTable}.${relationship.sourceColumn} to ${relationship.targetTable}.${relationship.targetColumn}`,
      query: `
        SELECT 
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = '${relationship.sourceTable}'
          AND kcu.column_name = '${relationship.sourceColumn}'
          AND ccu.table_name = '${relationship.targetTable}'
          AND ccu.column_name = '${relationship.targetColumn}'
      `,
      expectedResult: 'data',
      category: 'relationships',
      severity: 'error'
    });

    // Test referential integrity
    tests.push({
      id: `referential_integrity_${relationship.id}`,
      name: `Referential integrity ${relationship.sourceTable} → ${relationship.targetTable}`,
      description: `Verify that all foreign key values exist in the referenced table`,
      query: `
        SELECT COUNT(*) as orphaned_records
        FROM "${relationship.sourceTable}" s
        LEFT JOIN "${relationship.targetTable}" t 
          ON s."${relationship.sourceColumn}" = t."${relationship.targetColumn}"
        WHERE s."${relationship.sourceColumn}" IS NOT NULL 
          AND t."${relationship.targetColumn}" IS NULL
      `,
      expectedResult: 'count',
      category: 'relationships',
      severity: 'error'
    });
  });

  return {
    id: 'relationship_tests',
    name: 'Relationship Validation',
    description: 'Tests to verify that all relationships and foreign keys are working correctly',
    tests
  };
}

/**
 * Performance validation tests
 */
function generatePerformanceTests(schema: DatabaseSchema): TestSuite {
  const tests: ValidationTest[] = [];

  schema.tables.forEach(table => {
    // Test table row count
    tests.push({
      id: `row_count_${table.name}`,
      name: `Row count for ${table.name}`,
      description: `Check the number of rows in table "${table.name}"`,
      query: `SELECT COUNT(*) as row_count FROM "${table.name}"`,
      expectedResult: 'data',
      category: 'performance',
      severity: 'info'
    });

    // Test for tables without indexes on foreign key columns
    const foreignKeyColumns = table.columns.filter(col =>
      col.constraints.some(c => c.type === 'FOREIGN KEY')
    );

    foreignKeyColumns.forEach(column => {
      const hasIndex = table.indexes.some(index =>
        index.columns.includes(column.name)
      );

      if (!hasIndex) {
        tests.push({
          id: `missing_index_${table.name}_${column.name}`,
          name: `Index recommendation for ${table.name}.${column.name}`,
          description: `Foreign key column "${column.name}" should have an index for better performance`,
          query: `SELECT '${column.name}' as column_name, 'Missing index on foreign key' as recommendation`,
          expectedResult: 'data',
          category: 'performance',
          severity: 'warning'
        });
      }
    });
  });

  return {
    id: 'performance_tests',
    name: 'Performance Analysis',
    description: 'Tests to identify potential performance issues and optimization opportunities',
    tests
  };
}

/**
 * CSV data-specific validation tests
 */
function generateDataValidationTests(schema: DatabaseSchema, csvData: CSVParseResult[]): TestSuite {
  const tests: ValidationTest[] = [];

  csvData.forEach(csv => {
    const tableName = csv.fileName.replace(/\.(csv|tsv|txt)$/i, '');
    const table = schema.tables.find(t => t.name === tableName);

    if (table) {
      // Test data insertion success
      tests.push({
        id: `data_inserted_${tableName}`,
        name: `Sample data inserted into ${tableName}`,
        description: `Verify that sample data from ${csv.fileName} was inserted successfully`,
        query: `SELECT COUNT(*) as inserted_count FROM "${tableName}"`,
        expectedResult: 'data',
        category: 'data',
        severity: 'info'
      });

      // Test for data type compatibility
      csv.columns.forEach((_, index) => {
        const schemaColumn = table.columns[index];
        if (schemaColumn) {
          tests.push({
            id: `data_compatibility_${tableName}_${schemaColumn.name}`,
            name: `Data compatibility for ${tableName}.${schemaColumn.name}`,
            description: `Check for data type conversion issues in column "${schemaColumn.name}"`,
            query: `
              SELECT 
                COUNT(*) as total_rows,
                COUNT("${schemaColumn.name}") as non_null_rows,
                COUNT(*) - COUNT("${schemaColumn.name}") as null_rows
              FROM "${tableName}"
            `,
            expectedResult: 'data',
            category: 'data',
            severity: 'info'
          });
        }
      });
    }
  });

  return {
    id: 'data_validation_tests',
    name: 'CSV Data Validation',
    description: 'Tests to verify that CSV data was properly imported and is compatible with the schema',
    tests
  };
}


/**
 * Generates quick validation queries for basic schema checks
 */
export function generateQuickValidationQueries(schema: DatabaseSchema): ValidationTest[] {
  const tests: ValidationTest[] = [];

  // Check that all tables exist
  const tableNames = schema.tables.map(t => `'${t.name}'`).join(', ');
  tests.push({
    id: 'all_tables_exist',
    name: 'All tables exist',
    description: 'Verify that all schema tables were created',
    query: `
      SELECT COUNT(*) as existing_tables
      FROM pg_tables 
      WHERE tablename IN (${tableNames}) 
      AND schemaname = 'public'
    `,
    expectedResult: 'data',
    category: 'structure',
    severity: 'error'
  });

  // Check that primary keys exist
  tests.push({
    id: 'primary_keys_exist',
    name: 'Primary keys exist',
    description: 'Verify that primary key constraints are created',
    query: `
      SELECT COUNT(*) as pk_count
      FROM information_schema.table_constraints 
      WHERE constraint_type = 'PRIMARY KEY' 
      AND table_schema = 'public'
      AND table_name IN (${tableNames})
    `,
    expectedResult: 'data',
    category: 'constraints',
    severity: 'error'
  });

  // Check foreign key constraints
  if (schema.relationships.length > 0) {
    tests.push({
      id: 'foreign_keys_exist',
      name: 'Foreign keys exist',
      description: 'Verify that foreign key constraints are created',
      query: `
        SELECT COUNT(*) as fk_count
        FROM information_schema.table_constraints 
        WHERE constraint_type = 'FOREIGN KEY' 
        AND table_schema = 'public'
        AND table_name IN (${tableNames})
      `,
      expectedResult: 'data',
      category: 'relationships',
      severity: 'warning'
    });
  }

  return tests;
}