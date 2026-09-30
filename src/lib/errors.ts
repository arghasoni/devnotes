export function reportError(e: unknown) {
  console.error(e)
  window.dispatchEvent(new CustomEvent('app-error', { detail: e instanceof Error ? e.message : String(e) }))
}
