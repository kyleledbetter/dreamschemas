/**
 * API Route: Start seeding job in user's Supabase project
 * Phase 10: Data Seeding & Large File Processing
 */

import { NextRequest, NextResponse } from "next/server";

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

    // Get project details to construct the Edge Function URL
    const projectResponse = await fetch(
      `https://api.supabase.com/v1/projects/${projectId}`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!projectResponse.ok) {
      return NextResponse.json(
        { error: "Failed to get project details" },
        { status: projectResponse.status }
      );
    }

    // const projectData = await projectResponse.json();
    const isStreaming = request.url.includes("stream=true");
    
    // Construct the Edge Function URL
    const functionUrl = `https://${projectId}.supabase.co/functions/v1/seed-data${isStreaming ? "?stream=true" : ""}`;

    // Get project API key for the Edge Function
    const apiKeysResponse = await fetch(
      `https://api.supabase.com/v1/projects/${projectId}/api-keys`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!apiKeysResponse.ok) {
      return NextResponse.json(
        { error: "Failed to get project API keys" },
        { status: apiKeysResponse.status }
      );
    }

    const apiKeys = await apiKeysResponse.json();
    const anonKey = apiKeys.find((key: { name: string; api_key: string }) => key.name === "anon")?.api_key;

    if (!anonKey) {
      return NextResponse.json(
        { error: "Could not find project anon key" },
        { status: 500 }
      );
    }

    // Prepare the request payload
    const requestPayload = {
      ...jobData,
      projectConfig: {
        projectId: projectId,
        databaseUrl: `https://${projectId}.supabase.co`,
        apiKey: anonKey,
      },
    };

    // Call the user's Edge Function
    const edgeFunctionResponse = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${anonKey}`,
      },
      body: JSON.stringify(requestPayload),
    });

    if (isStreaming) {
      // For streaming responses, we need to proxy the stream
      if (!edgeFunctionResponse.ok) {
        return NextResponse.json(
          { error: `Edge Function failed: ${edgeFunctionResponse.statusText}` },
          { status: edgeFunctionResponse.status }
        );
      }

      // Return the streaming response
      return new Response(edgeFunctionResponse.body, {
        status: edgeFunctionResponse.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } else {
      // For regular responses
      if (!edgeFunctionResponse.ok) {
        const errorText = await edgeFunctionResponse.text();
        return NextResponse.json(
          { error: `Edge Function failed: ${errorText}` },
          { status: edgeFunctionResponse.status }
        );
      }

      const result = await edgeFunctionResponse.json();
      return NextResponse.json(result);
    }

  } catch (error) {
    console.error("Error starting seeding job:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
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