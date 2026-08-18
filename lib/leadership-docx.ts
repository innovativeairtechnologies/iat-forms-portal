import {
  AlignmentType, BorderStyle, Document, HeadingLevel, LevelFormat, Packer,
  Paragraph, TextRun, convertInchesToTwip,
} from 'docx'
import type { LeadershipUpdate } from './leadership-update'

// The Word document behind the weekly leadership update.
//
// Deliberately one page and deliberately plain: it exists to be skimmed in a
// minute and forwarded. If a week ever produces more than fits, the fix is
// fewer/shorter lines from the summariser, not a second page here.
//
// docx-js gotchas honoured below: US Letter must be given explicitly (the
// default is A4), bullets come from a numbering config rather than a literal
// "•", and there is no "\n" anywhere — each line is its own Paragraph.

const GREEN = '0A6B36'
const INK = '1F1E1B'
const MUTED = '6B6862'
const RULE = 'D6D3CC'

export async function renderLeadershipDocx(update: LeadershipUpdate): Promise<Buffer> {
  const bullets = (items: string[]) =>
    items.map(text => new Paragraph({
      numbering: { reference: 'dash', level: 0 },
      spacing: { after: 55 },
      children: [new TextRun({ text, size: 17, color: INK })],
    }))

  const heading = (text: string) => new Paragraph({
    spacing: { before: 175, after: 70 },
    children: [new TextRun({ text, bold: true, size: 18, color: GREEN, characterSpacing: 12 })],
  })

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'dash',
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: '–',
          alignment: AlignmentType.LEFT,
          style: {
            paragraph: {
              indent: { left: convertInchesToTwip(0.22), hanging: convertInchesToTwip(0.16) },
            },
          },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },   // US Letter, in DXA
          margin: { top: 720, right: 900, bottom: 620, left: 900 },
        },
      },
      children: [
        new Paragraph({
          spacing: { after: 20 },
          children: [new TextRun({
            text: 'INNOVATIVE AIR TECHNOLOGIES',
            bold: true, size: 15, color: MUTED, characterSpacing: 30,
          })],
        }),
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 30 },
          children: [new TextRun({ text: 'IAT Portal — Weekly Update', bold: true, size: 30, color: INK })],
        }),
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 6 } },
          spacing: { after: 130 },
          children: [new TextRun({
            text: `${update.edition.label}  ·  ${update.edition.range}  ·  all items live in production`,
            size: 17, color: MUTED,
          })],
        }),

        ...(update.sections.length
          ? update.sections.flatMap(s => [heading(s.title), ...bullets(s.items)])
          : [new Paragraph({
              children: [new TextRun({
                text: 'No portal changes were released this week.',
                size: 17, color: MUTED, italics: true,
              })],
            })]),

        new Paragraph({
          spacing: { before: 200 },
          border: { top: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 8 } },
          children: [new TextRun({
            text: 'Everything above is deployed and in use. Prepared automatically from the portal changelog.',
            size: 15, color: MUTED, italics: true,
          })],
        }),

        // ── Part 2, the engineering read ──
        // Appended rather than sent separately: one document means the technical
        // notes are always findable from the summary, and a leadership reader who
        // stops at the rule above has already got what they came for. Omitted
        // entirely when the second generation failed, rather than leaving a
        // heading over nothing.
        ...(update.technical.length
          ? [
              new Paragraph({
                spacing: { before: 420, after: 60 },
                children: [new TextRun({
                  text: 'PART 2 · TECHNICAL DETAIL',
                  bold: true, size: 18, color: GREEN, characterSpacing: 12,
                })],
              }),
              new Paragraph({
                spacing: { after: 160 },
                children: [new TextRun({
                  text: 'The engineering record for the same week. Not required reading for the summary above.',
                  size: 15, color: MUTED, italics: true,
                })],
              }),
              ...update.technical.flatMap(s => [heading(s.title), ...bullets(s.items)]),
            ]
          : []),
      ],
    }],
  })

  return Packer.toBuffer(doc)
}
