# Proposal — docente-grade-entry (Fase D, Terciario)

## Intent
Today every Terciario grading endpoint is locked to secretaría (`@Roles GRADES` + `@Levels TERCIARIO`, no Door 3). Docentes cannot load their own grades. We need teachers to enter **cursada** for the materias they actually teach, with per-materia isolation so a docente only touches their own students. Success: a docente authenticated with GRADES + TERCIARIO can create/edit cursada slots and confirm regularidad **only** on assigned materias; a non-assigned docente is rejected; secretaría keeps full access unchanged.

## Scope
**In**
- Docente creates/edits `NotaCursadaTerciario` slots (parciales / TP / recuperatorios) on assigned materias.
- Docente confirms regularidad (`InscripcionMateria.estado` → REGULAR / LIBRE / PROMOCIONAL) on assigned materias.
- Docente reads inscripciones/students of their assigned materia (to know whom to grade).
- New entity `DocenteXMateriaCarrera` + admin endpoint (secretaría, GRADES) to assign/list/unassign docentes.

**Out**
- Finales entirely — `ActaExamen` creation and final-nota registration stay with secretaría/tribunal.
- AcademicCycle integration for Terciario (stays year-scoped via `anioAcademico` string).
- Web UI — this change is backend-only.

## Approach (Approach A)
1. **Entity** `DocenteXMateriaCarrera { id, userId (master User.id, AD-6 soft ref), materiaCarreraId, anioAcademico (String), active, timestamps }`. Per materia + año; co-teaching allowed (N docentes per materia/year). Uses `User.id` directly — NOT `DocenteXCiclo` — because Terciario has no AcademicCycle. Mirrors `InscripcionMateria`'s userId + anioAcademico style.
2. **`TerciarioAuthorizerService`** in `api/src/application/grading/` — the Terciario "Door 3", mirroring `AssignmentAuthorizer`. Door 2 (`isAdministrative`, rank ≥ SECRETARIO) keeps its bypass so secretaría retains full access; teacher path checks `DocenteXMateriaCarrera` for (userId, materiaCarreraId, anioAcademico). Provide a Terciario equivalent of `getAllowedStudentIds` for read-scoping (mirrors the merged `notas-get-authz-grupo` work).
3. **Admin endpoint** (secretaría / GRADES) to assign / list / unassign docentes ↔ materias.
4. **Ownership integration** in `nota-cursada-terciario.controller.ts`: keep `@Roles GRADES` + `@Levels TERCIARIO` at the door, inject `@CurrentUser`, and add a `TerciarioAuthorizerService` ownership check in the use-case/controller so a non-admin docente only touches assigned materias.

## Dependencies
None blocking. Retiro-teacher epic merged; `retiro-grading-legacy-s3pre` is independent (Terciario doesn't touch SubjectAssignment/Teacher). Builds on already-merged docente-ciclo-grupos, evaluacion-terciario, boletin-terciario.

## Risks / Open Questions
- **RBAC action mismatch (flag):** RBAC seed shows TEACHER `role_modules` GRADES = `[CREATE, READ]` (no UPDATE), while the docente *profile* has GRADES READ/CREATE/UPDATE. The cursada controller uses `action: 'UPDATE'` for `confirmar`/`promocionar`. Depending on which the guard reads, a docente may fail Door 1 on confirmar. Confirm whether docente already has GRADES:UPDATE at the door or a new grant is needed — Door 3 alone otherwise restricts.
- **Confirmar regularidad ownership (flag):** user decided cursada incl. regularidad → docente-allowed, but LIBRE/PROMOCIONAL are condition-defining decisions with downstream effects; flag for review whether these stay docente-allowed or revert to secretaría-only.
- New schema migration (tenant) + admin assignment surface; ~15-20 files touched.
