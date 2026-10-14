import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Drag ids: "stack:<artifactId>:<level>", "upgrade:<id>" -> drop ids "slot:<n>", "room:<x,y>". */
export type DragPayload =
  { kind: 'stack'; artifactId: string; level: 1 | 2 | 3 } | { kind: 'upgrade'; upgradeId: string };
export type DropTarget = { kind: 'slot'; slot: number } | { kind: 'room'; roomKey: string };

export const stackDragId = (artifactId: string, level: number): string =>
  `stack:${artifactId}:${level}`;
export const upgradeDragId = (upgradeId: string): string => `upgrade:${upgradeId}`;
export const slotDropId = (slot: number): string => `slot:${slot}`;
export const roomDropId = (roomKey: string): string => `room:${roomKey}`;

export function parseDrag(id: string): DragPayload | null {
  const [kind, a, b] = id.split(':');
  if (kind === 'stack' && a && (b === '1' || b === '2' || b === '3')) {
    return { kind: 'stack', artifactId: a, level: Number(b) as 1 | 2 | 3 };
  }
  if (kind === 'upgrade' && a) return { kind: 'upgrade', upgradeId: a };
  return null;
}

export function parseDrop(id: string): DropTarget | null {
  const sep = id.indexOf(':');
  const kind = id.slice(0, sep);
  const rest = id.slice(sep + 1);
  if (kind === 'slot' && rest !== '') return { kind: 'slot', slot: Number(rest) };
  if (kind === 'room' && rest !== '') return { kind: 'room', roomKey: rest };
  return null;
}

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'id'>;

/** A button that can be clicked or dragged (drag starts after a few pixels of movement). */
export function DragButton({
  dragId,
  children,
  style,
  ...rest
}: ButtonProps & { dragId: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: dragId });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      {...rest}
      style={{
        ...style,
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        zIndex: isDragging ? 50 : undefined,
        position: isDragging ? 'relative' : style?.position,
        opacity: isDragging ? 0.8 : undefined,
      }}
    >
      {children}
    </button>
  );
}

/** A button that highlights while something is dragged over it. */
export function DropButton({
  dropId,
  children,
  className,
  ...rest
}: ButtonProps & { dropId: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: dropId });
  return (
    <button
      ref={setNodeRef}
      className={`${className ?? ''}${isOver ? ' drop-over' : ''}`}
      {...rest}
    >
      {children}
    </button>
  );
}
