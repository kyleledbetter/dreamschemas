import { NextRequest, NextResponse } from 'next/server';

const SUPABASE_OAUTH_URL = 'https://api.supabase.com/v1/oauth/token';

export async function POST(request: NextRequest) {
  try {
    const { code, code_verifier, redirect_uri } = await request.json();

    if (!code || !code_verifier || !redirect_uri) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const clientId = process.env.NEXT_PUBLIC_SUPABASE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.SUPABASE_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'OAuth configuration missing' },
        { status: 500 }
      );
    }

    // Exchange the code for tokens
    const response = await fetch(SUPABASE_OAUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier,
        redirect_uri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Token exchange failed:', error);
      return NextResponse.json(
        { error: 'Token exchange failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Fetch user information using the access token
    try {
      const userResponse = await fetch('https://api.supabase.com/v1/profile', {
        headers: {
          'Authorization': `Bearer ${data.access_token}`,
          'Accept': 'application/json',
        },
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        data.user_id = userData.id;
        data.email = userData.email;
        data.username = userData.username;
      }
    } catch (userError) {
      console.warn('Failed to fetch user data:', userError);
      // Continue without user data
    }
    
    return NextResponse.json(data);

  } catch (error) {
    console.error('Token exchange error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}