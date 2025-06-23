'use client';

import Papa from 'papaparse';

export interface CSVRow {
  [key: string]: string | number | boolean | null;
}

export interface CSVValidationError {
  type: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  row?: number;
  column?: string;
  suggestion?: string;
  autoFixable?: boolean;
}

export interface CSVValidationResult {
  isValid: boolean;
  errors: CSVValidationError[];
  warnings: CSVValidationError[];
  suggestions: CSVValidationError[];
  metadata: {
    totalRows: number;
    totalColumns: number;
    headers: string[];
    encoding: string;
    delimiter: string;
    hasHeaders: boolean;
    emptyRows: number;
    duplicateHeaders: string[];
    fileSize: number;
    estimatedTypes: Record<string, string>;
  };
  sampleData: CSVRow[];
  cleanedData?: CSVRow[];
  originalMetadata?: {
    name: string;
    size: number;
    type: string;
  };
}

export interface CSVValidationOptions {
  maxFileSize?: number; // bytes
  maxRows?: number;
  maxColumns?: number;
  requireHeaders?: boolean;
  allowEmptyRows?: boolean;
  allowDuplicateHeaders?: boolean;
  autoDetectTypes?: boolean;
  customValidators?: CSVCustomValidator[];
  encoding?: string;
  delimiter?: string;
  skipEmptyLines?: boolean;
}

export interface CSVCustomValidator {
  name: string;
  validate: (data: CSVRow[], headers: string[]) => CSVValidationError[];
}

/**
 * Advanced CSV validation and analysis engine
 * Provides comprehensive validation, type detection, and optimization suggestions
 */
export class CSVValidator {
  private options: Required<CSVValidationOptions>;

  constructor(options: CSVValidationOptions = {}) {
    this.options = {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      maxRows: 1000000,
      maxColumns: 300,
      requireHeaders: true,
      allowEmptyRows: false,
      allowDuplicateHeaders: false,
      autoDetectTypes: true,
      customValidators: [],
      encoding: 'UTF-8',
      delimiter: ',',
      skipEmptyLines: true,
      ...options,
    };
  }

  /**
   * Validate a CSV file with comprehensive analysis
   */
  async validateFile(file: File): Promise<CSVValidationResult> {
    const errors: CSVValidationError[] = [];
    const warnings: CSVValidationError[] = [];
    const suggestions: CSVValidationError[] = [];

    // File size validation
    if (file.size > this.options.maxFileSize) {
      errors.push({
        type: 'error',
        code: 'FILE_TOO_LARGE',
        message: `File size (${this.formatFileSize(file.size)}) exceeds maximum allowed size (${this.formatFileSize(this.options.maxFileSize)})`,
        suggestion: 'Consider splitting the file into smaller chunks or increasing the file size limit',
      });
    }

    // File type validation
    if (!this.isValidCSVFile(file)) {
      errors.push({
        type: 'error',
        code: 'INVALID_FILE_TYPE',
        message: 'File must be a CSV file (.csv, .txt) or have CSV-compatible content',
        suggestion: 'Ensure your file has a .csv extension and contains comma-separated values',
      });
    }

    try {
      // Parse CSV with auto-detection
      const parseResult = await this.parseCSV(file);
      
      if (parseResult.errors.length > 0) {
        parseResult.errors.forEach(error => {
          errors.push({
            type: 'error',
            code: 'PARSE_ERROR',
            message: `Parse error: ${error.message}`,
            row: error.row || 0,
          });
        });
      }

      const data = parseResult.data as CSVRow[];
      const meta = parseResult.meta;

      // Extract headers and data rows
      const headers = data.length > 0 ? Object.keys(data[0]) : [];
      const dataRows = data;

      // Basic structure validation
      const structureErrors = this.validateStructure(dataRows, headers);
      errors.push(...structureErrors.filter(e => e.type === 'error'));
      warnings.push(...structureErrors.filter(e => e.type === 'warning'));

      // Header validation
      const headerErrors = this.validateHeaders(headers);
      errors.push(...headerErrors.filter(e => e.type === 'error'));
      warnings.push(...headerErrors.filter(e => e.type === 'warning'));
      suggestions.push(...headerErrors.filter(e => e.type === 'info'));

      // Data quality validation
      const qualityErrors = this.validateDataQuality(dataRows, headers);
      warnings.push(...qualityErrors.filter(e => e.type === 'warning'));
      suggestions.push(...qualityErrors.filter(e => e.type === 'info'));

      // Type detection and suggestions
      const estimatedTypes = this.options.autoDetectTypes 
        ? this.detectColumnTypes(dataRows, headers)
        : {};

      const typeErrors = this.validateTypes(dataRows, headers, estimatedTypes);
      suggestions.push(...typeErrors);

      // Custom validation
      for (const validator of this.options.customValidators) {
        try {
          const customErrors = validator.validate(dataRows, headers);
          errors.push(...customErrors.filter(e => e.type === 'error'));
          warnings.push(...customErrors.filter(e => e.type === 'warning'));
          suggestions.push(...customErrors.filter(e => e.type === 'info'));
        } catch (err) {
          warnings.push({
            type: 'warning',
            code: 'CUSTOM_VALIDATOR_ERROR',
            message: `Custom validator "${validator.name}" failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
          });
        }
      }

      // Generate cleaned data if there are fixable issues
      const cleanedData = this.generateCleanedData(dataRows, headers, errors, warnings);

      // Count empty rows
      const emptyRows = dataRows.filter(row => 
        Object.values(row).every(val => val === null || val === undefined || val === '')
      ).length;

      // Find duplicate headers
      const duplicateHeaders = headers.filter((header, index) => 
        headers.indexOf(header) !== index
      );

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions,
        metadata: {
          totalRows: dataRows.length,
          totalColumns: headers.length,
          headers,
          encoding: this.options.encoding,
          delimiter: meta.delimiter || this.options.delimiter,
          hasHeaders: headers.length > 0,
          emptyRows,
          duplicateHeaders,
          fileSize: file.size,
          estimatedTypes,
        },
        sampleData: dataRows.slice(0, 10), // First 10 rows for preview
        ...(cleanedData.length !== dataRows.length && { cleanedData }),
        originalMetadata: {
          name: file.name,
          size: file.size,
          type: file.type || 'text/csv'
        }
      };

    } catch (error) {
      errors.push({
        type: 'error',
        code: 'VALIDATION_FAILED',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });

      return {
        isValid: false,
        errors,
        warnings,
        suggestions,
        metadata: {
          totalRows: 0,
          totalColumns: 0,
          headers: [],
          encoding: this.options.encoding,
          delimiter: this.options.delimiter,
          hasHeaders: false,
          emptyRows: 0,
          duplicateHeaders: [],
          fileSize: file.size,
          estimatedTypes: {},
        },
        sampleData: [],
      };
    }
  }

  /**
   * Parse CSV file with error handling
   */
  private parseCSV(file: File): Promise<Papa.ParseResult<CSVRow>> {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: this.options.skipEmptyLines,
        delimiter: this.options.delimiter === 'auto' ? undefined : this.options.delimiter,
        encoding: this.options.encoding,
        complete: resolve,
        error: reject,
      });
    });
  }

  /**
   * Validate file type
   */
  private isValidCSVFile(file: File): boolean {
    const validTypes = ['text/csv', 'text/plain', 'application/csv'];
    const validExtensions = ['.csv', '.txt'];
    
    return validTypes.includes(file.type) || 
           validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
  }

  /**
   * Validate basic CSV structure
   */
  private validateStructure(data: CSVRow[], headers: string[]): CSVValidationError[] {
    const errors: CSVValidationError[] = [];

    // Row count validation
    if (data.length === 0) {
      errors.push({
        type: 'error',
        code: 'NO_DATA',
        message: 'CSV file contains no data rows',
        suggestion: 'Ensure your CSV file contains at least one data row',
      });
    } else if (data.length > this.options.maxRows) {
      errors.push({
        type: 'error',
        code: 'TOO_MANY_ROWS',
        message: `CSV contains ${data.length} rows, exceeding maximum of ${this.options.maxRows}`,
        suggestion: 'Consider splitting the file or increase the row limit',
      });
    } else if (data.length > 10000) {
      errors.push({
        type: 'warning',
        code: 'LARGE_DATASET',
        message: `Large dataset with ${data.length} rows may impact performance`,
        suggestion: 'Consider sampling rows for initial schema generation',
      });
    }

    // Column count validation
    if (headers.length > this.options.maxColumns) {
      errors.push({
        type: 'error',
        code: 'TOO_MANY_COLUMNS',
        message: `CSV contains ${headers.length} columns, exceeding maximum of ${this.options.maxColumns}`,
        suggestion: 'Consider removing unnecessary columns or increase the column limit',
      });
    }

    // Header requirement validation
    if (this.options.requireHeaders && headers.length === 0) {
      errors.push({
        type: 'error',
        code: 'NO_HEADERS',
        message: 'CSV file must contain column headers',
        suggestion: 'Add column headers as the first row of your CSV file',
        autoFixable: true,
      });
    }

    return errors;
  }

  /**
   * Validate CSV headers
   */
  private validateHeaders(headers: string[]): CSVValidationError[] {
    const errors: CSVValidationError[] = [];

    // Check for empty headers
    const emptyHeaders = headers.filter(header => !header || header.trim() === '');

    if (emptyHeaders.length > 0) {
      errors.push({
        type: 'warning',
        code: 'EMPTY_HEADERS',
        message: `Found ${emptyHeaders.length} empty header(s)`,
        suggestion: 'Replace empty headers with descriptive column names',
        autoFixable: true,
      });
    }

    // Check for duplicate headers
    const duplicates = headers.filter((header, index) => 
      headers.indexOf(header) !== index
    );

    if (duplicates.length > 0 && !this.options.allowDuplicateHeaders) {
      errors.push({
        type: 'error',
        code: 'DUPLICATE_HEADERS',
        message: `Found duplicate headers: ${duplicates.join(', ')}`,
        suggestion: 'Ensure all column headers are unique',
        autoFixable: true,
      });
    }

    // Check for problematic header names
    headers.forEach(header => {
      if (header) {
        // SQL reserved words
        const sqlReserved = ['select', 'from', 'where', 'order', 'group', 'by', 'having', 'insert', 'update', 'delete', 'create', 'drop', 'alter', 'table', 'database', 'index', 'view', 'trigger', 'procedure', 'function'];
        if (sqlReserved.includes(header.toLowerCase())) {
          errors.push({
            type: 'warning',
            code: 'SQL_RESERVED_WORD',
            message: `Header "${header}" is a SQL reserved word`,
            column: header,
            suggestion: `Consider renaming to "${header}_column" or "${header}_field"`,
            autoFixable: true,
          });
        }

        // Special characters that may cause issues
        if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(header)) {
          errors.push({
            type: 'info',
            code: 'HEADER_NAMING',
            message: `Header "${header}" contains special characters or doesn't follow naming conventions`,
            column: header,
            suggestion: 'Use alphanumeric characters and underscores only, starting with a letter',
            autoFixable: true,
          });
        }

        // Very long headers
        if (header.length > 63) {
          errors.push({
            type: 'warning',
            code: 'HEADER_TOO_LONG',
            message: `Header "${header}" exceeds PostgreSQL identifier limit (63 characters)`,
            column: header,
            suggestion: 'Shorten the header name or use abbreviations',
            autoFixable: true,
          });
        }
      }
    });

    return errors;
  }

  /**
   * Validate data quality
   */
  private validateDataQuality(data: CSVRow[], headers: string[]): CSVValidationError[] {
    const errors: CSVValidationError[] = [];

    // Check for completely empty rows
    const emptyRows = data.filter(row => 
      Object.values(row).every(val => val === null || val === undefined || val === '')
    ).length;

    if (emptyRows > 0 && !this.options.allowEmptyRows) {
      errors.push({
        type: 'warning',
        code: 'EMPTY_ROWS',
        message: `Found ${emptyRows} completely empty row(s)`,
        suggestion: 'Remove empty rows or enable allowEmptyRows option',
        autoFixable: true,
      });
    }

    // Check for missing data per column
    headers.forEach(header => {
      const missingCount = data.filter(row => 
        row[header] === null || row[header] === undefined || row[header] === ''
      ).length;

      const missingPercentage = (missingCount / data.length) * 100;

      if (missingPercentage > 50) {
        errors.push({
          type: 'warning',
          code: 'HIGH_MISSING_DATA',
          message: `Column "${header}" has ${missingPercentage.toFixed(1)}% missing values`,
          column: header,
          suggestion: 'Consider providing default values or making this column optional',
        });
      } else if (missingPercentage > 20) {
        errors.push({
          type: 'info',
          code: 'MODERATE_MISSING_DATA',
          message: `Column "${header}" has ${missingPercentage.toFixed(1)}% missing values`,
          column: header,
          suggestion: 'Review data collection process for this column',
        });
      }
    });

    // Check for inconsistent data formats per column
    headers.forEach(header => {
      const values = data.map(row => row[header]).filter(val => val !== null && val !== undefined && val !== '');
      const uniqueFormats = new Set(values.map(val => this.detectValueFormat(val)));

      if (uniqueFormats.size > 1) {
        errors.push({
          type: 'info',
          code: 'INCONSISTENT_FORMAT',
          message: `Column "${header}" has inconsistent data formats: ${Array.from(uniqueFormats).join(', ')}`,
          column: header,
          suggestion: 'Standardize the data format for this column',
        });
      }
    });

    return errors;
  }

  /**
   * Detect column data types
   */
  private detectColumnTypes(data: CSVRow[], headers: string[]): Record<string, string> {
    const types: Record<string, string> = {};

    headers.forEach(header => {
      const values = data.map(row => row[header]).filter(val => val !== null && val !== undefined && val !== '');
      
      if (values.length === 0) {
        types[header] = 'TEXT';
        return;
      }

      // Test for specific types
      const isUUID = values.every(val => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(val)));
      const isEmail = values.every(val => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val)));
      const isURL = values.every(val => /^https?:\/\/.+/.test(String(val)));
      const isInteger = values.every(val => /^-?\d+$/.test(String(val)));
      const isDecimal = values.every(val => /^-?\d+\.?\d*$/.test(String(val)));
      const isBoolean = values.every(val => /^(true|false|yes|no|1|0)$/i.test(String(val)));
      const isDate = values.every(val => !isNaN(Date.parse(String(val))));
      const isJSON = values.every(val => {
        try {
          JSON.parse(String(val));
          return true;
        } catch {
          return false;
        }
      });

      if (isUUID) {
        types[header] = 'UUID';
      } else if (isEmail) {
        types[header] = 'VARCHAR(255)'; // Email
      } else if (isURL) {
        types[header] = 'TEXT'; // URL
      } else if (isInteger) {
        const maxValue = Math.max(...values.map(val => parseInt(String(val))));
        if (maxValue < 32768) types[header] = 'SMALLINT';
        else if (maxValue < 2147483648) types[header] = 'INTEGER';
        else types[header] = 'BIGINT';
      } else if (isDecimal) {
        types[header] = 'DECIMAL';
      } else if (isBoolean) {
        types[header] = 'BOOLEAN';
      } else if (isJSON) {
        types[header] = 'JSONB';
      } else if (isDate) {
        types[header] = 'TIMESTAMPTZ';
      } else {
        // Determine TEXT vs VARCHAR based on length
        const maxLength = Math.max(...values.map(val => String(val).length));
        if (maxLength <= 255) {
          types[header] = `VARCHAR(${Math.max(maxLength * 1.2, 50)})`; // Add 20% padding
        } else {
          types[header] = 'TEXT';
        }
      }
    });

    return types;
  }

  /**
   * Validate detected types and suggest improvements
   */
  private validateTypes(data: CSVRow[], headers: string[], estimatedTypes: Record<string, string>): CSVValidationError[] {
    const suggestions: CSVValidationError[] = [];

    headers.forEach(header => {
      const values = data.map(row => row[header]).filter(val => val !== null && val !== undefined && val !== '');
      const estimatedType = estimatedTypes[header];

      // Suggest primary key candidates
      const uniqueValues = new Set(values);
      if (uniqueValues.size === values.length && values.length > 0) {
        suggestions.push({
          type: 'info',
          code: 'PRIMARY_KEY_CANDIDATE',
          message: `Column "${header}" has unique values and could be a primary key`,
          column: header,
          suggestion: 'Consider making this column a primary key if it uniquely identifies records',
        });
      }

      // Suggest foreign key relationships
      if (header.toLowerCase().endsWith('_id') && estimatedType?.includes('INT')) {
        suggestions.push({
          type: 'info',
          code: 'FOREIGN_KEY_CANDIDATE',
          message: `Column "${header}" appears to be a foreign key reference`,
          column: header,
          suggestion: 'Consider defining a foreign key relationship to the referenced table',
        });
      }

      // Suggest indexes for frequently queried columns
      if (header.toLowerCase().includes('email') || header.toLowerCase().includes('username')) {
        suggestions.push({
          type: 'info',
          code: 'INDEX_CANDIDATE',
          message: `Column "${header}" would benefit from an index for faster queries`,
          column: header,
          suggestion: 'Add an index to improve query performance for this column',
        });
      }

      // Suggest constraints
      if (estimatedType === 'VARCHAR(255)' && header.toLowerCase().includes('email')) {
        suggestions.push({
          type: 'info',
          code: 'EMAIL_VALIDATION',
          message: `Column "${header}" could use email validation constraint`,
          column: header,
          suggestion: 'Add a CHECK constraint to validate email format',
        });
      }
    });

    return suggestions;
  }

  /**
   * Generate cleaned data by applying auto-fixes
   */
  private generateCleanedData(data: CSVRow[], headers: string[], errors: CSVValidationError[], warnings: CSVValidationError[]): CSVRow[] {
    let cleanedData = [...data];

    // Remove empty rows if not allowed
    if (!this.options.allowEmptyRows) {
      cleanedData = cleanedData.filter(row => 
        !Object.values(row).every(val => val === null || val === undefined || val === '')
      );
    }

    // Apply header fixes if needed
    const headerFixes = [...errors, ...warnings].filter(e => e.autoFixable && e.column);
    
    if (headerFixes.length > 0) {
      // This would require header renaming, which is complex
      // For now, just return the data as-is
    }

    return cleanedData;
  }

  /**
   * Detect the format of a value
   */
  private detectValueFormat(value: string | number | boolean | null): string {
    if (value === null) return 'null';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    
    const str = String(value);
    
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return 'date';
    if (/^-?\d+$/.test(str)) return 'integer';
    if (/^-?\d+\.\d+$/.test(str)) return 'decimal';
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) return 'email';
    if (/^https?:\/\//.test(str)) return 'url';
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)) return 'uuid';
    
    return 'text';
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
}

/**
 * Built-in custom validators
 */
export const csvValidators = {
  /**
   * Validates that email columns contain valid email addresses
   */
  emailValidator: {
    name: 'Email Validator',
    validate: (data: CSVRow[], headers: string[]): CSVValidationError[] => {
      const errors: CSVValidationError[] = [];
      const emailColumns = headers.filter(h => h.toLowerCase().includes('email'));

      emailColumns.forEach(column => {
        data.forEach((row, rowIndex) => {
          const value = row[column];
          if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
            errors.push({
              type: 'warning',
              code: 'INVALID_EMAIL',
              message: `Invalid email format in "${column}": ${value}`,
              row: rowIndex + 1,
              column,
              suggestion: 'Ensure email addresses follow the format: user@domain.com',
            });
          }
        });
      });

      return errors;
    },
  },

  /**
   * Validates that date columns contain valid dates
   */
  dateValidator: {
    name: 'Date Validator',
    validate: (data: CSVRow[], headers: string[]): CSVValidationError[] => {
      const errors: CSVValidationError[] = [];
      const dateColumns = headers.filter(h => 
        h.toLowerCase().includes('date') || 
        h.toLowerCase().includes('time') ||
        h.toLowerCase().includes('created') ||
        h.toLowerCase().includes('updated')
      );

      dateColumns.forEach(column => {
        data.forEach((row, rowIndex) => {
          const value = row[column];
          if (value && isNaN(Date.parse(String(value)))) {
            errors.push({
              type: 'warning',
              code: 'INVALID_DATE',
              message: `Invalid date format in "${column}": ${value}`,
              row: rowIndex + 1,
              column,
              suggestion: 'Use ISO date format (YYYY-MM-DD) or ensure dates are properly formatted',
            });
          }
        });
      });

      return errors;
    },
  },
};