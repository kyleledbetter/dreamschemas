import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get the access token from the request body
    const { accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Missing access token' },
        { status: 400 }
      );
    }

    // Forward the request to Supabase Management API
    const response = await fetch('https://api.supabase.com/v1/organizations', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json({
        valid: false,
        error: 'Token validation failed',
      });
    }

    // If we can fetch organizations, the token is valid
    return NextResponse.json({
      valid: true,
      user: {
        id: 'user_id', // We'll get this from the token response
        email: 'user_email', // We'll get this from the token response
      },
    });
  } catch (error) {
    return NextResponse.json({
      valid: false,
      error: error instanceof Error ? error.message : 'Token validation failed',
    });
  }
} 