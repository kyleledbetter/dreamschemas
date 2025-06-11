import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
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
    const response = await fetch(`https://api.supabase.com/v1/projects/${id}/upgrade/status`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });
    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to check database health:', error);
      return NextResponse.json(
        { error: 'Failed to check database health' },
        { status: response.status }
      );
    }
    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Database health check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 