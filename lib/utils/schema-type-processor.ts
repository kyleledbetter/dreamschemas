import type { DatabaseSchema, PostgresType, Table, Column } from '../../types/schema.types';

/**
 * Post-process schema to fix type issues that made it through AI validation
 * This is the safety net to ensure correct types regardless of what the AI generated
 */
export function postProcessSchemaTypes(schema: DatabaseSchema): DatabaseSchema {
  console.log('🔧 Post-processing schema types to fix any remaining issues...');
  
  const processedSchema = JSON.parse(JSON.stringify(schema)); // Deep clone
  let fixedCount = 0;

  processedSchema.tables.forEach((table: Table) => {
    table.columns.forEach((column: Column) => {
      const originalType = column.type;
      const name = column.name.toLowerCase();
      
      // Fix primary key 'id' columns that should be UUID
      if (name === 'id' && column.type !== 'UUID') {
        column.type = 'UUID' as PostgresType;
        console.log(`🔧 Fixed PRIMARY KEY column ${table.name}.${column.name}: ${originalType} → UUID`);
        fixedCount++;
      }
      
      // Fix foreign key columns that should be UUID
      if (name.endsWith('_id') && name !== 'id' && column.type !== 'UUID') {
        column.type = 'UUID' as PostgresType;
        console.log(`🔧 Fixed FK column ${table.name}.${column.name}: ${originalType} → UUID`);
        fixedCount++;
      }
      
      // Fix audit timestamp columns that should be TIMESTAMPTZ
      if ((name === 'created_at' || name === 'updated_at') && column.type !== 'TIMESTAMPTZ') {
        column.type = 'TIMESTAMPTZ' as PostgresType;
        console.log(`🔧 Fixed timestamp column ${table.name}.${column.name}: ${originalType} → TIMESTAMPTZ`);
        fixedCount++;
      }
      
      // Fix coordinate columns that should be DECIMAL
      if ((name.includes('latitude') || name.includes('longitude') || 
           name.includes('lat') || name.includes('lng') || name.includes('lon')) &&
          column.type === 'TEXT') {
        column.type = 'DECIMAL' as PostgresType;
        column.precision = 10;
        column.scale = 6;
        console.log(`🔧 Fixed coordinate column ${table.name}.${column.name}: ${originalType} → DECIMAL(10,6)`);
        fixedCount++;
      }
      
      // Fix year columns that should be SMALLINT
      if (name.includes('year') && !name.includes('built') && !name.includes('constructed') &&
          column.type === 'TEXT') {
        column.type = 'SMALLINT' as PostgresType;
        console.log(`🔧 Fixed year column ${table.name}.${column.name}: ${originalType} → SMALLINT`);
        fixedCount++;
      }
      
      // Fix boolean columns that should be BOOLEAN
      if ((name.startsWith('is_') || name.startsWith('has_') || name.startsWith('can_') ||
           name.endsWith('_flag') || name.includes('active') || name.includes('enabled')) &&
          column.type === 'TEXT') {
        column.type = 'BOOLEAN' as PostgresType;
        console.log(`🔧 Fixed boolean column ${table.name}.${column.name}: ${originalType} → BOOLEAN`);
        fixedCount++;
      }
      
      // Fix email columns that should be VARCHAR
      if (name.includes('email') && column.type === 'TEXT') {
        column.type = 'VARCHAR' as PostgresType;
        column.length = 255;
        console.log(`🔧 Fixed email column ${table.name}.${column.name}: ${originalType} → VARCHAR(255)`);
        fixedCount++;
      }
      
      // Fix count/quantity columns that should be INTEGER
      if ((name.includes('count') || name.includes('quantity') || name.includes('total') ||
           name.includes('num_')) && column.type === 'TEXT') {
        column.type = 'INTEGER' as PostgresType;
        console.log(`🔧 Fixed count column ${table.name}.${column.name}: ${originalType} → INTEGER`);
        fixedCount++;
      }
      
      // Fix price/money columns that should be DECIMAL
      if ((name.includes('price') || name.includes('cost') || name.includes('value') ||
           name.includes('amount') || name.includes('fee') || name.includes('rate')) &&
          (column.type === 'VARCHAR' || column.type === 'CHAR')) {
        column.type = 'DECIMAL' as PostgresType;
        column.precision = 10;
        column.scale = 2;
        console.log(`🔧 Fixed price column ${table.name}.${column.name}: ${originalType} → DECIMAL(10,2)`);
        fixedCount++;
      }
    });
  });

  if (fixedCount > 0) {
    console.log(`✅ Post-processing complete: Fixed ${fixedCount} type issues`);
  } else {
    console.log(`✅ Post-processing complete: No type fixes needed`);
  }

  return processedSchema;
} 