import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    // Get the access token from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.split(' ')[1];

    // Get the request body
    const body = await request.json();

    // Transform the request body to match Supabase API expectations
    const supabaseBody = {
      query: body.sql || body.query, // Transform 'sql' field to 'query'
      name: body.name,
    };

    // Forward the request to Supabase Management API
    const response = await fetch(`https://api.supabase.com/v1/projects/${id}/database/migrations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Idempotency-Key': `${id}-${Date.now()}`, // Add idempotency key for safety
      },
      body: JSON.stringify(supabaseBody),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to execute migration:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to execute migration' },
        { status: 200 } // Return 200 to avoid client 400 error
      );
    }

    const data = await response.json();
    // Transform the response to match what our management client expects
    return NextResponse.json({
      success: true,
      results: data,
    });

  } catch (error) {
    console.error('Migration execution error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    // Get the access token from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.split(' ')[1];

    // Forward the request to Supabase Management API
    const response = await fetch(`https://api.supabase.com/v1/projects/${id}/database/migrations`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to fetch migrations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch migrations' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Migration fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 