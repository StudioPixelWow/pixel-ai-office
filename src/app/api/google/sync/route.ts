import { NextResponse } from 'next/server';
import { me } from '@/lib/api';
import { gcalSync } from '@/engine/adapters/gcal';
export const maxDuration = 60;
export async function POST() { await me(); const r = await gcalSync(); return NextResponse.json(r); }
