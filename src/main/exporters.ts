import { BrowserWindow } from 'electron'
import { Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, TextRun } from 'docx'
import { htmlDocument, markdownToHtml, parseBlocks, parseInline } from '../shared/markdown'

export async function markdownToDocx(md: string): Promise<Buffer> {
  const headingFor = [HeadingLevel.TITLE, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3]
  const children = parseBlocks(md).map((b) => {
    const runs = parseInline(b.text).map((s) =>
      s.link && /^https?:\/\//.test(s.link)
        ? new ExternalHyperlink({ link: s.link, children: [new TextRun({ text: s.text, style: 'Hyperlink' })] })
        : new TextRun({ text: s.text, bold: s.bold, italics: s.italic })
    )
    if (b.type === 'heading') return new Paragraph({ heading: headingFor[Math.min(b.level - 1, 3)], children: runs })
    if (b.type === 'bullet') return new Paragraph({ bullet: { level: 0 }, children: runs })
    if (b.type === 'numbered') return new Paragraph({ children: [new TextRun(`${b.n}. `), ...runs] })
    return new Paragraph({ children: runs, spacing: { after: 120 } })
  })
  const doc = new Document({ sections: [{ children }] })
  return Packer.toBuffer(doc)
}

/** Renders the Markdown in a hidden, offline window and prints it to PDF. */
export async function markdownToPdf(md: string, title: string): Promise<Buffer> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, javascript: false, contextIsolation: true }
  })
  try {
    const html = htmlDocument(title, markdownToHtml(md))
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0.6, bottom: 0.6, left: 0.7, right: 0.7 }
    })
  } finally {
    win.destroy()
  }
}
