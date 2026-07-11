/**
 * no-infra-pdf-import (ADR-06) — PDP-S2.
 *
 * Architecture test: no file under `api/src/application/` MUST import the
 * concrete `PdfGeneratorService` class or any path under
 * `infrastructure/reporting/pdf-generator.service`. `application/` MUST
 * depend only on the `PdfPort` contract / `PDF_PORT` token.
 *
 * Two assertions, PATH-based first (see design.md §4 for the rationale):
 *   - PRIMARY (robust): no import statement references the infra file PATH.
 *   - SECONDARY: no `import` line declares the `PdfGeneratorService` identifier.
 *
 * CRITICAL: do NOT implement this as a bare `\bPdfGeneratorService\b` search
 * over the whole file. `generate-attendance-types-pdf.use-case.ts` and
 * `generate-asistencia-mensual-pdf.use-case.ts` carry a JSDoc comment with
 * the literal text `PdfGeneratorService.generatePdf` — a class-name-only
 * search (unrestricted to import lines) would false-positive on that
 * comment forever, even after the refactor. Both assertions here are
 * restricted to import statements / the import path.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const APPLICATION_ROOT = path.resolve(__dirname, '..');

const FORBIDDEN_PATH = /from\s+['"][^'"]*infrastructure\/reporting\/pdf-generator\.service['"]/;
const FORBIDDEN_IMPORT = /^\s*import\b[^;]*\bPdfGeneratorService\b/m;

function collectTsFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name === '__tests__') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('application/ does not import infra PdfGeneratorService (PDP-S2)', () => {
  const files = collectTsFiles(APPLICATION_ROOT);

  it('no file imports the infra path infrastructure/reporting/pdf-generator.service', () => {
    const offenders = files.filter((f) => FORBIDDEN_PATH.test(fs.readFileSync(f, 'utf-8')));
    expect(offenders.map((f) => path.relative(APPLICATION_ROOT, f))).toEqual([]);
  });

  it('no import statement declares the PdfGeneratorService identifier', () => {
    const offenders = files.filter((f) => FORBIDDEN_IMPORT.test(fs.readFileSync(f, 'utf-8')));
    expect(offenders.map((f) => path.relative(APPLICATION_ROOT, f))).toEqual([]);
  });
});
