# Draft Review Flow - Deployment Checklist

## Overview

This update changes the flow from:
- ❌ Sandra → Creates panel immediately → User gets link
  
To:
- ✅ Sandra → Saves draft → User reviews/edits on screen → User clicks "Create Panel"

---

## Files Created

```
app/
├── api/
│   ├── tools/
│   │   └── save-draft/
│   │       └── route.ts          ← NEW: Sandra calls this
│   ├── panels/
│   │   └── [panelId]/
│   │       └── route.ts          ← NEW: GET/PATCH for panel data
│   └── tools/
│       └── create-panel/
│           └── route.ts          ← UPDATED: Can finalize drafts
└── panel/
    ├── draft/
    │   └── [draftId]/
    │       └── edit/
    │           └── page.tsx      ← NEW: Edit UI
    └── [panelId]/
        └── invite/
            └── page.tsx          ← NEW: Success page after creation
```

---

## Deployment Steps

### Step 1: Update Database Schema

Run in Supabase SQL Editor:

```sql
-- Add status column if missing
ALTER TABLE panels 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' 
CHECK (status IN ('draft', 'active', 'archived'));

-- Add other new columns (see DATABASE_SCHEMA.sql for full list)
```

### Step 2: Copy Files to Your Project

```powershell
# From your universal-interviews directory, copy:
# - app/api/tools/save-draft/route.ts
# - app/api/tools/create-panel/route.ts (replace existing)
# - app/api/panels/[panelId]/route.ts
# - app/panel/draft/[draftId]/edit/page.tsx
# - app/panel/[panelId]/invite/page.tsx
```

### Step 3: Add Environment Variable (if not exists)

In Vercel, add:
```
INTERNAL_API_KEY=internal-create-panel
```

(This allows the edit page to call create-panel without webhook auth)

### Step 4: Update Sandra in ElevenLabs

1. Go to ElevenLabs Dashboard → Conversational AI → Sandra agent
2. Replace system prompt with contents of `SANDRA_PROMPT_V2.md`
3. Remove `create_interview_panel` tool
4. Add `save_panel_draft` tool (see `ELEVENLABS_TOOL_SCHEMA.md`)
5. Set tool URL to: `https://universal-interviews.vercel.app/api/tools/save-draft`

### Step 5: Deploy to Vercel

```powershell
git add .
git commit -m "Add draft review flow for panel creation"
git push
```

### Step 6: Test the Flow

1. ✓ Talk to Sandra, design a panel
2. ✓ Sandra says "I've saved your draft"
3. ✓ Navigate to `/panel/draft/[id]/edit`
4. ✓ Edit fields, reorder questions
5. ✓ Click "Create Panel"
6. ✓ Redirected to success page with interview link
7. ✓ Test the interview link works

---

## How It Works

```
┌─────────────────────┐
│   User talks to     │
│      Sandra         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Sandra calls       │
│  save_panel_draft   │
│  webhook            │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Draft saved to DB  │
│  status = 'draft'   │
│  No ElevenLabs yet  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  User sees edit UI  │
│  /panel/draft/id/   │
│  edit               │
└──────────┬──────────┘
           │
    User clicks "Create Panel"
           │
           ▼
┌─────────────────────┐
│  POST /api/tools/   │
│  create-panel       │
│  with draft_id      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  ElevenLabs agent   │
│  created with       │
│  correct voice      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  DB updated:        │
│  status = 'active'  │
│  elevenlabs_agent_id│
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Redirect to        │
│  /panel/id/invite   │
│  (success page)     │
└─────────────────────┘
```

---

## Troubleshooting

| Issue | Check |
|-------|-------|
| Draft not saving | Vercel logs for save-draft endpoint |
| Edit page 404 | File exists at `app/panel/draft/[draftId]/edit/page.tsx` |
| Create fails | ELEVENLABS_API_KEY set in Vercel |
| Wrong voice | Check voice_gender field in DB |
| Sandra still creates directly | Update Sandra prompt + remove old tool |

---

## Quick Verification

After deploying, test each endpoint:

```bash
# Check save-draft endpoint exists
curl -X POST https://universal-interviews.vercel.app/api/tools/save-draft \
  -H "Content-Type: application/json" \
  -H "X-Shared-Secret: YOUR_SECRET" \
  -d '{"name":"Test","questions":["Q1"],"agent_name":"Alex","voice_gender":"female"}'

# Check panels API exists  
curl https://universal-interviews.vercel.app/api/panels/PANEL_ID

# Check edit page loads
# Visit: https://universal-interviews.vercel.app/panel/draft/PANEL_ID/edit
```