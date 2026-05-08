import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  BorderStyle, Table, TableRow, TableCell, WidthType,
} from 'docx'

function parseReportLines(text) {
  const lines = text.split('\n')
  const children = []

  for (const raw of lines) {
    const line = raw.trim()

    if (!line) {
      children.push(new Paragraph({ spacing: { after: 0 } }))
      continue
    }

    // 標題行（含 🟢 🔵）
    if (line.startsWith('標題：') || line.includes('🟢') || line.includes('🔵')) {
      children.push(new Paragraph({
        children: [new TextRun({ text: line.replace(/^標題：/, ''), bold: true, size: 28 })],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 200 },
      }))
      continue
    }

    // 一級標題（中文 section headers）
    const sectionHeaders = ['上次任務回顧', '專案進度討論', '課程進度討論', '本次任務指派', '時程規劃', '預期成果']
    if (sectionHeaders.some(h => line.startsWith(h))) {
      children.push(new Paragraph({
        children: [new TextRun({ text: line, bold: true, size: 24 })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 300, after: 100 },
      }))
      continue
    }

    // 粗體標籤（【...】）
    if (line.startsWith('【')) {
      children.push(new Paragraph({
        children: [new TextRun({ text: line, bold: true, size: 22 })],
        spacing: { before: 200, after: 80 },
      }))
      continue
    }

    // 縮排項目（-> 或 ➤ 開頭）
    if (line.startsWith('->') || line.startsWith('➤')) {
      children.push(new Paragraph({
        children: [new TextRun({ text: line, size: 22 })],
        indent: { left: 480 },
        spacing: { after: 80 },
      }))
      continue
    }

    // 一般行
    children.push(new Paragraph({
      children: [new TextRun({ text: line, size: 22 })],
      spacing: { after: 80 },
    }))
  }

  return children
}

export async function generateWordReport(title, reportText) {
  const doc = new Document({
    sections: [{
      properties: {},
      children: parseReportLines(reportText),
    }],
  })

  return Packer.toBlob(doc)
}

export function downloadWordBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
