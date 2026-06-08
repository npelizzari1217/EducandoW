// ── internalStatus color + label helpers ──────────────────────────────────────
// Color map verbatim from grading-scales.tsx:668-672 (D2 — do NOT invent tokens)

const STATUS_COLOR_MAP: Record<string, string> = {
  APROBADO:    'var(--color-success)',
  NO_APROBADO: 'var(--color-danger)',
  EN_PROCESO:  'var(--color-warning, #f59e0b)',
  LIBRE:       'var(--color-text-muted)',
};

// Labels from grading-scales.tsx:47-52
const STATUS_LABEL_MAP: Record<string, string> = {
  APROBADO:    'Aprobado',
  NO_APROBADO: 'No aprobado',
  EN_PROCESO:  'En proceso',
  LIBRE:       'Libre',
};

export function internalStatusColor(status: string | null): string | undefined {
  if (!status) return undefined;
  return STATUS_COLOR_MAP[status];
}

export function internalStatusLabel(status: string | null): string | undefined {
  if (!status) return undefined;
  return STATUS_LABEL_MAP[status];
}
