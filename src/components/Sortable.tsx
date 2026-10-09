import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { HTMLAttributes, ReactNode } from 'react'

export type DragHandleProps = HTMLAttributes<HTMLElement> & { ref: (el: HTMLElement | null) => void }

/** Mouse/touch drag (after a 5px move, so clicks still work) + keyboard drag (Space, arrows, Space). */
export function useSortSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}

/** A sortable row. Only the element given `handle` props starts a drag. */
export function SortableItem({ id, children }: { id: string; children: (handle: DragHandleProps, dragging: boolean) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id })
  const handle = { ref: setActivatorNodeRef, ...attributes, ...listeners } as DragHandleProps
  return (
    <div ref={setNodeRef} className={isDragging ? 'relative z-30 opacity-80' : 'relative'}
      style={{ transform: CSS.Translate.toString(transform), transition }}>
      {children(handle, isDragging)}
    </div>
  )
}
