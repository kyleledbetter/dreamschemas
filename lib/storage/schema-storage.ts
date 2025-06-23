/**
 * Schema Storage Manager
 * Handles persistence of AI-generated schemas to localStorage for browser reload recovery
 */

import type { DatabaseSchema } from '@/types/schema.types';

export interface StoredSchemaData {
  schema: DatabaseSchema;
  originalAnalysis: unknown; // Store the original AI analysis response
  csvFileNames: string[];
  timestamp: number;
  version: string;
}

const STORAGE_KEY = 'dreamschema_stored_schema';
const STORAGE_VERSION = '1.0.0';

export class SchemaStorage {
  /**
   * Check if we're in a browser environment
   */
  private static isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  /**
   * Save schema and analysis to localStorage
   */
  static save(data: {
    schema: DatabaseSchema;
    originalAnalysis: unknown;
    csvFileNames: string[];
  }): void {
    if (!SchemaStorage.isBrowser()) {
      console.warn('⚠️ localStorage not available (SSR)');
      return;
    }
    try {
      const storedData: StoredSchemaData = {
        ...data,
        timestamp: Date.now(),
        version: STORAGE_VERSION,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedData));
      console.log('✅ Schema saved to localStorage:', {
        schemaName: data.schema.name,
        tables: data.schema.tables.length,
        relationships: data.schema.relationships.length,
      });
    } catch (error) {
      console.error('❌ Failed to save schema to localStorage:', error);
    }
  }

  /**
   * Load schema from localStorage
   */
  static load(): StoredSchemaData | null {
    if (!SchemaStorage.isBrowser()) {
      return null;
    }
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const data: StoredSchemaData = JSON.parse(stored);
      
      // Version check - for future migrations
      if (data.version !== STORAGE_VERSION) {
        console.warn('⚠️ Stored schema version mismatch, clearing');
        SchemaStorage.clear();
        return null;
      }

      // Age check - expire after 24 hours
      const ageHours = (Date.now() - data.timestamp) / (1000 * 60 * 60);
      if (ageHours > 24) {
        console.log('🕒 Stored schema expired (>24h), clearing');
        SchemaStorage.clear();
        return null;
      }

      console.log('✅ Schema loaded from localStorage:', {
        schemaName: data.schema.name,
        tables: data.schema.tables.length,
        age: `${ageHours.toFixed(1)}h`,
      });

      return data;
    } catch (error) {
      console.error('❌ Failed to load schema from localStorage:', error);
      SchemaStorage.clear(); // Clear corrupted data
      return null;
    }
  }

  /**
   * Check if a stored schema exists
   */
  static exists(): boolean {
    if (!SchemaStorage.isBrowser()) {
      return false;
    }
    return localStorage.getItem(STORAGE_KEY) !== null;
  }

  /**
   * Clear stored schema
   */
  static clear(): void {
    if (!SchemaStorage.isBrowser()) {
      return;
    }
    
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('🗑️ Stored schema cleared');
    } catch (error) {
      console.error('❌ Failed to clear stored schema:', error);
    }
  }

  /**
   * Get metadata about stored schema without loading full data
   */
  static getMetadata(): {
    exists: boolean;
    timestamp?: number;
    schemaName?: string;
    tableCount?: number;
    ageHours?: number;
  } {
    if (!SchemaStorage.isBrowser()) {
      return { exists: false };
    }
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return { exists: false };
      }

      const data: StoredSchemaData = JSON.parse(stored);
      const ageHours = (Date.now() - data.timestamp) / (1000 * 60 * 60);

      return {
        exists: true,
        timestamp: data.timestamp,
        schemaName: data.schema.name,
        tableCount: data.schema.tables.length,
        ageHours,
      };
    } catch {
      return { exists: false };
    }
  }

  /**
   * Update only the schema part of stored data (keep original analysis)
   */
  static updateSchema(updatedSchema: DatabaseSchema): void {
    if (!SchemaStorage.isBrowser()) {
      console.warn('⚠️ localStorage not available (SSR)');
      return;
    }
    
    try {
      const current = SchemaStorage.load();
      if (!current) {
        console.warn('⚠️ No stored schema to update');
        return;
      }

      SchemaStorage.save({
        schema: updatedSchema,
        originalAnalysis: current.originalAnalysis,
        csvFileNames: current.csvFileNames,
      });
    } catch {
      console.error('❌ Failed to update stored schema');
    }
  }
}