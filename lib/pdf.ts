import type { Submission, FormField } from './supabase'

export async function generateSubmissionPDF(
  submission: Submission,
  fields: FormField[]
): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 20
  const contentW = pageW - margin * 2
  let y = margin

  // Header background
  doc.setFillColor(26, 26, 46)
  doc.rect(0, 0, pageW, 42, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Innovative Air Technologies', margin, 16)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(submission.form_title || 'Form Submission', margin, 30)

  y = 54

  // Metadata row
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(120, 120, 120)
  const submitted = new Date(submission.submitted_at).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  doc.text(`Submitted: ${submitted}`, margin, y)
  doc.text(`Submission ID: ${submission.id}`, margin, y + 5)
  y += 16

  // Divider
  doc.setDrawColor(230, 230, 230)
  doc.line(margin, y, pageW - margin, y)
  y += 10

  const sortedFields = [...fields].sort((a, b) => a.sort_order - b.sort_order)

  for (const field of sortedFields) {
    const rawValue = submission.data[field.label]
    let displayValue = '—'

    if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
      if (Array.isArray(rawValue)) {
        displayValue = rawValue.join(', ')
      } else if (typeof rawValue === 'string' && rawValue.startsWith('data:image')) {
        // Signature — embed image
        const imgData = rawValue
        const imgProps = doc.getImageProperties(imgData)
        const imgW = Math.min(contentW * 0.6, 100)
        const imgH = (imgProps.height * imgW) / imgProps.width

        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(50, 50, 50)
        doc.text(field.label, margin, y)
        y += 6

        if (y + imgH + 6 > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage()
          y = margin
        }

        doc.addImage(imgData, 'PNG', margin, y, imgW, imgH)
        y += imgH + 12
        continue
      } else if (typeof rawValue === 'string' && rawValue.startsWith('http')) {
        displayValue = rawValue
      } else {
        displayValue = String(rawValue)
      }
    }

    // Check page space
    const lineCount = Math.ceil(displayValue.length / 80)
    const blockH = 7 + lineCount * 5 + 8
    if (y + blockH > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage()
      y = margin
    }

    // Field label
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 100, 100)
    doc.text(field.label.toUpperCase(), margin, y)
    y += 6

    // Field value
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(30, 30, 30)
    const lines = doc.splitTextToSize(displayValue, contentW)
    doc.text(lines, margin, y)
    y += lines.length * 5 + 8

    // Light separator
    doc.setDrawColor(240, 240, 240)
    doc.line(margin, y - 2, pageW - margin, y - 2)
  }

  // Footer
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(180, 180, 180)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `IAT Forms Portal · Page ${i} of ${pageCount}`,
      margin,
      doc.internal.pageSize.getHeight() - 10
    )
  }

  return doc.output('blob')
}
