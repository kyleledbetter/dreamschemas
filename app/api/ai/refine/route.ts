import { NextRequest, NextResponse } from 'next/server';
import { SchemaAnalyzer } from '../../../../lib/ai/schema-analyzer';
import type { DatabaseSchema } from '../../../../types/schema.types';

// Rate limiting for refinement requests (more restrictive)
const REFINE_RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // Max 5 refinement requests per minute per IP
};

const refinementRateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRefinementRateLimit(ip: string): boolean {
  const now = Date.now();
  const key = `refine_${ip}`;
  const limit = refinementRateLimitMap.get(key);

  if (!limit || now > limit.resetTime) {
    refinementRateLimitMap.set(key, { count: 1, resetTime: now + REFINE_RATE_LIMIT.windowMs });
    return true;
  }

  if (limit.count >= REFINE_RATE_LIMIT.maxRequests) {
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
    if (!checkRefinementRateLimit(clientIP)) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: `Too many refinement requests. Maximum ${REFINE_RATE_LIMIT.maxRequests} requests per minute allowed.`,
          retryAfter: 60
        },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    // Parse request body
    const body = await request.json();
    const { currentSchema, userFeedback, context } = body;

    // Validate input
    if (!currentSchema) {
      return NextResponse.json(
        { 
          error: 'Invalid input',
          message: 'currentSchema is required'
        },
        { status: 400 }
      );
    }

    if (!userFeedback || typeof userFeedback !== 'string' || userFeedback.trim().length === 0) {
      return NextResponse.json(
        { 
          error: 'Invalid input',
          message: 'userFeedback must be a non-empty string'
        },
        { status: 400 }
      );
    }

    // Validate feedback length (prevent abuse)
    if (userFeedback.length > 2000) {
      return NextResponse.json(
        { 
          error: 'Input too long',
          message: 'User feedback must be less than 2000 characters'
        },
        { status: 400 }
      );
    }

    // Validate schema structure
    if (!currentSchema.tables || !Array.isArray(currentSchema.tables)) {
      return NextResponse.json(
        { 
          error: 'Invalid schema format',
          message: 'currentSchema must have a tables array'
        },
        { status: 400 }
      );
    }

    // Initialize analyzer
    const analyzer = new SchemaAnalyzer();
    
    // Set timeout for refinement
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Refinement timeout')), 25000); // 25 seconds
    });

    // Process refinement
    const refinementResult = await Promise.race([
      analyzer.refineSchema(currentSchema as DatabaseSchema, userFeedback, context),
      timeoutPromise
    ]) as { refinedSchema: Partial<DatabaseSchema>; reasoning: string; confidence: number };

    // Validate refinement result
    if (!refinementResult || typeof refinementResult.confidence !== 'number') {
      throw new Error('Invalid refinement result from AI service');
    }

    // Check confidence threshold
    if (refinementResult.confidence < 0.3) {
      return NextResponse.json(
        {
          success: false,
          error: 'Low confidence refinement',
          message: 'The AI could not confidently interpret your feedback. Please try being more specific.',
          originalFeedback: userFeedback,
          suggestions: [
            'Be more specific about which table or column you want to modify',
            'Use concrete examples of the changes you want',
            'Specify the reason for the change (performance, data integrity, etc.)',
          ]
        },
        { status: 422 } // Unprocessable Entity
      );
    }

    return NextResponse.json({
      success: true,
      refinement: {
        changes: refinementResult.refinedSchema,
        reasoning: refinementResult.reasoning,
        confidence: refinementResult.confidence,
        userFeedback: userFeedback,
        timestamp: new Date().toISOString(),
      },
      metadata: {
        processingTime: Date.now(),
        aiProvider: 'gemini-2.5-flash-preview-04-17',
        feedbackLength: userFeedback.length,
      }
    });

  } catch (error) {
    console.error('Schema refinement endpoint error:', error);
    
    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { 
            error: 'Configuration error',
            message: 'AI service is not properly configured. Please check server configuration.'
          },
          { status: 503 }
        );
      }
      
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { 
            error: 'Timeout error',
            message: 'Refinement request timed out. Please try simplifying your feedback.'
          },
          { status: 408 }
        );
      }

      if (error.message.includes('quota') || error.message.includes('limit')) {
        return NextResponse.json(
          { 
            error: 'Service limit reached',
            message: 'AI service quota exceeded. Please try again later.'
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'An unexpected error occurred during refinement. Please try again.'
      },
      { status: 500 }
    );
  }
}

// Batch refinement endpoint for multiple changes
export async function PUT(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);
    if (!checkRefinementRateLimit(clientIP)) {
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: `Too many refinement requests. Maximum ${REFINE_RATE_LIMIT.maxRequests} requests per minute allowed.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { currentSchema, feedbackList, context } = body;

    // Validate batch input
    if (!Array.isArray(feedbackList) || feedbackList.length === 0) {
      return NextResponse.json(
        { 
          error: 'Invalid input',
          message: 'feedbackList must be a non-empty array'
        },
        { status: 400 }
      );
    }

    if (feedbackList.length > 5) {
      return NextResponse.json(
        { 
          error: 'Too many requests',
          message: 'Maximum 5 feedback items allowed per batch'
        },
        { status: 400 }
      );
    }

    const analyzer = new SchemaAnalyzer();
    const results = [];

    // Process each feedback item
    for (let i = 0; i < feedbackList.length; i++) {
      const feedback = feedbackList[i];
      
      if (!feedback || typeof feedback !== 'string') {
        results.push({
          index: i,
          success: false,
          error: 'Invalid feedback format',
        });
        continue;
      }

      try {
        const refinementResult = await analyzer.refineSchema(
          currentSchema as DatabaseSchema,
          feedback,
          context
        );

        results.push({
          index: i,
          success: true,
          refinement: {
            changes: refinementResult.refinedSchema,
            reasoning: refinementResult.reasoning,
            confidence: refinementResult.confidence,
          },
          feedback: feedback,
        });

      } catch (error) {
        console.error(`Batch refinement ${i} failed:`, error);
        results.push({
          index: i,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          feedback: feedback,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json({
      success: successCount > 0,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
      },
      metadata: {
        processingTime: Date.now(),
        aiProvider: 'google-gemini-2.0-flash',
      }
    });

  } catch (error) {
    console.error('Batch refinement endpoint error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'An unexpected error occurred during batch refinement.'
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// Get refinement suggestions endpoint
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schemaType = searchParams.get('type') || 'general';
    
    // Return common refinement suggestions based on schema type
    const suggestions = getRefinementSuggestions(schemaType);
    
    return NextResponse.json({
      success: true,
      suggestions,
      schemaType,
    });
  } catch {
    return NextResponse.json(
      { 
        error: 'Failed to get suggestions',
        message: 'Could not retrieve refinement suggestions'
      },
      { status: 500 }
    );
  }
}

function getRefinementSuggestions(schemaType: string): string[] {
  const commonSuggestions = [
    "Add indexes for frequently queried columns",
    "Create foreign key relationships between related tables",
    "Add check constraints for data validation",
    "Optimize column types for better performance",
    "Add unique constraints where appropriate",
    "Consider partitioning for large tables",
  ];

  const specificSuggestions: Record<string, string[]> = {
    ecommerce: [
      "Add order status enum for order tracking",
      "Create product categories lookup table",
      "Add price history table for audit trail",
      "Implement soft delete for customer records",
    ],
    analytics: [
      "Create time-based partitions for event data",
      "Add materialized views for common aggregations",
      "Optimize timestamp columns with proper timezone handling",
      "Create separate fact and dimension tables",
    ],
    cms: [
      "Add content versioning tables",
      "Create flexible meta fields table",
      "Implement hierarchical categories structure",
      "Add content publishing workflow tables",
    ],
  };

  return [
    ...commonSuggestions,
    ...(specificSuggestions[schemaType] || [])
  ];
}