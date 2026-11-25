// A small Markdown reader for the subset Scout writes: headings, paragraphs,
// bullet and numbered lists, **bold**, _italic_ and [links](url).
// Used for the PDF (via HTML) and Word exports.

export type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'numbered'; n: number; text: string }

export function parseBlocks(md: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) blocks.push({ type: 'paragraph', text: para.join(' ') })
    para = []
  }
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd()
    let m: RegExpMatchArray | null
    if (!line.trim()) {
      flush()
    } else if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      flush()
      blocks.push({ type: 'heading', level: m[1].length, text: m[2] })
    } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      flush()
      blocks.push({ type: 'bullet', text: m[1] })
    } else if ((m = line.match(/^\s*(\d+)[.)]\s+(.*)$/))) {
      flush()
      blocks.push({ type: 'numbered', n: Number(m[1]), text: m[2] })
    } else {
      para.push(line.trim())
    }
  }
  flush()
  return blocks
}

export type Span = { text: string; bold?: boolean; italic?: boolean; link?: string }

export function parseInline(text: string): Span[] {
  const spans: Span[] = []
  const re = /\*\*(.+?)\*\*|(?<![\w])_(.+?)_(?![\w])|\[([^\]]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s)\]]+)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) spans.push({ text: text.slice(last, m.index) })
    if (m[1] != null) spans.push({ text: m[1], bold: true })
    else if (m[2] != null) spans.push({ text: m[2], italic: true })
    else if (m[3] != null) spans.push({ text: m[3], link: m[4] })
    else if (m[5] != null) spans.push({ text: m[5], link: m[5] })
    last = re.lastIndex
  }
  if (last < text.length) spans.push({ text: text.slice(last) })
  return spans
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function inlineHtml(text: string): string {
  return parseInline(text)
    .map((s) => {
      const t = escapeHtml(s.text)
      if (s.bold) return `<strong>${t}</strong>`
      if (s.italic) return `<em>${t}</em>`
      if (s.link && /^https?:\/\//.test(s.link)) return `<a href="${escapeHtml(s.link)}">${t}</a>`
      return t
    })
    .join('')
}

export function markdownToHtml(md: string): string {
  const out: string[] = []
  let list: 'ul' | 'ol' | null = null
  const close = () => {
    if (list) out.push(`</${list}>`)
    list = null
  }
  for (const b of parseBlocks(md)) {
    if (b.type === 'bullet' || b.type === 'numbered') {
      const want = b.type === 'bullet' ? 'ul' : 'ol'
      if (list !== want) {
        close()
        out.push(`<${want}>`)
        list = want
      }
      out.push(`<li>${inlineHtml(b.text)}</li>`)
      continue
    }
    close()
    if (b.type === 'heading') out.push(`<h${b.level}>${inlineHtml(b.text)}</h${b.level}>`)
    else out.push(`<p>${inlineHtml(b.text)}</p>`)
  }
  close()
  return out.join('\n')
}

export function htmlDocument(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;font-size:11pt;line-height:1.45;color:#1a1a1a;margin:0;padding:0}
h1{font-size:20pt;margin:0 0 8pt}h2{font-size:14pt;margin:16pt 0 6pt;border-bottom:1px solid #ddd;padding-bottom:2pt}
h3{font-size:12pt;margin:12pt 0 4pt}p{margin:0 0 8pt}ul,ol{margin:0 0 8pt 18pt;padding:0}li{margin:0 0 3pt}
a{color:#1d4ed8;text-decoration:none}em{color:#555}
</style></head><body>${bodyHtml}</body></html>`
}
