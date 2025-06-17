/**
 * Hook for streaming data seeding progress via Server-Sent Events
 * Phase 10: Data Seeding & Large File Processing
 */

import { useState, useCallback, useRef, useEffect } from "react";
import type { SeedingProgress, SeedingJob, SeedingAPIResponse } from "@/types/seeding.types";
import { generateId } from "@/lib/utils";
import { ProjectStorage } from "@/lib/storage/project-storage";
import { getSupabaseOAuth } from "@/lib/supabase/oauth";

interface SeedingStreamOptions {
  onProgress?: (progress: SeedingProgress) => void;
  onComplete?: (result: SeedingAPIResponse<unknown>) => void;
  onError?: (error: Error) => void;
}

interface SeedingStreamState {
  isConnected: boolean;
  isProcessing: boolean;
  progress: SeedingProgress | null;
  error: Error | null;
  result: SeedingAPIResponse<unknown> | null;
}

export function useSeedingStream(options: SeedingStreamOptions = {}) {
  const [state, setState] = useState<SeedingStreamState>({
    isConnected: false,
    isProcessing: false,
    progress: null,
    error: null,
    result: null,
  });

  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const { onProgress, onComplete, onError } = options;

  // Cleanup function
  const cleanup = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.cancel().catch(console.error);
      readerRef.current = null;
    }
    setState(prev => ({
      ...prev,
      isConnected: false,
      isProcessing: false,
    }));
  }, []);

  // Start seeding with streaming progress
  const startSeeding = useCallback(async (job: SeedingJob) => {
    try {
      cleanup(); // Clean up any existing connections

      const jobId = generateId();
      jobIdRef.current = jobId;

      setState(prev => ({
        ...prev,
        isProcessing: true,
        error: null,
        result: null,
        progress: null,
      }));

      // Get OAuth token from client-side
      const oauth = getSupabaseOAuth();
      const oauthState = oauth.getState();
      
      if (!oauthState.isConnected || !oauthState.accessToken) {
        throw new Error("Not authenticated with Supabase. Please connect your Supabase account first.");
      }

      // Get the project ID from multiple sources with fallback to localStorage
      const projectId = ProjectStorage.getProjectId(job.schema.projectId || job.projectId);
      
      if (!projectId) {
        throw new Error("No project ID found. Please ensure you've deployed your schema first and try refreshing the page.");
      }

      // First, ensure the Edge Function exists in the user's project
      const createFunctionResponse = await fetch("/api/seeding/create-function", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${oauthState.accessToken}`,
        },
        body: JSON.stringify({ projectId }),
      });

      if (!createFunctionResponse.ok) {
        const errorData = await createFunctionResponse.json();
        throw new Error(`Failed to create Edge Function: ${errorData.error}`);
      }

      // Prepare request payload for the seeding job
      const jobData = {
        fileId: job.fileUpload?.id || "",
        jobId,
        configuration: job.configuration,
        schema: job.schema,
        fileUpload: job.fileUpload ? {
          storagePath: job.fileUpload.storagePath,
          filename: job.fileUpload.filename,
          size: job.fileUpload.size,
        } : undefined,
      };

      // Start the seeding job via our API route (streaming)
      const streamUrl = `/api/seeding/start?stream=true`;
      
      // First, send the POST request to initiate seeding
      const response = await fetch(streamUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${oauthState.accessToken}`,
        },
        body: JSON.stringify({
          projectId,
          jobData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to start seeding: ${errorData.error || response.statusText}`);
      }

      // Create a reader for the streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Failed to get response stream");
      }

      readerRef.current = reader;

      setState(prev => ({
        ...prev,
        isConnected: true,
      }));

      // Process the streaming response
      const decoder = new TextDecoder();
      let buffer = ''; // Buffer for incomplete messages
      
      const processStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              cleanup();
              break;
            }

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk; // Add to buffer
            
            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep the last incomplete line in buffer
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6); // Remove 'data: ' prefix
                
                if (data === '[DONE]') {
                  cleanup();
                  return;
                }

                try {
                  const message = JSON.parse(data);

                  switch (message.type) {
                    case "progress":
                      const progress = message.data as SeedingProgress;
                      setState(prev => ({
                        ...prev,
                        progress,
                      }));
                      onProgress?.(progress);
                      break;

                    case "complete":
                      const result = message.data as SeedingAPIResponse<unknown>;
                      setState(prev => ({
                        ...prev,
                        result,
                        isProcessing: false,
                      }));
                      onComplete?.(result);
                      cleanup();
                      break;

                    case "error":
                      const errorResult = message.data as SeedingAPIResponse<unknown>;
                      const error = new Error(errorResult.error?.message || "Seeding failed");
                      setState(prev => ({
                        ...prev,
                        error,
                        isProcessing: false,
                      }));
                      onError?.(error);
                      cleanup();
                      break;

                    default:
                      console.warn("Unknown message type:", message.type);
                  }
                } catch (parseError) {
                  console.error("Failed to parse SSE message:", parseError, "Data:", data);
                  // Don't fail the entire stream for one bad message
                  continue;
                }
              }
            }
          }
        } catch (streamError) {
          console.error("Stream processing error:", streamError);
          const error = new Error("Stream processing failed");
          setState(prev => ({
            ...prev,
            error,
            isProcessing: false,
            isConnected: false,
          }));
          onError?.(error);
          cleanup();
        }
      };

      // Start processing the stream
      processStream();

    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to start seeding");
      setState(prev => ({
        ...prev,
        error: err,
        isProcessing: false,
        isConnected: false,
      }));
      onError?.(err);
      cleanup();
    }
  }, [cleanup, onProgress, onComplete, onError]);

  // Stop seeding (abort current operation)
  const stopSeeding = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // Reset state
  const reset = useCallback(() => {
    cleanup();
    setState({
      isConnected: false,
      isProcessing: false,
      progress: null,
      error: null,
      result: null,
    });
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    // State
    isConnected: state.isConnected,
    isProcessing: state.isProcessing,
    progress: state.progress,
    error: state.error,
    result: state.result,
    
    // Actions
    startSeeding,
    stopSeeding,
    reset,
    
    // Utils
    jobId: jobIdRef.current,
  };
}

export type { SeedingStreamOptions, SeedingStreamState };