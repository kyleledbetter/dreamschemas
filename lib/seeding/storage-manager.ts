/**
 * Storage Manager for Phase 10: Data Seeding
 * Handles file uploads, chunking, and storage operations
 */

import { createClient } from "@/lib/supabase/client";
import type {
  FileChunk,
  FileUpload,
  FileMetadata,
  StorageConfig,
  SeedingAPIResponse,
} from "@/types/seeding.types";
import { generateId } from "@/lib/utils";
import { STORAGE_CONFIG } from "./constants";

export class StorageManager {
  private supabase = createClient();
  private config: StorageConfig = {
    bucketName: STORAGE_CONFIG.BUCKET_NAME,
    maxFileSize: STORAGE_CONFIG.MAX_FILE_SIZE,
    allowedMimeTypes: STORAGE_CONFIG.ALLOWED_MIME_TYPES,
    chunkSize: STORAGE_CONFIG.CHUNK_SIZE,
    retentionDays: STORAGE_CONFIG.RETENTION_DAYS,
    enableCompression: STORAGE_CONFIG.ENABLE_COMPRESSION,
  };

  /**
   * Initialize storage bucket and policies
   */
  async initializeStorage(): Promise<SeedingAPIResponse<boolean>> {
    try {
      // Check if bucket exists
      const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();
      
      if (listError) {
        throw new Error(`Failed to list buckets: ${listError.message}`);
      }

      const bucketExists = buckets?.some(bucket => bucket.name === this.config.bucketName);

      if (!bucketExists) {
        // Create bucket with appropriate settings
        const { error: createError } = await this.supabase.storage.createBucket(
          this.config.bucketName,
          {
            public: false,
            allowedMimeTypes: this.config.allowedMimeTypes,
          }
        );

        if (createError) {
          // If bucket already exists, that's fine
          if (createError.message.includes("already exists")) {
            console.log(`Bucket ${this.config.bucketName} already exists, continuing...`);
          } else {
            throw new Error(`Failed to create bucket: ${createError.message}`);
          }
        }
      }

      return {
        success: true,
        data: true,
        metadata: {
          requestId: generateId(),
          timestamp: new Date(),
          version: "1.0.0",
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "STORAGE_INIT_FAILED",
          message: error instanceof Error ? error.message : "Failed to initialize storage",
        },
        metadata: {
          requestId: generateId(),
          timestamp: new Date(),
          version: "1.0.0",
        },
      };
    }
  }

  /**
   * Validate file before upload
   */
  validateFile(file: File): SeedingAPIResponse<boolean> {
    const errors: string[] = [];

    // Check file size
    if (file.size > this.config.maxFileSize) {
      errors.push(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${(this.config.maxFileSize / 1024 / 1024).toFixed(2)}MB)`);
    }

    if (file.size < 1024) {
      errors.push("File is too small (minimum 1KB required)");
    }

    // Check MIME type
    if (!this.config.allowedMimeTypes.includes(file.type) && file.type !== "") {
      errors.push(`File type "${file.type}" is not allowed. Allowed types: ${this.config.allowedMimeTypes.join(", ")}`);
    }

    // Check file extension
    const extension = file.name.toLowerCase().split(".").pop();
    const allowedExtensions = ["csv", "txt"];
    if (!extension || !allowedExtensions.includes(extension)) {
      errors.push(`File extension ".${extension}" is not allowed. Allowed extensions: ${allowedExtensions.map(ext => `.${ext}`).join(", ")}`);
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: "FILE_VALIDATION_FAILED",
          message: "File validation failed",
          details: errors,
        },
      };
    }

    return {
      success: true,
      data: true,
    };
  }

  /**
   * Create file chunks for large file upload
   */
  createFileChunks(file: File, fileId: string): FileChunk[] {
    const chunks: FileChunk[] = [];
    const totalChunks = Math.ceil(file.size / this.config.chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.config.chunkSize;
      const end = Math.min(start + this.config.chunkSize, file.size);
      const chunkData = file.slice(start, end);

      chunks.push({
        id: generateId(),
        fileId,
        chunkNumber: i,
        totalChunks,
        size: chunkData.size,
        data: chunkData,
        uploadStatus: "pending",
        uploadProgress: 0,
      });
    }

    return chunks;
  }

  /**
   * Upload a single chunk
   */
  async uploadChunk(
    chunk: FileChunk,
    userId: string,
    projectId: string,
    onProgress?: (progress: number) => void
  ): Promise<SeedingAPIResponse<boolean>> {
    try {
      const filePath = `${userId}/${projectId}/${chunk.fileId}/chunks/chunk_${chunk.chunkNumber.toString().padStart(4, "0")}`;

      const { error } = await this.supabase.storage
        .from(this.config.bucketName)
        .upload(filePath, chunk.data, {
          upsert: true,
          duplex: "half",
        });

      if (error) {
        throw new Error(`Failed to upload chunk: ${error.message}`);
      }

      onProgress?.(100);

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "CHUNK_UPLOAD_FAILED",
          message: error instanceof Error ? error.message : "Failed to upload chunk",
          details: { chunkNumber: chunk.chunkNumber, chunkId: chunk.id },
        },
      };
    }
  }

  /**
   * Upload file with chunking and progress tracking
   */
  async uploadFile(
    file: File,
    userId: string,
    projectId: string,
    onProgress?: (fileUpload: FileUpload) => void
  ): Promise<SeedingAPIResponse<FileUpload>> {
    try {
      // Validate file first
      const validation = this.validateFile(file);
      if (!validation.success) {
        return validation as SeedingAPIResponse<FileUpload>;
      }

      const fileId = generateId();
      const chunks = this.createFileChunks(file, fileId);

      // Generate file metadata
      const metadata = await this.generateFileMetadata(file);

      const fileUpload: FileUpload = {
        id: fileId,
        userId,
        projectId,
        filename: `${fileId}.csv`,
        originalName: file.name,
        size: file.size,
        mimeType: file.type || "text/csv",
        storagePath: `${userId}/${projectId}/${fileId}`,
        uploadStatus: "pending",
        chunks,
        totalChunks: chunks.length,
        completedChunks: 0,
        uploadProgress: 0,
        metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      onProgress?.(fileUpload);

      // Upload chunks in parallel (with concurrency limit)
      const concurrency = 3;

      for (let i = 0; i < chunks.length; i += concurrency) {
        const chunkBatch = chunks.slice(i, i + concurrency);
        
        const batchPromises = chunkBatch.map(async (chunk) => {
          const result = await this.uploadChunk(chunk, userId, projectId, (progress) => {
            chunk.uploadProgress = progress;
            chunk.uploadStatus = progress === 100 ? "completed" : "uploading";
            
            // Update overall progress
            const completedChunks = chunks.filter(c => c.uploadStatus === "completed").length;
            fileUpload.completedChunks = completedChunks;
            fileUpload.uploadProgress = (completedChunks / chunks.length) * 100;
            fileUpload.updatedAt = new Date();
            
            onProgress?.(fileUpload);
          });

          if (!result.success) {
            chunk.uploadStatus = "failed";
            chunk.error = result.error?.message;
            throw new Error(result.error?.message || "Chunk upload failed");
          }
        });

        await Promise.all(batchPromises);
      }

      // Merge chunks into final file
      await this.mergeChunks(fileUpload, file);

      fileUpload.uploadStatus = "completed";
      fileUpload.uploadProgress = 100;
      fileUpload.updatedAt = new Date();
      
      onProgress?.(fileUpload);

      return {
        success: true,
        data: fileUpload,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "FILE_UPLOAD_FAILED",
          message: error instanceof Error ? error.message : "Failed to upload file",
        },
      };
    }
  }

  /**
   * Merge uploaded chunks into final file
   */
  private async mergeChunks(fileUpload: FileUpload, originalFile: File): Promise<void> {
    const finalPath = `${fileUpload.storagePath}/${fileUpload.filename}`;

    // For now, upload the original file directly as well
    // In a production environment, you'd merge the chunks server-side
    const { error } = await this.supabase.storage
      .from(this.config.bucketName)
      .upload(finalPath, originalFile, {
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to create final file: ${error.message}`);
    }

    // Store metadata
    const metadataPath = `${fileUpload.storagePath}/metadata.json`;
    const { error: metadataError } = await this.supabase.storage
      .from(this.config.bucketName)
      .upload(metadataPath, JSON.stringify(fileUpload.metadata, null, 2), {
        upsert: true,
        contentType: "application/json",
      });

    if (metadataError) {
      console.warn("Failed to upload metadata:", metadataError.message);
    }
  }

  /**
   * Generate file metadata by parsing headers and sample data
   */
  private async generateFileMetadata(file: File): Promise<FileMetadata> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const lines = content.split("\n").filter(line => line.trim());
          
          if (lines.length === 0) {
            throw new Error("File appears to be empty");
          }

          // Detect delimiter
          const firstLine = lines[0];
          const delimiters = [",", ";", "\t", "|"];
          const delimiter = delimiters.reduce((best, delim) => {
            const count = (firstLine.match(new RegExp(delim, "g")) || []).length;
            const bestCount = (firstLine.match(new RegExp(best, "g")) || []).length;
            return count > bestCount ? delim : best;
          }, ",");

          // Parse headers
          const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^["']|["']$/g, ""));

          // Parse sample rows
          const sampleRows: Record<string, unknown>[] = [];
          const maxSamples = Math.min(100, lines.length - 1);
          
          for (let i = 1; i <= maxSamples; i++) {
            if (lines[i]) {
              const values = lines[i].split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ""));
              const row: Record<string, unknown> = {};
              
              headers.forEach((header, index) => {
                row[header] = values[index] || null;
              });
              
              sampleRows.push(row);
            }
          }

          // Estimate types
          const estimatedTypes: Record<string, string> = {};
          headers.forEach(header => {
            const values = sampleRows.map(row => row[header]).filter(v => v !== null && v !== "");
            estimatedTypes[header] = this.inferColumnType(values);
          });

          resolve({
            headers,
            totalRows: lines.length - 1, // Subtract header row
            sampleRows,
            estimatedTypes,
            encoding: "utf-8",
            delimiter,
            hasHeader: true,
            fileSize: file.size,
            checksums: {
              md5: "", // Would calculate in production
              sha256: "", // Would calculate in production
            },
          });
        } catch {
          // Fallback metadata
          resolve({
            headers: [],
            totalRows: 0,
            sampleRows: [],
            estimatedTypes: {},
            encoding: "utf-8",
            delimiter: ",",
            hasHeader: false,
            fileSize: file.size,
            checksums: {
              md5: "",
              sha256: "",
            },
          });
        }
      };

      // Read first 50KB for metadata analysis
      const blob = file.slice(0, 50 * 1024);
      reader.readAsText(blob);
    });
  }

  /**
   * Infer column type from sample values
   */
  private inferColumnType(values: unknown[]): string {
    if (values.length === 0) return "TEXT";

    const nonEmptyValues = values.filter(v => v !== null && v !== "" && v !== undefined);
    if (nonEmptyValues.length === 0) return "TEXT";

    // Check for UUIDs
    if (nonEmptyValues.every(v => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v))) {
      return "UUID";
    }

    // Check for integers
    if (nonEmptyValues.every(v => /^-?\d+$/.test(v))) {
      return "INTEGER";
    }

    // Check for decimals
    if (nonEmptyValues.every(v => /^-?\d+(\.\d+)?$/.test(v))) {
      return "DECIMAL";
    }

    // Check for booleans
    if (nonEmptyValues.every(v => /^(true|false|yes|no|1|0|on|off)$/i.test(v))) {
      return "BOOLEAN";
    }

    // Check for dates
    if (nonEmptyValues.every(v => !isNaN(Date.parse(v)))) {
      return "TIMESTAMPTZ";
    }

    // Default to text
    return "TEXT";
  }

  /**
   * Get file download URL
   */
  async getFileUrl(filePath: string): Promise<SeedingAPIResponse<string>> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.config.bucketName)
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (error) {
        throw new Error(`Failed to get file URL: ${error.message}`);
      }

      return {
        success: true,
        data: data.signedUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "FILE_URL_FAILED",
          message: error instanceof Error ? error.message : "Failed to get file URL",
        },
      };
    }
  }

  /**
   * Delete file and its chunks
   */
  async deleteFile(filePath: string): Promise<SeedingAPIResponse<boolean>> {
    try {
      // Delete main file
      const { error: fileError } = await this.supabase.storage
        .from(this.config.bucketName)
        .remove([filePath]);

      if (fileError) {
        console.warn("Failed to delete main file:", fileError.message);
      }

      // Delete chunks directory
      const { error: chunksError } = await this.supabase.storage
        .from(this.config.bucketName)
        .remove([`${filePath}/chunks`]);

      if (chunksError) {
        console.warn("Failed to delete chunks:", chunksError.message);
      }

      return {
        success: true,
        data: true,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "FILE_DELETE_FAILED",
          message: error instanceof Error ? error.message : "Failed to delete file",
        },
      };
    }
  }
}

// Singleton instance
export const storageManager = new StorageManager();