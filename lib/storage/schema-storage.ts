import type { DatabaseSchema } from '@/types/schema.types';
import type { CSVValidationResult } from '@/lib/csv/validator';

export interface PersistedSchemaData {
  schema: DatabaseSchema;
  csvResults: CSVValidationResult[];
  aiAnalysis?: any; // Store the raw AI analysis for reference
  lastUpdated: string;
  version: string;
}

const SCHEMA_STORAGE_KEY = 'dreamschema-analyzed-schema';
const SCHEMA_VERSION = '1.0.0';

export class SchemaStorage {
  /**
   * Store analyzed schema and related data in localStorage
   */
  static store(data: {
    schema: DatabaseSchema;
    csvResults: CSVValidationResult[];
    aiAnalysis?: any;
  }): boolean {
    try {
      const persistedData: PersistedSchemaData = {
        ...data,
        lastUpdated: new Date().toISOString(),
        version: SCHEMA_VERSION,
      };
      
      localStorage.setItem(SCHEMA_STORAGE_KEY, JSON.stringify(persistedData));
      console.log('🗄️ Schema data stored in localStorage');
      return true;
    } catch (error) {
      console.warn('Failed to store schema data in localStorage:', error);
      return false;
    }
  }

  /**
   * Retrieve analyzed schema data from localStorage
   */
  static retrieve(): PersistedSchemaData | null {
    try {
      const storedData = localStorage.getItem(SCHEMA_STORAGE_KEY);
      if (storedData) {
        const parsed = JSON.parse(storedData);
        
        // Check version compatibility
        if (parsed.version !== SCHEMA_VERSION) {
          console.warn('Schema storage version mismatch, clearing old data');
          SchemaStorage.clear();
          return null;
        }
        
        // Convert date strings back to Date objects for schema
        if (parsed.schema) {
          parsed.schema.createdAt = new Date(parsed.schema.createdAt);
          parsed.schema.updatedAt = new Date(parsed.schema.updatedAt);
        }
        
        console.log('🗄️ Schema data retrieved from localStorage');
        return parsed;
      }
    } catch (error) {
      console.warn('Failed to retrieve schema data from localStorage:', error);
    }
    return null;
  }

  /**
   * Clear stored schema data from localStorage
   */
  static clear(): boolean {
    try {
      localStorage.removeItem(SCHEMA_STORAGE_KEY);
      console.log('🗄️ Schema data cleared from localStorage');
      return true;
    } catch (error) {
      console.warn('Failed to clear schema data from localStorage:', error);
      return false;
    }
  }

  /**
   * Check if schema data exists in localStorage
   */
  static hasStoredSchema(): boolean {
    return SchemaStorage.retrieve() !== null;
  }

  /**
   * Update only the schema part while preserving other data
   */
  static updateSchema(updatedSchema: DatabaseSchema): boolean {
    const existingData = SchemaStorage.retrieve();
    if (!existingData) {
      console.warn('No existing schema data to update');
      return false;
    }

    return SchemaStorage.store({
      ...existingData,
      schema: updatedSchema,
    });
  }

  /**
   * Get schema with fallback to stored data
   */
  static getSchema(primarySchema?: DatabaseSchema): DatabaseSchema | null {
    // Try primary schema first
    if (primarySchema) {
      return primarySchema;
    }

    // Fallback to localStorage
    const storedData = SchemaStorage.retrieve();
    return storedData?.schema || null;
  }

  /**
   * Get CSV results with fallback to stored data
   */
  static getCSVResults(primaryResults?: CSVValidationResult[]): CSVValidationResult[] {
    // Try primary results first
    if (primaryResults && primaryResults.length > 0) {
      return primaryResults;
    }

    // Fallback to localStorage
    const storedData = SchemaStorage.retrieve();
    return storedData?.csvResults || [];
  }

  /**
   * Check if stored data is recent (within 24 hours)
   */
  static isDataRecent(): boolean {
    const storedData = SchemaStorage.retrieve();
    if (!storedData) return false;

    const lastUpdated = new Date(storedData.lastUpdated);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60);
    
    return hoursDiff < 24; // Data is recent if less than 24 hours old
  }

  /**
   * Get storage info for debugging
   */
  static getStorageInfo(): {
    hasData: boolean;
    isRecent: boolean;
    lastUpdated?: string | undefined;
    schemaName?: string | undefined;
    tablesCount?: number | undefined;
    csvFilesCount?: number | undefined;
  } {
    const data = SchemaStorage.retrieve();
    return {
      hasData: !!data,
      isRecent: SchemaStorage.isDataRecent(),
      lastUpdated: data?.lastUpdated,
      schemaName: data?.schema?.name,
      tablesCount: data?.schema?.tables?.length,
      csvFilesCount: data?.csvResults?.length,
    };
  }
}