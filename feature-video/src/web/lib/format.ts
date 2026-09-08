/** Milliseconds as seconds, the unit the cue sheet is read in. */
export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** How far after its planned moment a gesture may land before the report flags it. */
export const LATE_MS = 500;

export function bytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
