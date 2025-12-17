// app/api/invites/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { clientConfig } from '@/config/client';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

interface Interviewee { name: string; email: string; custom_field?: string; }

export async function POST(request: NextRequest) {
  try {
    const { panelId, interviewees } = await request.json();
    if (!panelId || !interviewees || !Array.isArray(interviewees)) return NextResponse.json({ error: 'Panel ID and interviewees array required' }, { status: 400 });

    const { data: panel } = await supabase.from('agents').select('name').eq('id', panelId).single();
    if (!panel) return NextResponse.json({ error: 'Panel not found' }, { status: 404 });

    const results = [];
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';

    for (const person of interviewees as Interviewee[]) {
      try {
        const token = crypto.randomUUID();
        const { error: dbError } = await supabase.from('interviewees').insert({ agent_id: panelId, name: person.name, email: person.email, custom_field: person.custom_field, invite_token: token, status: 'invited' }).select().single();
        if (dbError) throw dbError;

        const magicLink = `${baseUrl}/i/${panelId}?token=${token}`;

        if (process.env.RESEND_API_KEY) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: `${clientConfig.platform.name} <noreply@${process.env.RESEND_DOMAIN || 'resend.dev'}>`,
              to: person.email,
              subject: `You're invited: ${panel.name}`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><h2>Hi ${person.name},</h2><p>You've been invited to participate in: <strong>${panel.name}</strong></p><a href="${magicLink}" style="display:inline-block;background:#8B5CF6;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;margin:16px 0;">Start Interview</a><p style="color:#666;font-size:14px;">Or copy: ${magicLink}</p></div>`
            })
          });
        }
        results.push({ email: person.email, success: true, link: magicLink });
      } catch (err: any) { results.push({ email: person.email, success: false, error: err.message }); }
    }
    return NextResponse.json({ results });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}