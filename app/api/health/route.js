import { NextResponse } from 'next/server';
import { corsHeaders } from '@/lib/api-helpers';

// GET /api/health
export async function GET() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() }, { headers: corsHeaders() });
}

// OPTIONS
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}