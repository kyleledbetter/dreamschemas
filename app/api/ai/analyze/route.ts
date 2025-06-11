import { NextRequest } from 'next/server';
import { SchemaAnalyzer, validateAIAnalysis } from '../../../../lib/ai/schema-analyzer';
import type { CSVParseResult } from '../../../../types/csv.types';

// Rate limiting configuration
const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // Max 10 requests per minute per IP
};

// Request timeout - increased to handle larger datasets
const REQUEST_TIMEOUT = 120000; // 2 minutes

// Simple in-memory rate limiting (for production, use Redis or similar)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const key = ip;
  const limit = rateLimitMap.get(key);

  if (!limit || now > limit.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT.windowMs });
    return true;
  }

  if (limit.count >= RATE_LIMIT.maxRequests) {
    return false;
  }

  limit.count++;
  return true;
}

function getClientIP(request: NextRequest): string {
  const xForwardedFor = request.headers.get('x-forwarded-for');
  const xRealIP = request.headers.get('x-real-ip');
  const xClientIP = request.headers.get('x-client-ip');
  
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  if (xRealIP) {
    return xRealIP;
  }
  if (xClientIP) {
    return xClientIP;
  }
  
  return 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP)) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded',
          message: `Too many requests. Maximum ${RATE_LIMIT.maxRequests} requests per minute allowed.`,
          retryAfter: 60
        }),
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    // Parse request body
    const body = await request.json();
    const { csvResults, options = {}, prompt } = body;

    // Validate input
    if (!csvResults || !Array.isArray(csvResults) || csvResults.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid input',
          message: 'csvResults must be a non-empty array of CSV parse results'
        }),
        { status: 400 }
      );
    }

    // Validate CSV results structure
    for (const result of csvResults) {
      if (!result.id || !result.fileName || !result.columns || !Array.isArray(result.columns)) {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid CSV result format',
            message: 'Each CSV result must have id, fileName, and columns array'
          }),
          { status: 400 }
        );
      }
    }

    // Check if streaming is requested
    const isStreaming = options.streaming === true;

    // Add prompt to options if provided
    const analysisOptions = prompt ? { ...options, prompt } : options;

    if (isStreaming) {
      return handleStreamingAnalysis(csvResults, analysisOptions);
    } else {
      return handleStandardAnalysis(csvResults, analysisOptions);
    }

  } catch (error) {
    console.error('AI analysis endpoint error:', error);
    
    // Ensure we always return a properly formatted JSON response
    const errorResponse = {
      error: 'server_error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      timestamp: new Date().toISOString(),
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    };

    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('API key')) {
        return new Response(
          JSON.stringify({ 
            ...errorResponse,
            error: 'configuration_error',
            message: 'AI service is not properly configured. Please check server configuration.'
          }),
          { status: 503 }
        );
      }
      
      if (error.message.includes('timeout')) {
        return new Response(
          JSON.stringify({ 
            ...errorResponse,
            error: 'timeout_error',
            message: 'Analysis request timed out. Please try again or reduce the data size.'
          }),
          { status: 408 }
        );
      }
    }

    return new Response(
      JSON.stringify(errorResponse),
      { status: 500 }
    );
  }
}

async function handleStandardAnalysis(
  csvResults: CSVParseResult[],
  options: { includeOptimizations?: boolean; targetUseCase?: string }
): Promise<Response> {
  try {
    const analyzer = new SchemaAnalyzer();
    
    // Create a transform stream for progress updates
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    // Track analysis start time
    const analysisStartTime = Date.now();
    let currentProgress = 0;
    let currentStage = '';
    
    // Analysis stages with weights
    const stages = [
      { name: 'Initializing analysis', weight: 10 },
      { name: 'Processing CSV data', weight: 20 },
      { name: 'Analyzing data patterns', weight: 25 },
      { name: 'Generating schema structure', weight: 25 },
      { name: 'Optimizing relationships', weight: 10 },
      { name: 'Finalizing schema', weight: 10 }
    ];

    // Start analysis and mark as started
    const analysisPromise = (async () => {
      // Send initial metadata
      await writer.write(encoder.encode(
        `data: ${JSON.stringify({
          type: 'metadata',
          data: {
            timestamp: new Date().toISOString(),
            totalStages: stages.length,
            estimatedTime: '30-60 seconds'
          }
        })}\n\n`
      ));
      
      // Process through stages
      for (let i = 0; i < stages.length; i++) {
        currentStage = stages[i].name;
        const startProgress = stages.slice(0, i).reduce((sum, s) => sum + s.weight, 0);
        const endProgress = startProgress + stages[i].weight;
        
        // Emit progress event
        await writer.write(encoder.encode(
          `data: ${JSON.stringify({
            type: 'progress',
            data: {
              stage: currentStage,
              progress: endProgress,
              timestamp: new Date().toISOString()
            }
          })}\n\n`
        ));
        
        // Check for timeout between stages
        if (Date.now() - analysisStartTime > REQUEST_TIMEOUT) {
          throw new Error('Analysis is taking longer than expected. Please try with a smaller dataset.');
        }
        
        // Simulate work for each stage (replace with actual work)
        await new Promise(resolve => setTimeout(resolve, 1000));
        currentProgress = endProgress;
      }
      
      // Perform actual analysis
      const analysis = await analyzer.analyzeSchema(csvResults, options);
      
      // Validate the analysis result
      const validation = validateAIAnalysis(analysis);
      if (!validation.isValid) {
        console.warn('AI analysis validation failed:', validation.issues);
        
        await writer.write(encoder.encode(
          `data: ${JSON.stringify({
            type: 'error',
            data: {
              error: 'Analysis validation failed',
              message: 'The generated analysis did not meet quality standards',
              issues: validation.issues,
              timestamp: new Date().toISOString()
            }
          })}\n\n`
        ));
        
        return null;
      }

      // Send completion event with analysis results
      await writer.write(encoder.encode(
        `data: ${JSON.stringify({
          type: 'complete',
          data: {
            success: true,
            analysis,
            metadata: {
              processingTime: Date.now() - analysisStartTime,
              tablesAnalyzed: csvResults.length,
              confidence: analysis.confidence,
              aiProvider: 'gemini-2.5-flash-preview-04-17',
              progress: {
                currentStage,
                currentProgress,
                stages
              }
            },
            timestamp: new Date().toISOString()
          }
        })}\n\n`
      ));
      
      await writer.close();
      return analysis;
    })();

    // Return the response with the stream
    const response = new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });

    // Handle the analysis in the background
    analysisPromise.catch(async (error) => {
      console.error('Analysis error:', error);
      await writer.write(encoder.encode(
        `data: ${JSON.stringify({
          type: 'error',
          data: {
            error: 'Analysis failed',
            message: error instanceof Error ? error.message : 'An unexpected error occurred',
            timestamp: new Date().toISOString()
          }
        })}\n\n`
      ));
      await writer.close();
    });

    return response;

  } catch (error) {
    console.error('Standard analysis failed:', error);
    
    // Handle timeout specifically
    if (error instanceof Error && error.message.includes('Analysis')) {
      return new Response(
        JSON.stringify({
          error: 'timeout',
          message: error.message,
          suggestion: 'Try reducing the dataset size or disabling optimizations'
        }),
        { 
          status: 408,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    throw error;
  }
}

async function handleStreamingAnalysis(
  csvResults: CSVParseResult[],
  options: { targetUseCase?: string }
): Promise<Response> {
  try {
    const analyzer = new SchemaAnalyzer();
    const stream = await analyzer.streamSchemaAnalysis(csvResults, options);

    // Create a readable stream for the response
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          const encoder = new TextEncoder();
          
          // Send initial metadata
          const metadata = {
            type: 'metadata',
            data: {
              timestamp: new Date().toISOString(),
              tablesCount: csvResults.length,
              aiProvider: 'gemini-2.5-flash-preview-04-17',
            }
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(metadata)}\n\n`));

          // Stream the analysis
          for await (const chunk of stream.textStream) {
            const streamData = {
              type: 'content',
              data: {
                content: chunk,
                timestamp: new Date().toISOString(),
              }
            };
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(streamData)}\n\n`));
          }

          // Send completion signal
          const completion = {
            type: 'complete',
            data: {
              timestamp: new Date().toISOString(),
              totalTokens: await stream.usage.then(u => u.totalTokens).catch(() => undefined),
            }
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(completion)}\n\n`));
          
        } catch (error) {
          console.error('Streaming error:', error);
          const errorData = {
            type: 'error',
            data: {
              message: error instanceof Error ? error.message : 'Unknown streaming error',
              timestamp: new Date().toISOString(),
            }
          };
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
      },
    });

  } catch (error) {
    console.error('Streaming analysis setup failed:', error);
    throw error;
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// Health check endpoint
export async function GET() {
  try {
    // Check if AI service is configured
    const isConfigured = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    
    return new Response(
      JSON.stringify({
        status: 'healthy',
        aiConfigured: isConfigured,
        timestamp: new Date().toISOString(),
        rateLimit: {
          windowMs: RATE_LIMIT.windowMs,
          maxRequests: RATE_LIMIT.maxRequests,
        }
      })
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 503 }
    );
  }
}