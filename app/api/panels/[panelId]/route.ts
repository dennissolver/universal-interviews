// app/api/panels/[panelId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET - Fetch panel/agent details
export async function GET(
  request: NextRequest,
  { params }: { params: { panelId: string } }
) {
  const { panelId } = params

  try {
    const { data: agent, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', panelId)
      .single()

    if (error || !agent) {
      console.error('Agent not found:', error)
      return NextResponse.json({
        error: 'Panel not found'
      }, { status: 404 })
    }

    // Map database columns to frontend-friendly names
    const response = {
      id: agent.id,
      name: agent.name,
      description: agent.description || agent.interview_purpose || '',
      questions: agent.questions || [],
      tone: agent.interviewer_tone || 'friendly and professional',
      target_audience: agent.target_interviewees || '',
      duration_minutes: agent.estimated_duration_mins || 15,
      agent_name: agent.agent_name || 'Alex',
      voice_gender: agent.voice_gender || 'female',
      closing_message: agent.closing_message || '',
      greeting: agent.greeting || '',
      company_name: agent.company_name || '',
      status: agent.status || 'active',
      elevenlabs_agent_id: agent.elevenlabs_agent_id,
      voice_id: agent.voice_id,
      created_at: agent.created_at,
      updated_at: agent.updated_at
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error fetching panel:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// PATCH - Update panel/draft
export async function PATCH(
  request: NextRequest,
  { params }: { params: { panelId: string } }
) {
  const { panelId } = params

  try {
    const body = await request.json()

    // Map frontend field names to database column names
    const updateData: Record<string, any> = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.questions !== undefined) updateData.questions = body.questions
    if (body.tone !== undefined) updateData.interviewer_tone = body.tone
    if (body.target_audience !== undefined) updateData.target_interviewees = body.target_audience
    if (body.duration_minutes !== undefined) updateData.estimated_duration_mins = body.duration_minutes
    if (body.agent_name !== undefined) updateData.agent_name = body.agent_name
    if (body.voice_gender !== undefined) updateData.voice_gender = body.voice_gender
    if (body.closing_message !== undefined) updateData.closing_message = body.closing_message
    if (body.greeting !== undefined) updateData.greeting = body.greeting
    if (body.company_name !== undefined) updateData.company_name = body.company_name

    // Always update timestamp
    updateData.updated_at = new Date().toISOString()

    const { data: agent, error } = await supabase
      .from('agents')
      .update(updateData)
      .eq('id', panelId)
      .select()
      .single()

    if (error) {
      console.error('Update error:', error)
      return NextResponse.json({
        error: 'Failed to update panel',
        details: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      panel: agent
    })

  } catch (error) {
    console.error('Error updating panel:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// DELETE - Delete a draft panel
export async function DELETE(
  request: NextRequest,
  { params }: { params: { panelId: string } }
) {
  const { panelId } = params

  try {
    // Only allow deleting drafts
    const { data: agent, error: fetchError } = await supabase
      .from('agents')
      .select('status, elevenlabs_agent_id')
      .eq('id', panelId)
      .single()

    if (fetchError || !agent) {
      return NextResponse.json({
        error: 'Panel not found'
      }, { status: 404 })
    }

    if (agent.status !== 'draft') {
      return NextResponse.json({
        error: 'Can only delete draft panels'
      }, { status: 400 })
    }

    const { error: deleteError } = await supabase
      .from('agents')
      .delete()
      .eq('id', panelId)

    if (deleteError) {
      console.error('Delete error:', deleteError)
      return NextResponse.json({
        error: 'Failed to delete panel'
      }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting panel:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}