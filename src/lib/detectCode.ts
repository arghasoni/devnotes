import hljs from 'highlight.js'

// Languages the editor offers, mapped to highlight.js names for auto-detection
const HLJS: Record<string, string> = {
  bash: 'bash', powershell: 'powershell', javascript: 'javascript', typescript: 'typescript', python: 'python',
  json: 'json', yaml: 'yaml', sql: 'sql', html: 'xml', css: 'css', dockerfile: 'dockerfile', go: 'go', rust: 'rust', java: 'java',
}
const FROM_HLJS = Object.fromEntries(Object.entries(HLJS).map(([k, v]) => [v, k]))

const SHELL = new Set(('git npm npx yarn pnpm node deno bun docker docker-compose kubectl helm terraform pip pip3 python python3 py ' +
  'cd ls dir mkdir rm rmdir cp mv cat touch chmod chown echo export set curl wget ssh scp sudo apt apt-get brew choco winget ' +
  'tree grep find sed awk tar unzip code make cargo go dotnet java mvn gradle az aws gcloud appwrite vercel firebase ' +
  'systemctl service ping ipconfig ifconfig netstat nslookup tail head ps kill nvm pm2 gh claude').split(' '))

const CODE_LINE = /[{};]\s*$|^\s*[}\])]|=>|^\s*(import|from|export|def|class|function|const|let|var|return|if|for|while|public|private|package|#include|SELECT|INSERT|UPDATE|DELETE|CREATE)\b|^\s{2,}\S|^\s*<\/?[a-z][\w-]*[\s>]|^\s*[\w-]+:\s|^\s*[$#>] /i

/**
 * Guesses whether pasted text is code/a command and which language.
 * Returns null for ordinary prose. `shellLang` is used for plain terminal commands.
 */
export function detectCode(raw: string, shellLang = 'bash'): string | null {
  const text = raw.trim()
  if (!text || text.length > 50_000) return null
  const lines = text.split('\n')

  if (/^[[{]/.test(text)) { try { JSON.parse(text); return 'json' } catch { /* not JSON */ } }

  // A terminal command: optional prompt, then a known program
  const first = lines[0].replace(/^(PS [^>]*>|\$|>)\s*/, '')
  const word = first.split(/\s+/)[0]
  const words = first.split(/\s+/).length
  if (/^[A-Z][a-z]+-[A-Z][A-Za-z]+$/.test(word) || /\$env:/.test(text)) return 'powershell'
  const sentence = /[.!?]$/.test(first) && words > 4 && !/\s-{1,2}\w/.test(first)
  if (SHELL.has(word.toLowerCase()) && lines.length <= 40 && !sentence && (words > 1 || lines.length > 1)) return shellLang

  // Multi-line code: most lines look like code
  if (lines.length >= 2) {
    const nonEmpty = lines.filter(l => l.trim())
    const codey = nonEmpty.filter(l => CODE_LINE.test(l)).length
    if (codey / nonEmpty.length >= 0.5) {
      const r = hljs.highlightAuto(text, Object.values(HLJS))
      return (r.language && FROM_HLJS[r.language]) || 'plaintext'
    }
  }
  return null
}
