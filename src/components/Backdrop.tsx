/** Soft animated colour blobs behind a page. */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="animate-blob absolute -top-32 -left-24 h-96 w-96 rounded-full bg-indigo-400/25 blur-3xl dark:bg-indigo-600/20" />
      <div className="animate-blob absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-sky-300/25 blur-3xl [animation-delay:-5s] dark:bg-sky-500/15" />
      <div className="animate-blob absolute -bottom-40 left-1/3 h-[28rem] w-[28rem] rounded-full bg-violet-300/20 blur-3xl [animation-delay:-9s] dark:bg-violet-600/15" />
    </div>
  )
}

export function Logo({ size = 28 }: { size?: number }) {
  return <img src="/logo.png" alt="" width={size} height={size} className="drop-shadow-md" />
}
