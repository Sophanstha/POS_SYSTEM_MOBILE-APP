import type { DiningTable } from "../types/pos";
import { toNumber } from "./pos";


export const CARD_SIZE = 140;
export const CANVAS_PADDING = 24;
const GRID_COLS = 6;
const GRID_GAP = 24;
/** Keep tables where a laptop screen on the web can still show them. */
const MAX_CANVAS_WIDTH = 1600;

export type Point = { x: number; y: number };

/** The web's default grid: 6 tables per row. */
export function defaultSlot(index: number): Point {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  return {
    x: CANVAS_PADDING + col * (CARD_SIZE + GRID_GAP),
    y: CANVAS_PADDING + row * (CARD_SIZE + GRID_GAP),
  };
}

/** Every table on the default grid ("Reset layout"). */
export function defaultLayout(tables: DiningTable[]): Record<string, Point> {
  return Object.fromEntries(tables.map((t, i) => [t.id, defaultSlot(i)]));
}

/** Saved spot of each table; (0, 0) means "never moved" → its default grid slot (same rule as the web). */
export function floorLayout(tables: DiningTable[]): Record<string, Point> {
  return Object.fromEntries(
    tables.map((t, i) => {
      const x = toNumber(t.positionX);
      const y = toNumber(t.positionY);
      return [t.id, x !== 0 || y !== 0 ? { x, y } : defaultSlot(i)];
    }),
  );
}

/** Keep a dragged table on the canvas, in whole pixels. */
export function clampPoint(p: Point): Point {
  return {
    x: Math.round(Math.min(Math.max(0, p.x), MAX_CANVAS_WIDTH - CARD_SIZE)),
    y: Math.round(Math.max(0, p.y)),
  };
}

/** Canvas big enough for every table plus padding. */
export function canvasSize(layout: Record<string, Point>): { width: number; height: number } {
  const points = Object.values(layout);
  return {
    width: points.reduce((max, p) => Math.max(max, p.x + CARD_SIZE + CANVAS_PADDING), 0),
    height: points.reduce((max, p) => Math.max(max, p.y + CARD_SIZE + CANVAS_PADDING), 0),
  };
}