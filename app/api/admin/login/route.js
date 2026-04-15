import { NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/api-helpers';
import crypto from 'crypto';

const ADMIN_SECRET_SALT = 'attikid-music-platform-2025';

function generateAdminToken() {
  const password = process.env.ADMIN_PASSWORD || 'attikid';
  return crypto.createHash('sha256').update(password + ADMIN_SECRET_SALT).digest('hex');
}

// POST /api/admin/login
export async function POST(request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    const adminPassword = process.env.ADMIN_PASSWORD || 'attikid';

    if (username !== 'admin' || password !== adminPassword) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401, headers: corsHeaders() });
    }

    const token = generateAdminToken();
    return NextResponse.json({ token, message: 'Login successful' }, { headers: corsHeaders() });
  } catch (error) {
    console.error('POST admin/login error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }
}

// OPTIONS
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}