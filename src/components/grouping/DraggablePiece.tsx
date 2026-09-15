"use client";

import { motion } from "framer-motion";
import { useRef, type ReactNode, type RefObject } from "react";

interface DraggablePieceProps {
  readonly dropZone: RefObject<HTMLElement | null>;
  /** Called when the piece is released over the drop zone, or tapped. */
  readonly onDrop: () => void;
  readonly disabled: boolean;
  readonly label: string;
  /** Lets the drop zone light up while a piece is in the air. */
  readonly onDragActive: (active: boolean) => void;
  readonly children: ReactNode;
}

/** A point in page coordinates, which is what Framer reports. */
export interface DragPoint {
  readonly x: number;
  readonly y: number;
}

/** How far the page has been scrolled when the piece is released. */
export interface PageScroll {
  readonly x: number;
  readonly y: number;
}

/**
 * Whether a released piece landed in the drop zone. Its own function because
 * Framer reports `info.point` in *page* coordinates while
 * `getBoundingClientRect` is viewport-relative; on a scrolled page the two
 * differ by the scroll offset.
 */
export function landedInZone(
  point: DragPoint,
  rect: { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number },
  scroll: PageScroll,
): boolean {
  const x = point.x - scroll.x;
  const y = point.y - scroll.y;
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * A piece the child drags into a drop zone. Tapping it also places it, so the
 * mechanic works with a keyboard, a mouse, or a finger — dragging alone would
 * shut out anyone who cannot do it.
 */
export function DraggablePiece({
  dropZone,
  onDrop,
  disabled,
  label,
  onDragActive,
  children,
}: DraggablePieceProps) {
  // Distinguishes a real drag from a tap: pointerdown clears it, a drag sets
  // it, and the click that follows a drag is then ignored.
  // Distinguishes a real drag from a tap: pointerdown clears it, a drag sets
  // it, and the click that follows a drag is then ignored.
  const dragging = useRef(false);

  return (
    <motion.button
      type="button"
      aria-label={label}
      disabled={disabled}
      drag={!disabled}
      dragSnapToOrigin
      dragElastic={0.2}
      dragMomentum={false}
      whileDrag={{ scale: 1.15, rotate: -4, zIndex: 50 }}
      whileHover={disabled ? {} : { y: -3 }}
      onPointerDown={() => {
        dragging.current = false;
      }}
      onDragStart={() => {
        dragging.current = true;
        onDragActive(true);
      }}
      onDragEnd={(_event, info) => {
        onDragActive(false);
        const zone = dropZone.current;
        if (zone === null) return;
        const scroll = { x: window.scrollX, y: window.scrollY };
        if (landedInZone(info.point, zone.getBoundingClientRect(), scroll)) {
          onDrop();
        }
      }}
      onClick={() => {
        if (!dragging.current) onDrop();
      }}
      className="relative flex min-h-11 min-w-11 cursor-grab touch-none items-center justify-center rounded-xl border-2 border-edge bg-surface p-2 shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand active:cursor-grabbing disabled:cursor-default disabled:opacity-50"
    >
      {children}
    </motion.button>
  );
}
