/**
 * API Route: Create storage bucket in user's Supabase project
 * Uses Supabase Management API with user's OAuth token
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
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

    // Get project API key first
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
      const error = await apiKeysResponse.text();
      console.error("Failed to get project API keys:", error);
      return NextResponse.json(
        { error: `Failed to get project API keys: ${error}` },
        { status: apiKeysResponse.status }
      );
    }

    const apiKeys = await apiKeysResponse.json();
    const serviceRoleKey = apiKeys.find((key: { name: string; api_key: string }) => key.name === "service_role")?.api_key;
    const anonKey = apiKeys.find((key: { name: string; api_key: string }) => key.name === "anon")?.api_key;

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Could not find project service role key" },
        { status: 500 }
      );
    }

    if (!anonKey) {
      return NextResponse.json(
        { error: "Could not find project anon key" },
        { status: 500 }
      );
    }

    // Check if bucket already exists using project's Storage API
    const listResponse = await fetch(`https://${projectId}.supabase.co/storage/v1/bucket`, {
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Accept': 'application/json',
      },
    });

    if (!listResponse.ok) {
      const error = await listResponse.text();
      console.error("Failed to list buckets:", error);
      // Don't fail here - continue with bucket creation attempt
      console.log("Bucket listing failed, will attempt creation anyway");
    } else {
      try {
        const buckets = await listResponse.json();
        console.log("Found existing buckets:", buckets.map((b: { name: string }) => b.name));
        const bucketExists = buckets.some((bucket: { name: string }) => bucket.name === "csv-uploads");

        if (bucketExists) {
          console.log("csv-uploads bucket already exists, skipping creation");
          return NextResponse.json({
            success: true,
            message: "Bucket already exists",
            bucketName: "csv-uploads"
          });
        }
      } catch (parseError) {
        console.error("Failed to parse bucket list response:", parseError);
        // Continue with creation attempt
      }
    }

    // Create bucket using project's Storage API (service role key required for admin operations)
    const createResponse = await fetch(`https://${projectId}.supabase.co/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        name: "csv-uploads",
        public: false,
        allowedMimeTypes: ["text/csv", "application/csv", "text/plain"],
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error(`Failed to create bucket (${createResponse.status}):`, errorText);
      
      // Handle duplicate bucket error gracefully
      if (createResponse.status === 409) {
        console.log("Bucket already exists (409 error), treating as success");
        return NextResponse.json({
          success: true,
          message: "Bucket already exists (detected via 409 error)",
          bucketName: "csv-uploads"
        });
      }
      
      // Parse error response to check for duplicate message
      try {
        const errorObj = JSON.parse(errorText);
        if (errorObj.error === "Duplicate" || errorObj.message?.includes("already exists")) {
          console.log("Bucket already exists (detected via error message), treating as success");
          return NextResponse.json({
            success: true,
            message: "Bucket already exists (detected via error message)",
            bucketName: "csv-uploads"
          });
        }
             } catch {
         // Error text is not JSON, continue with original error
       }
      
      return NextResponse.json(
        { error: `Failed to create bucket: ${errorText}` },
        { status: createResponse.status }
      );
    }

    const bucketData = await createResponse.json();
    console.log("Successfully created csv-uploads bucket:", bucketData);

    return NextResponse.json({
      success: true,
      message: "Bucket created successfully",
      bucketName: "csv-uploads",
      data: bucketData
    });

  } catch (error) {
    console.error("Error in bucket creation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 }
    );
  }
} 