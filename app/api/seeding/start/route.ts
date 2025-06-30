/**
 * API Route: Start seeding job in user's Supabase project
 * Phase 10: Data Seeding & Large File Processing
 */

import { NextRequest, NextResponse } from "next/server";

interface Schema {
  tables: Array<{ name: string }>;
  rlsPolicies?: Array<{ tableName: string }>;
}

interface Table {
  name: string;
}

interface RLSPolicy {
  tableName: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, jobData } = body;

    if (!projectId || !jobData) {
      return NextResponse.json(
        { error: "Project ID and job data are required" },
        { status: 400 }
      );
    }

    // Get OAuth token from Authorization header
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json(
        { error: "Authentication required. Please provide a valid access token." },
        { status: 401 }
      );
    }

    // Get project details and API keys
    const [projectResponse, apiKeysResponse] = await Promise.all([
      fetch(`https://api.supabase.com/v1/projects/${projectId}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }),
      fetch(`https://api.supabase.com/v1/projects/${projectId}/api-keys`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })
    ]);

    if (!projectResponse.ok) {
      return NextResponse.json(
        { error: "Failed to get project details" },
        { status: projectResponse.status }
      );
    }

    if (!apiKeysResponse.ok) {
      return NextResponse.json(
        { error: "Failed to get project API keys" },
        { status: apiKeysResponse.status }
      );
    }

    const apiKeys = await apiKeysResponse.json();
    const serviceRoleKey = apiKeys.find((key: { name: string; api_key: string }) => key.name === "service_role")?.api_key;

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Could not find project service role key" },
        { status: 500 }
      );
    }

    const isStreaming = request.url.includes("stream=true");
    const functionUrl = `https://${projectId}.supabase.co/functions/v1/seed-data${isStreaming ? "?stream=true" : ""}`;

    // Check if this is a continuation call (has processedRows or chunkIndex)
    const isContinuation = jobData.processedRows > 0 || jobData.chunkIndex > 0;

    // Step 1: Disable RLS policies before seeding (only on initial call, not continuations)
    if (!isContinuation) {
      console.log("🔐 Disabling RLS policies for seeding...");
      await disableRLSPolicies(projectId, token, jobData.schema);
    } else {
      console.log(`🔄 Continuation call detected (processedRows: ${jobData.processedRows}, chunkIndex: ${jobData.chunkIndex}) - skipping RLS disable`);
    }

    try {
      // Prepare the request payload
      const requestPayload = {
        ...jobData,
        supabaseUrl: `https://${projectId}.supabase.co`,
        supabaseServiceKey: serviceRoleKey,
        projectConfig: {
          ...jobData.projectConfig,
          projectId: projectId,
          databaseUrl: `https://${projectId}.supabase.co`,
          apiKey: serviceRoleKey,
        },
      };

      // Ensure service key is never undefined
      if (!requestPayload.supabaseServiceKey) {
        requestPayload.supabaseServiceKey = serviceRoleKey;
      }
      if (!requestPayload.projectConfig.apiKey) {
        requestPayload.projectConfig.apiKey = serviceRoleKey;
      }

      console.log(`🚀 About to call Edge Function at: ${functionUrl}`);
      console.log(`📋 Request payload keys: ${Object.keys(requestPayload).join(', ')}`);
      console.log(`🔍 Payload schema tables: ${requestPayload.schema?.tables?.length || 'undefined'}`);
      console.log(`📁 Payload file ID: ${requestPayload.fileId}`);

      // Step 2: Call the Edge Function for seeding
      const edgeFunctionResponse = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify(requestPayload),
      });

      console.log(`📡 Edge Function response status: ${edgeFunctionResponse.status}`);
      console.log(`📡 Edge Function response headers:`, Object.fromEntries(edgeFunctionResponse.headers.entries()));

      // Step 3: Handle response and re-enable RLS
      if (isStreaming) {
        if (!edgeFunctionResponse.ok) {
          // Re-enable RLS policies before returning error (only if this was the initial call)
          if (!isContinuation) {
            console.log("🔐 Re-enabling RLS policies after Edge Function error...");
            await enableRLSPolicies(projectId, token, jobData.schema);
          } else {
            console.log("🔄 Continuation call failed - not re-enabling RLS yet");
          }
          
          return NextResponse.json(
            { error: `Edge Function failed: ${edgeFunctionResponse.statusText}` },
            { status: edgeFunctionResponse.status }
          );
        }

        // For streaming, we need to intercept the stream to detect completion
        return handleStreamingResponse(edgeFunctionResponse, projectId, token, jobData.schema, isContinuation);
      } else {
        // For regular responses, we can handle completion immediately
        if (!edgeFunctionResponse.ok) {
          const errorText = await edgeFunctionResponse.text();
          console.error(`❌ Edge Function failed with status ${edgeFunctionResponse.status}:`, errorText);
          
          // Re-enable RLS policies before returning error (only if this was the initial call)
          if (!isContinuation) {
            console.log("🔐 Re-enabling RLS policies after Edge Function error...");
            await enableRLSPolicies(projectId, serviceRoleKey, jobData.schema);
          } else {
            console.log("🔄 Continuation call failed - not re-enabling RLS yet");
          }
          
          return NextResponse.json(
            { error: `Edge Function failed: ${errorText}` },
            { status: edgeFunctionResponse.status }
          );
        }

        const result = await edgeFunctionResponse.json();
        console.log(`✅ Edge Function responded successfully`);
        
        // Check if this is the final completion (no continuation needed)
        const isFinalCompletion = !result.needsContinuation && !isContinuation;
        
        if (isFinalCompletion) {
          // Re-enable RLS policies after successful completion
          console.log("🔐 Re-enabling RLS policies after final successful seeding...");
          await enableRLSPolicies(projectId, serviceRoleKey, jobData.schema);
        } else {
          console.log("🔄 Batch completed but more processing needed - not re-enabling RLS yet");
        }
        
        return NextResponse.json(result);
      }

    } catch (edgeFunctionError) {
      console.error("Error calling Edge Function:", edgeFunctionError);
      
      // Re-enable RLS policies on error (only if this was the initial call)
      if (!isContinuation) {
        console.log("🔐 Re-enabling RLS policies after Edge Function error...");
        await enableRLSPolicies(projectId, token, jobData.schema);
      } else {
        console.log("🔄 Continuation call error - not re-enabling RLS yet");
      }
      
      throw edgeFunctionError;
    }

  } catch (error) {
    console.error("Error starting seeding job:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Disable RLS policies on all tables that have them
 */
async function disableRLSPolicies(projectId: string, token: string, schema: Schema) {
  try {
    if (!schema?.tables || !Array.isArray(schema.tables)) {
      console.log("ℹ️ No schema tables found for RLS disable");
      return;
    }

    // Find tables that have RLS policies
    const tablesWithRLS = schema.tables.filter((table: Table) => 
      schema.rlsPolicies?.some((policy: RLSPolicy) => policy.tableName === table.name)
    );

    if (tablesWithRLS.length === 0) {
      console.log("ℹ️ No tables with RLS policies found");
      return;
    }

    console.log(`🔐 Found ${tablesWithRLS.length} tables with RLS policies: ${tablesWithRLS.map((t: Table) => t.name).join(', ')}`);

    // Disable RLS on each table using Supabase Management API
    for (const table of tablesWithRLS) {
      try {
        const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            query: `ALTER TABLE ${table.name} DISABLE ROW LEVEL SECURITY;`
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.warn(`⚠️ Failed to disable RLS on table ${table.name}:`, errorData);
        } else {
          console.log(`✅ Disabled RLS on table: ${table.name}`);
        }
      } catch (tableError) {
        console.warn(`⚠️ Error disabling RLS on table ${table.name}:`, tableError);
      }
    }

    console.log(`🔐 RLS disable complete for ${tablesWithRLS.length} tables`);
  } catch (error) {
    console.warn('⚠️ Error in disableRLSPolicies:', error);
    // Don't throw - seeding can continue without RLS disabled
  }
}

/**
 * Re-enable RLS policies on all tables that have them
 */
async function enableRLSPolicies(projectId: string, token: string, schema: Schema) {
  try {
    if (!schema?.tables || !Array.isArray(schema.tables)) {
      console.log("ℹ️ No schema tables found for RLS enable");
      return;
    }

    // Find tables that have RLS policies
    const tablesWithRLS = schema.tables.filter((table: Table) => 
      schema.rlsPolicies?.some((policy: RLSPolicy) => policy.tableName === table.name)
    );

    if (tablesWithRLS.length === 0) {
      console.log("ℹ️ No tables with RLS policies found");
      return;
    }

    console.log(`🔐 Re-enabling RLS on ${tablesWithRLS.length} tables: ${tablesWithRLS.map((t: Table) => t.name).join(', ')}`);

    // Re-enable RLS on each table using Supabase Management API
    for (const table of tablesWithRLS) {
      try {
        const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            query: `ALTER TABLE ${table.name} ENABLE ROW LEVEL SECURITY;`
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.warn(`⚠️ Failed to re-enable RLS on table ${table.name}:`, errorData);
        } else {
          console.log(`✅ Re-enabled RLS on table: ${table.name}`);
        }
      } catch (tableError) {
        console.warn(`⚠️ Error re-enabling RLS on table ${table.name}:`, tableError);
      }
    }

    console.log(`🔐 RLS re-enable complete for ${tablesWithRLS.length} tables`);
  } catch (error) {
    console.warn('⚠️ Error in enableRLSPolicies:', error);
    // Don't throw - this is cleanup
  }
}

/**
 * Handle streaming responses and detect completion to re-enable RLS
 */
async function handleStreamingResponse(edgeFunctionResponse: Response, projectId: string, token: string, schema: Schema, isContinuation: boolean = false) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Process the stream in the background
  (async () => {
    try {
      const reader = edgeFunctionResponse.body?.getReader();
      if (!reader) {
        await writer.close();
        return;
      }

      let completed = false;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        
        // Check if this chunk indicates completion
        if (chunk.includes('"type":"complete"') || chunk.includes('data: [DONE]')) {
          completed = true;
        }

        // Forward the chunk to the client
        await writer.write(encoder.encode(chunk));
      }

      // Re-enable RLS policies when streaming is complete (only if this is not a continuation)
      if (completed && !isContinuation) {
        console.log("🔐 Final streaming completed - re-enabling RLS policies...");
        await enableRLSPolicies(projectId, token, schema);
      } else if (completed && isContinuation) {
        console.log("🔄 Continuation streaming completed - not re-enabling RLS yet");
      }

      await writer.close();
    } catch (error) {
      console.error("Error handling streaming response:", error);
      
      // Re-enable RLS policies on error (only if this is not a continuation)
      if (!isContinuation) {
        console.log("🔐 Stream error - re-enabling RLS policies...");
        await enableRLSPolicies(projectId, token, schema);
      } else {
        console.log("🔄 Continuation stream error - not re-enabling RLS yet");
      }
      
      await writer.close();
    }
  })();

  return new Response(readable, {
    status: edgeFunctionResponse.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}