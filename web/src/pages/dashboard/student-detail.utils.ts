/**
 * Fix 10 — pure derivation helper extracted from StudentsPage.
 *
 * Reads fatherEmail / motherEmail from an already-loaded list row so
 * handleSelectDetail does not need to fire an extra GET /students/:id.
 */

type AnyRow = { id: string; [key: string]: unknown };

/**
 * Given the already-loaded adminData list and a studentId, return the
 * fatherEmail / motherEmail for the guardian email pre-fill, or null if
 * the student is not in the list.
 *
 * The API returns these extra fields on every list row even though the
 * TypeScript generic for useApiList doesn't declare them.
 */
export function deriveDetailStudent(
  adminData: AnyRow[] | undefined,
  studentId: string,
): { fatherEmail?: string; motherEmail?: string } | null {
  const row = adminData?.find((s) => s.id === studentId);
  if (!row) return null;
  return {
    fatherEmail: (row.fatherEmail as string | null | undefined) ?? undefined,
    motherEmail: (row.motherEmail as string | null | undefined) ?? undefined,
  };
}
