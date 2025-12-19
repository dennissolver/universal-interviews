# Implementation Guide: Draft Review Flow

## Overview

This update changes the panel creation flow from:
- ❌ Sandra → Create immediately → User gets link

To:
- ✅ Sandra → Save draft → User reviews/edits → User clicks "Create"

## Files to Deploy

```
app/
├── api/
│   ├── tools/
│   │   ├── save-draft/
│   │   │   └── route.ts          # NEW: Sandra calls this
│   │   └── create-panel/
│   │       └── route.ts          # UPDATED: Can finalize drafts
│   └── panels/
│       └── [panelId]/
│           └── route.ts          # NEW: GET/PATCH for panel data
└── panel/
    └── draft/
        └── [draftId]/
            └── edit/
                └── page.tsx      # NEW: Edit UI
```

## Step-by-Step Deployment

### 1. Copy API Routes

```powershell
# In your universal-interviews directory

# Create directories
New-Item -ItemType Directory -Force -Path "app/api/tools/save-draft"
New-Item -ItemType Directory -Force -Path "app/api/panels/[panelId]"
New-Item -ItemType Directory -Force -Path "app/panel/draft/[draftId]/edit"

# Copy the files from Claude's outputs
```

### 2. Update Database Schema (if needed)

Your `agents` table should already have a `status` column. If not:

```sql
ALTER TABLE agents ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
```

Drafts will be saved with `status = 'draft'`, active panels with `status = 'active'`.

### 3. Update Sandra in ElevenLabs

1. Go to ElevenLabs Dashboard → Conversational AI → Your Sandra agent
2. Replace the system prompt with contents of `SANDRA_PROMPT_V2.md`
3. Update/replace the tool:
   - **Remove** `create_interview_panel` tool
   - **Add** `save_panel_draft` tool with the schema in the prompt file
4. Set the tool URL to: `https://universal-interviews.vercel.app/api/tools/save-draft`

### 4. Deploy to Vercel

```powershell
git add .
git commit -m "Add draft review flow - users can edit before creating"
git push
```

### 5. Test the Flow

1. Start a conversation with Sandra
2. Go through the collaborative design process
3. When Sandra says "I'm saving this now", check:
   - Draft appears in database with `status='draft'`
   - Edit page loads at `/panel/draft/[id]/edit`
4. Make edits on the page
5. Click "Create Panel"
6. Verify ElevenLabs agent is created with correct voice

---

## File Summaries

### `/api/tools/save-draft/route.ts`
- Receives panel config from Sandra
- Saves to `agents` table with `status='draft'` and `elevenlabs_agent_id=null`
- Returns `{ success, draftId, editUrl }`

### `/api/tools/create-panel/route.ts`
- Updated to accept `draft_id` parameter
- If `draft_id` provided: Updates existing draft → Creates ElevenLabs agent → Sets `status='active'`
- If no `draft_id`: Creates fresh panel (original behavior)
- Uses correct voice based on `voice_gender`

### `/api/panels/[panelId]/route.ts`
- `GET`: Fetch panel/draft details
- `PATCH`: Update panel/draft (for saving edits without creating agent)

### `/panel/draft/[draftId]/edit/page.tsx`
- Full edit UI with all fields:
  - Panel name, description, target audience
  - Interviewer name, voice (male/female toggle), tone
  - Duration
  - Questions (add, remove, reorder)
  - Closing message
- "Save Draft" button (saves without creating)
- "Create Panel" button (creates ElevenLabs agent, activates panel)

---

## Voice IDs Reference

| Voice Gender | Voice Name | ElevenLabs ID |
|--------------|------------|---------------|
| `female` | Sarah | `EXAVITQu4vr4xnSDxMaL` |
| `male` | Adam | `pNInz6obpgDQGcFmaJgB` |

---

## UI Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER TALKS TO SANDRA                         │
│                                                                     │
│  Sandra: "What are we trying to achieve?"                          │
│  User: "Research on VC pitch decisions"                            │
│  Sandra: "Here are some questions I suggest..."                    │
│  [Collaborative refinement]                                        │
│  Sandra: "Male or female voice?"                                   │
│  User: "Female"                                                    │
│  Sandra: "Name for your interviewer?"                              │
│  User: "Rachel"                                                    │
│  Sandra: "Saving now..."                                           │
│                                                                     │
│                    ↓ calls save_panel_draft                        │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          DRAFT SAVED                                │
│                                                                     │
│  Database: agents row with status='draft'                          │
│  No ElevenLabs agent created yet                                   │
│                                                                     │
│  Sandra: "You should see it on screen now..."                      │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      EDIT PAGE DISPLAYED                            │
│  /panel/draft/[id]/edit                                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Panel Name: [The First 5 Minutes of a Pitch      ]          │   │
│  │ Research Objective: [Understanding VC decisions...  ]       │   │
│  │ Target Audience: [VC Partners with 3+ years...      ]       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ AI Interviewer                                               │   │
│  │                                                              │   │
│  │ Name: [Rachel                    ]                           │   │
│  │                                                              │   │
│  │ Voice: ◉ Female (Sarah)    ○ Male (Adam)                    │   │
│  │                                                              │   │
│  │ Tone: [Friendly & Professional ▼]    Duration: [12] min     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Questions (7)                              [+ Add Question] │   │
│  │                                                              │   │
│  │ ↑↓ Q1: How many pitches have you seen?              [🗑]   │   │
│  │ ↑↓ Q2: Walk me through the first five minutes...    [🗑]   │   │
│  │ ↑↓ Q3: What signals make you lean in?               [🗑]   │   │
│  │ ...                                                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│            [Save Draft]                    [✓ Create Panel]        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼ User clicks "Create Panel"
┌─────────────────────────────────────────────────────────────────────┐
│                       PANEL CREATED                                 │
│                                                                     │
│  1. POST /api/tools/create-panel with draft_id                     │
│  2. ElevenLabs agent created with:                                 │
│     - System prompt generated from questions                       │
│     - Voice: Sarah (female) or Adam (male)                         │
│     - First message with interviewer name                          │
│  3. Database updated: status='active', elevenlabs_agent_id set     │
│  4. Redirect to /panel/[id]/invite                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Draft not appearing on screen?
- Check browser console for errors
- Verify Sandra is calling `save_panel_draft` (not `create_interview_panel`)
- Check Vercel logs for the save-draft endpoint

### Voice not correct?
- Verify `voice_gender` is being passed correctly
- Check the VOICE_IDS mapping in create-panel route
- Look at Vercel logs: should say `Interviewer: [name], voice=[gender], voiceId=[id]`

### Edit page not loading?
- Check that the route exists: `/app/panel/draft/[draftId]/edit/page.tsx`
- Verify the panels API is working: `GET /api/panels/[id]`

### "Create Panel" button not working?
- Check browser console for errors
- Verify ELEVENLABS_API_KEY is set in Vercel
- Check Vercel function logs for create-panel errors

---

## Future Enhancements

1. **Auto-redirect after Sandra saves**: Detect tool completion and navigate automatically
2. **Real-time sync**: Update edit page as Sandra speaks (websocket)
3. **Question suggestions in UI**: "Suggest more questions" button that calls Claude
4. **Voice preview**: Let users hear sample before choosing
5. **Template library**: Save/load panel configurations
