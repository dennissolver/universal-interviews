// app/api/invites/parse-excel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    if (!data || data.length === 0) return NextResponse.json({ error: 'No data found in file' }, { status: 400 });

    const interviewees = [];
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i] as any;
      const name = row.name || row.Name || row.NAME || row['Full Name'] || '';
      const email = row.email || row.Email || row.EMAIL || row['Email Address'] || '';
      const customField = row.custom_field || row.customField || row.department || row.team || '';

      if (!email) { errors.push(`Row ${i + 2}: Missing email`); continue; }
      if (!email.includes('@')) { errors.push(`Row ${i + 2}: Invalid email`); continue; }

      interviewees.push({ name: name || email.split('@')[0], email: email.toLowerCase().trim(), custom_field: customField });
    }

    if (interviewees.length === 0) return NextResponse.json({ error: 'No valid interviewees found. ' + errors.join('; ') }, { status: 400 });
    return NextResponse.json({ interviewees, total: interviewees.length, errors: errors.length > 0 ? errors : undefined });
  } catch (error: any) { return NextResponse.json({ error: 'Failed to parse file: ' + error.message }, { status: 500 }); }
}