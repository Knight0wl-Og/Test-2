/**
 * Chart drawing primitives — trendlines, horizontal levels, Fibonacci
 * retracements. lightweight-charts has no built-in drawing layer, so
 * drawings are rendered on a transparent canvas positioned over the chart
 * and re-projected from (time, price) anchors on every pan/zoom.
 * Drawings persist per symbol in localStorage.
 */

export type DrawingTool = 'none' | 'trend' | 'hline' | 'fib';

export interface DrawPoint {
  time: number;  // unix seconds (bar time)
  price: number;
}

export interface Drawing {
  id: string;
  type: Exclude<DrawingTool, 'none'>;
  points: DrawPoint[]; // hline: 1 point · trend/fib: 2 points
}

const KEY_PREFIX = 'tradeedge_drawings_';

export function loadDrawings(symbol: string): Drawing[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY_PREFIX + symbol) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveDrawings(symbol: string, drawings: Drawing[]): void {
  try {
    if (drawings.length === 0) localStorage.removeItem(KEY_PREFIX + symbol);
    else localStorage.setItem(KEY_PREFIX + symbol, JSON.stringify(drawings));
  } catch { /* storage full — ignore */ }
}

// ─── Rendering ───────────────────────────────────────────────────────────────

const STYLE = {
  trend:  { stroke: '#3b82f6', anchor: '#93c5fd' },
  hline:  { stroke: '#eab308' },
  fib:    { stroke: '#a78bfa', fill: 'rgba(167,139,250,0.06)' },
  preview:{ stroke: 'rgba(148,163,184,0.7)' },
  label:  { font: '9px "JetBrains Mono", monospace', color: '#9ca3af' },
};

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

type ToX = (time: number) => number | null;
type ToY = (price: number) => number | null;

function drawTrend(ctx: CanvasRenderingContext2D, d: Drawing, toX: ToX, toY: ToY) {
  const [a, b] = d.points;
  const x1 = toX(a.time); const y1 = toY(a.price);
  const x2 = toX(b.time); const y2 = toY(b.price);
  if (x1 == null || y1 == null || x2 == null || y2 == null) return;
  ctx.strokeStyle = STYLE.trend.stroke;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  // Anchor dots
  ctx.fillStyle = STYLE.trend.anchor;
  for (const [x, y] of [[x1, y1], [x2, y2]] as const) {
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHLine(ctx: CanvasRenderingContext2D, d: Drawing, w: number, toY: ToY) {
  const y = toY(d.points[0].price);
  if (y == null) return;
  ctx.strokeStyle = STYLE.hline.stroke;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(w, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = STYLE.label.font;
  ctx.fillStyle = STYLE.hline.stroke;
  ctx.fillText(d.points[0].price.toFixed(2), 4, y - 3);
}

function drawFib(ctx: CanvasRenderingContext2D, d: Drawing, w: number, toX: ToX, toY: ToY) {
  const [a, b] = d.points;
  const xA = toX(a.time);
  const xB = toX(b.time);
  const xStart = Math.min(xA ?? 0, xB ?? 0);
  const p1 = a.price;
  const p2 = b.price;
  ctx.font = STYLE.label.font;

  let prevY: number | null = null;
  for (const lvl of FIB_LEVELS) {
    const price = p2 + (p1 - p2) * lvl; // 0 at second anchor, 1 at first
    const y = toY(price);
    if (y == null) continue;
    // Zebra fill between levels
    if (prevY != null) {
      ctx.fillStyle = STYLE.fib.fill;
      ctx.fillRect(xStart, Math.min(prevY, y), w - xStart, Math.abs(y - prevY));
    }
    ctx.strokeStyle = STYLE.fib.stroke;
    ctx.lineWidth = lvl === 0 || lvl === 1 ? 1.2 : 0.7;
    ctx.beginPath();
    ctx.moveTo(xStart, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.fillStyle = STYLE.fib.stroke;
    ctx.fillText(`${lvl} · ${price.toFixed(2)}`, xStart + 4, y - 3);
    prevY = y;
  }
}

export function renderDrawings(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  drawings: Drawing[],
  toX: ToX,
  toY: ToY,
  /** In-progress drawing preview: first anchor + current cursor position (px) */
  pending?: { point: DrawPoint; cursorX: number; cursorY: number } | null
): void {
  ctx.clearRect(0, 0, width, height);

  for (const d of drawings) {
    if (d.type === 'trend' && d.points.length === 2) drawTrend(ctx, d, toX, toY);
    else if (d.type === 'hline' && d.points.length >= 1) drawHLine(ctx, d, width, toY);
    else if (d.type === 'fib' && d.points.length === 2) drawFib(ctx, d, width, toX, toY);
  }

  // Live preview from first anchor to cursor
  if (pending) {
    const x1 = toX(pending.point.time);
    const y1 = toY(pending.point.price);
    if (x1 != null && y1 != null) {
      ctx.strokeStyle = STYLE.preview.stroke;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(pending.cursorX, pending.cursorY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = STYLE.trend.anchor;
      ctx.beginPath();
      ctx.arc(x1, y1, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
