import { CheckSquare, Code2, Heading1, Heading2, Heading3, ImagePlus, Link, List, ListOrdered, Minus, Quote, Table, Terminal, Type } from 'lucide-react'
import type { ReactNode } from 'react'

/** What a command does: insert Markdown in place, or turn into another block type. */
export type SlashAction =
  | { kind: 'markdown'; text: string; caret?: number } // caret: offset from start of inserted text (default: end)
  | { kind: 'code'; lang: string }
  | { kind: 'image' }
  | { kind: 'text' }

export type SlashCommand = { key: string; label: string; hint: string; icon: ReactNode; aliases: string[]; action: SlashAction }

const md = (text: string, caret?: number): SlashAction => ({ kind: 'markdown', text, caret })
const code = (lang: string): SlashAction => ({ kind: 'code', lang })
const i = (C: typeof Type) => <C className="size-4" />

export const SLASH_COMMANDS: SlashCommand[] = [
  { key: 'code', label: 'Code snippet', hint: 'Code block (bash)', icon: i(Code2), aliases: ['snippet', 'pre'], action: code('bash') },
  { key: 'img', label: 'Image', hint: 'Attach a screenshot or picture', icon: i(ImagePlus), aliases: ['image', 'picture', 'screenshot', 'photo'], action: { kind: 'image' } },
  { key: 'text', label: 'Text block', hint: 'Start a new text block', icon: i(Type), aliases: ['paragraph', 'p'], action: { kind: 'text' } },
  { key: 'h1', label: 'Heading 1', hint: '# Big section heading', icon: i(Heading1), aliases: ['title', 'heading'], action: md('# ') },
  { key: 'h2', label: 'Heading 2', hint: '## Medium heading', icon: i(Heading2), aliases: ['heading', 'subtitle'], action: md('## ') },
  { key: 'h3', label: 'Heading 3', hint: '### Small heading', icon: i(Heading3), aliases: ['heading'], action: md('### ') },
  { key: 'bullet', label: 'Bulleted list', hint: '- item', icon: i(List), aliases: ['list', 'ul', 'unordered'], action: md('- ') },
  { key: 'numbered', label: 'Numbered list', hint: '1. item', icon: i(ListOrdered), aliases: ['ol', 'ordered', 'steps'], action: md('1. ') },
  { key: 'todo', label: 'Checklist', hint: '- [ ] task', icon: i(CheckSquare), aliases: ['check', 'task', 'checkbox'], action: md('- [ ] ') },
  { key: 'quote', label: 'Quote', hint: '> quoted text', icon: i(Quote), aliases: ['blockquote', 'note'], action: md('> ') },
  { key: 'divider', label: 'Divider', hint: 'Horizontal line', icon: i(Minus), aliases: ['hr', 'line', 'separator'], action: md('---\n') },
  { key: 'link', label: 'Link', hint: '[text](url)', icon: i(Link), aliases: ['url'], action: md('[text](https://)', 1) },
  { key: 'table', label: 'Table', hint: '2-column Markdown table', icon: i(Table), aliases: ['grid'], action: md('| Column | Column |\n| --- | --- |\n|  |  |', 2) },
  ...([
    ['bash', 'Bash'], ['powershell', 'PowerShell', 'ps', 'pwsh'], ['python', 'Python', 'py'], ['javascript', 'JavaScript', 'js'],
    ['typescript', 'TypeScript', 'ts'], ['json', 'JSON'], ['yaml', 'YAML', 'yml'], ['sql', 'SQL'], ['html', 'HTML'],
    ['css', 'CSS'], ['dockerfile', 'Dockerfile', 'docker'],
  ] as string[][]).map(([lang, name, ...aliases]): SlashCommand => (
    { key: lang, label: `${name} code`, hint: `Code block (${lang})`, icon: i(Terminal), aliases: [...aliases, 'code'], action: code(lang) })),
]

/** Commands matching the text typed after "/", best first. */
export function filterSlash(query: string) {
  const q = query.toLowerCase()
  if (!q) return SLASH_COMMANDS.slice(0, 13)
  const rank = (c: SlashCommand) =>
    c.key === q ? 0 : c.key.startsWith(q) ? 1 : c.aliases.some(a => a.startsWith(q)) ? 2 : c.label.toLowerCase().includes(q) ? 3 : 9
  return SLASH_COMMANDS.map(c => [c, rank(c)] as const).filter(([, r]) => r < 9).sort((a, b) => a[1] - b[1]).map(([c]) => c)
}
