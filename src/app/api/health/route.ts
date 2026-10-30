import { NextResponse } from 'next/server';
export function GET() { return NextResponse.json({ ok: true, service: 'pixel-ai-office', time: new Date().toISOString() }); }
