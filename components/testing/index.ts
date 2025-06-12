// Testing components exports
export { QueryInterface } from './query-interface';
export { SchemaTestingInterface } from './schema-testing-interface';

// Re-export types for convenience
export type { 
  PGLiteTestResult, 
  SchemaTestResult 
} from '@/lib/db/pglite-instance';

export type { 
  ValidationTest, 
  TestSuite 
} from '@/lib/db/test-queries';