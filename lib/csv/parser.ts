import Papa from 'papaparse';
import { generateId } from '@/lib/utils/index';
import { CSV_DEFAULTS, FILE_SIZE_LIMITS } from '@/lib/constants';
import type { 
  CSVParseConfig, 
  CSVParseResult, 
  CSVParseError, 
  CSVColumn,
  DelimiterType,
  EncodingType 
} from '@/types/csv.types';

/**
 * Detects the most likely delimiter by analyzing the first few lines
 */
export function detectDelimiter(csvText: string): DelimiterType {
  const lines = csvText.split('\n').slice(0, 5); // Check first 5 lines
  const delimiters = CSV_DEFAULTS.SUPPORTED_DELIMITERS;
  const scores: Record<DelimiterType, number> = { ',': 0, ';': 0, '\t': 0, '|': 0 };
  
  for (const line of lines) {
    for (const delimiter of delimiters) {
      const parts = line.split(delimiter);
      if (parts.length > 1) {
        scores[delimiter] += parts.length;
      }
    }
  }
  
  // Return delimiter with highest score, defaulting to comma
  let bestDelimiter: DelimiterType = ',';
  let bestScore = 0;
  
  for (const [delimiter, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delimiter as DelimiterType;
    }
  }
  
  return bestDelimiter;
}

/**
 * Detects file encoding (basic detection)
 */
export function detectEncoding(buffer: ArrayBuffer): EncodingType {
  const bytes = new Uint8Array(buffer);
  
  // Check for BOM markers
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return 'UTF-8';
  }
  
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return 'UTF-16';
  }
  
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return 'UTF-16';
  }
  
  // Basic ASCII check
  let asciiCount = 0;
  const sampleSize = Math.min(1000, bytes.length);
  
  for (let i = 0; i < sampleSize; i++) {
    if (bytes[i] < 128) {
      asciiCount++;
    }
  }
  
  const asciiRatio = asciiCount / sampleSize;
  
  if (asciiRatio > 0.95) {
    return 'ASCII';
  }
  
  // Default to UTF-8 for everything else
  return 'UTF-8';
}

/**
 * Reads file content with encoding detection
 */
export function readFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      if (!event.target?.result) {
        reject(new Error('Failed to read file'));
        return;
      }
      
      // First, detect encoding from the buffer
      const buffer = event.target.result as ArrayBuffer;
      const encoding = detectEncoding(buffer);
      
      // Now read as text with detected encoding
      const textReader = new FileReader();
      textReader.onload = (textEvent) => {
        if (typeof textEvent.target?.result === 'string') {
          resolve(textEvent.target.result);
        } else {
          reject(new Error('Failed to read file as text'));
        }
      };
      
      textReader.onerror = () => reject(new Error('Failed to read file as text'));
      
      // Read with appropriate encoding
      if (encoding === 'UTF-16') {
        textReader.readAsText(file, 'UTF-16');
      } else {
        textReader.readAsText(file, 'UTF-8');
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Analyzes CSV columns to extract metadata
 */
export function analyzeColumns(
  headers: string[], 
  data: (string | null)[][], 
  sampleSize: number
): CSVColumn[] {
  return headers.map((header, index) => {
    const values = data.slice(0, sampleSize).map(row => row[index]);
    const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '') as string[];
    const uniqueValues = new Set(nonNullValues);
    
    return {
      index,
      name: header.trim(),
      originalName: header,
      sampleValues: values.slice(0, 20), // First 20 values for preview
      uniqueValues,
      nullCount: values.length - nonNullValues.length,
      emptyCount: values.filter(v => v === '').length,
      totalCount: values.length
    };
  });
}

/**
 * Validates CSV data for common issues
 */
export function validateCSVData(headers: string[], data: (string | null)[][]): CSVParseError[] {
  const errors: CSVParseError[] = [];
  
  // Check for empty headers
  headers.forEach((header, index) => {
    if (!header || header.trim() === '') {
      errors.push({
        row: 0,
        column: index,
        message: `Empty header in column ${index + 1}`,
        type: 'warning',
        code: 'EMPTY_HEADER'
      });
    }
  });
  
  // Check for duplicate headers
  const headerCounts = new Map<string, number>();
  headers.forEach((header, index) => {
    const normalizedHeader = header.trim().toLowerCase();
    const count = headerCounts.get(normalizedHeader) || 0;
    headerCounts.set(normalizedHeader, count + 1);
    
    if (count > 0) {
      errors.push({
        row: 0,
        column: index,
        message: `Duplicate header: "${header}"`,
        type: 'warning',
        code: 'DUPLICATE_HEADER'
      });
    }
  });
  
  // Check for inconsistent column counts
  const expectedColumnCount = headers.length;
  data.forEach((row, rowIndex) => {
    if (row.length !== expectedColumnCount) {
      errors.push({
        row: rowIndex + 1,
        message: `Row ${rowIndex + 1} has ${row.length} columns, expected ${expectedColumnCount}`,
        type: 'warning',
        code: 'INCONSISTENT_COLUMNS'
      });
    }
  });
  
  // Check for completely empty rows
  data.forEach((row, rowIndex) => {
    if (row.every(cell => !cell || cell.trim() === '')) {
      errors.push({
        row: rowIndex + 1,
        message: `Row ${rowIndex + 1} is completely empty`,
        type: 'warning',
        code: 'EMPTY_ROW'
      });
    }
  });
  
  return errors;
}

/**
 * Main CSV parsing function
 */
export async function parseCSV(
  file: File, 
  config: Partial<CSVParseConfig> = {}
): Promise<CSVParseResult> {
  const fullConfig: CSVParseConfig = {
    hasHeader: true,
    skipEmptyLines: true,
    trimWhitespace: true,
    sampleSize: CSV_DEFAULTS.SAMPLE_SIZE,
    maxFileSize: FILE_SIZE_LIMITS.MAX_FILE_SIZE,
    ...config
  };
  
  // Validate file size
  if (file.size > (fullConfig.maxFileSize || FILE_SIZE_LIMITS.MAX_FILE_SIZE)) {
    throw new Error(`File size (${file.size} bytes) exceeds maximum allowed size`);
  }
  
  // Read file content
  const content = await readFileContent(file);
  
  // Auto-detect delimiter if not provided
  const delimiter = fullConfig.delimiter || detectDelimiter(content);
  
  return new Promise((resolve, reject) => {
    const parseConfig: Papa.ParseConfig<string[]> = {
      delimiter,
      header: false, // We'll handle headers ourselves for better control
      skipEmptyLines: fullConfig.skipEmptyLines,
      ...(fullConfig.trimWhitespace && { transform: (value: string) => value.trim() }),
      complete: (results) => {
        try {
          const allData = results.data as string[][];
          
          if (allData.length === 0) {
            reject(new Error('CSV file is empty'));
            return;
          }
          
          // Extract headers
          const headers = fullConfig.hasHeader ? allData[0] : 
            allData[0].map((_, index) => `Column_${index + 1}`);
          
          // Extract data (skip header row if present)
          const data = fullConfig.hasHeader ? allData.slice(1) : allData;
          
          // Limit to sample size for analysis
          const sampledData = data.slice(0, fullConfig.sampleSize);
          
          // Convert empty strings to null
          const processedData = sampledData.map(row => 
            row.map(cell => cell === '' ? null : cell)
          );
          
          // Analyze columns
          const columns = analyzeColumns(headers, processedData, fullConfig.sampleSize || CSV_DEFAULTS.SAMPLE_SIZE);
          
          // Validate data
          const parseErrors = validateCSVData(headers, processedData);
          
          // Add Papa Parse errors
          if (results.errors && results.errors.length > 0) {
            results.errors.forEach(error => {
              parseErrors.push({
                row: error.row || 0,
                message: error.message,
                type: 'error',
                code: error.code || 'PARSE_ERROR'
              });
            });
          }
          
          const result: CSVParseResult = {
            id: generateId(),
            fileName: file.name,
            headers,
            data: processedData,
            totalRows: data.length,
            sampledRows: processedData.length,
            columns,
            config: { ...fullConfig, delimiter },
            parseErrors,
            timestamp: new Date()
          };
          
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to process CSV: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      }
    };
    
    try {
      Papa.parse(content, parseConfig);
    } catch (error) {
      reject(new Error(`CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  });
}

/**
 * Parses multiple CSV files
 */
export async function parseMultipleCSVs(
  files: File[], 
  config: Partial<CSVParseConfig> = {}
): Promise<CSVParseResult[]> {
  const results: CSVParseResult[] = [];
  const errors: Error[] = [];
  
  for (const file of files) {
    try {
      const result = await parseCSV(file, config);
      results.push(result);
    } catch (error) {
      errors.push(new Error(`Failed to parse ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }
  
  if (errors.length > 0 && results.length === 0) {
    throw new Error(`All files failed to parse:\n${errors.map(e => e.message).join('\n')}`);
  }
  
  if (errors.length > 0) {
    console.warn('Some files failed to parse:', errors);
  }
  
  return results;
}

/**
 * Utility to get a preview of CSV data
 */
export function getCSVPreview(
  parseResult: CSVParseResult, 
  maxRows: number = CSV_DEFAULTS.MAX_PREVIEW_ROWS
): {
  headers: string[];
  rows: (string | null)[][];
  totalRows: number;
  showingRows: number;
} {
  const rows = parseResult.data.slice(0, maxRows);
  
  return {
    headers: parseResult.headers,
    rows,
    totalRows: parseResult.totalRows,
    showingRows: rows.length
  };
}