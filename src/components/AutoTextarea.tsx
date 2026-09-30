import { useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react'

export function AutoTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [props.value])
  return <textarea ref={ref} rows={1} {...props} className={'w-full resize-none overflow-hidden bg-transparent outline-none ' + (props.className ?? '')} />
}
