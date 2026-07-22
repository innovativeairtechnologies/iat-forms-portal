import { NextRequest, NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'
import { anthropic } from '@/lib/anthropic'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminAuth } from '@/lib/api-auth'
import { slugify } from '@/lib/utils'

const SYSTEM_PROMPT = `You are a form builder assistant for IAT (Innovative Air Technologies) internal admin portal.

Given any form description — section headers, question lists, bullet points, plain prose, copied PDFs, whatever format — extract and return ONLY a valid JSON object. No markdown, no code blocks, no explanation. Raw JSON only.

The JSON must match this exact structure:
{
  "title": "Form Title",
  "description": "Brief description of the form purpose, or null",
  "category": "one of the exact strings listed below",
  "slug": "url-friendly-kebab-case-slug",
  "success_message": "Warm confirmation message shown after submission",
  "fields": [
    {
      "label": "Field Label",
      "field_type": "one of the exact type strings listed below",
      "placeholder": "Hint text shown inside the field, or null",
      "is_required": true,
      "options": ["Option 1", "Option 2"] or null
    }
  ]
}

Available categories (use exactly one of these strings):
- "HR & Time Off"
- "QC & Production"
- "Applications"
- "Sales & External"
- "IT & Facilities"

Available field_type values:
- "text"       — short single-line answer
- "email"      — email address
- "number"     — numeric input
- "textarea"   — long / open-ended / essay answer
- "select"     — dropdown (one choice)
- "radio"      — single-choice chip buttons
- "checkbox"   — multi-select chip buttons
- "date"       — date picker
- "file"       — file upload
- "signature"  — drawn signature pad

Rules:
- Use "textarea" for any open-ended, essay, or multi-sentence answer
- Use "text" for short factual single-line answers
- ALWAYS provide an "options" array for select, radio, checkbox — never null
- ALWAYS use null for options on text, email, number, textarea, date, file, signature
- Mark is_required: true for fields that are clearly mandatory; false for optional/bonus
- For evaluation or aptitude test forms, add "Candidate Name" (text, required) and "Candidate Email" (email, required) as the first two fields
- Preserve the order fields appear in the source
- Generate a concise URL-safe slug from the title
- Write a professional success_message appropriate to the form type
- Choose the most fitting category based on the form's purpose
- If a document (PDF) or image is attached, treat it as the source form and faithfully reproduce its questions, sections, and order. Use any typed notes as additional guidance.`

export async function POST(req: NextRequest) {
  const err = await requireAdminAuth(); if (err) return err

  try {
    const { description, file } = (await req.json()) as {
      description?: string
      file?: { data: string; media_type: string; name?: string }
    }

    const hasText = !!description?.trim()
    const hasFile = !!file?.data && !!file?.media_type

    if (!hasText && !hasFile) {
      return NextResponse.json(
        { error: 'Provide a description, attach a document, or both.' },
        { status: 400 }
      )
    }

    // Build the user turn. With an attachment, send it as a native document/image
    // block so Claude reads the file directly (text + layout) — far more reliable
    // than client-side text extraction.
    let content: Anthropic.MessageParam['content']
    if (hasFile) {
      const blocks: Anthropic.ContentBlockParam[] = []
      if (file!.media_type === 'application/pdf') {
        blocks.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: file!.data },
        })
      } else if (file!.media_type.startsWith('image/')) {
        blocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: file!.media_type as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
            data: file!.data,
          },
        })
      } else {
        return NextResponse.json(
          { error: 'Unsupported file type. Attach a PDF or an image (PNG, JPG).' },
          { status: 400 }
        )
      }
      blocks.push({
        type: 'text',
        text: hasText
          ? `Build a form from the attached document. Additional notes from the user:\n\n${description!.trim()}`
          : 'Build a form from the attached document.',
      })
      content = blocks
    } else {
      content = description!.trim()
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonStr = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()

    let parsed: {
      title: string
      description: string | null
      category: string
      slug: string
      success_message: string
      fields: Array<{
        label: string
        field_type: string
        placeholder: string | null
        is_required: boolean
        options: string[] | null
      }>
    }

    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error('AI response was not valid JSON:', raw)
      return NextResponse.json(
        { error: 'AI returned an unexpected format. Try rephrasing or simplifying your description.' },
        { status: 500 }
      )
    }

    // Resolve category ID
    const { data: categories } = await supabaseAdmin.from('categories').select('id, name')
    const catMap = Object.fromEntries((categories || []).map(c => [c.name, c.id]))
    const categoryId = catMap[parsed.category] || null

    // Ensure slug is unique
    let slug = slugify(parsed.slug || parsed.title)
    let attempt = 0
    while (true) {
      const { data: existing } = await supabaseAdmin.from('forms').select('id').eq('slug', slug).single()
      if (!existing) break
      attempt++
      slug = `${slugify(parsed.slug || parsed.title)}-${attempt}`
    }

    // Insert form as draft (is_active: false) so it must be reviewed before publishing
    const { data: form, error: formError } = await supabaseAdmin
      .from('forms')
      .insert({
        title: parsed.title,
        description: parsed.description || null,
        category_id: categoryId,
        slug,
        is_active: false,
        approval_status: 'pending',
        success_message: parsed.success_message || 'Your submission has been received.',
      })
      .select()
      .single()

    if (formError || !form) {
      return NextResponse.json({ error: formError?.message || 'Failed to create form' }, { status: 500 })
    }

    if (parsed.fields?.length > 0) {
      const fieldRows = parsed.fields.map((f, i) => ({
        form_id: form.id,
        label: f.label,
        field_type: f.field_type,
        placeholder: f.placeholder || null,
        is_required: f.is_required ?? false,
        sort_order: i,
        options: Array.isArray(f.options) && f.options.length > 0 ? f.options : null,
      }))
      await supabaseAdmin.from('form_fields').insert(fieldRows)
    }

    return NextResponse.json({
      success: true,
      id: form.id,
      title: form.title,
      fieldCount: parsed.fields?.length || 0,
    })
  } catch (err) {
    console.error('AI build error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
