# Tasks: Boletín Terciario (Fase C)

**Change:** boletin-terciario  
**Depends on:** evaluacion-terciario (feat/evaluacion-terciario, PR #23 merged)  
**Delivery strategy:** single-pr (production diff ~200 lines; no chaining needed)  
**Test runner:** `pnpm test` — **Strict TDD Mode: ACTIVE** — Coverage ≥ 80%

---

## Review Workload Forecast

| Metric | Estimate |
|--------|----------|
| Production code lines changed | ~200 (types ~40, use-case ~100, template ~60 net) |
| Test lines added | ~300 (new test file, ~15 test cases) |
| Total diff | ~500 |
| 400-line budget risk | **Low** (production only; tests are additive) |
| Chained PRs recommended | No — all changes are cohesive in one small feature |
| Decision needed before apply | No — single-pr approved; no size:exception required |

---

## Dependency graph

```
TASK-0 (schema verify) ──► TASK-T1 (failing tests) ──► TASK-I1 (types)
                                                             │
                                                   ┌─────────┴──────────┐
                                                   ▼                    ▼
                                            TASK-I2 (use-case)    TASK-I3 (template)
                                                   │                    │
                                                   └────────┬───────────┘
                                                            ▼
                                                     TASK-V1 (verify)
```

**TASK-I2** and **TASK-I3** are parallel (both unblock after TASK-I1 completes).

---

## Tasks

---

### TASK-0 — Verify schema field names [PREP] ✓

**Type:** preparation  
**Parallel:** Yes — independent; resolve before any impl task  
**Target files:** `api/prisma_tenant/schema.prisma`

**Action:** Read the Prisma tenant schema and confirm:
- `InscripcionMateria` has: `studentId`, `anioAcademico`, `estado String`, `cuatrimestre String`, `notaCursada Float?`, relation `notasCursada NotaCursadaTerciario[]`, relation `materiaCarrera MateriaCarrera`
- `MateriaCarrera` has: relation `subject Subject`, relation `carrera Carrera`
- `Carrera` has: field `name`
- `ActaExamenNota` has: `studentId`, `nota Float`, `condicion String`, `intento Int`, relation `acta ActaExamen`
- `ActaExamen` has: `materiaCarreraId`, `fecha DateTime`, `active Boolean`

**Done-criteria:** All field names confirmed (or discrepancies noted in a comment at the top of TASK-I2 before coding). No action taken on files if everything matches the design.

**Satisfies:** REQ-2, REQ-3, REQ-4, REQ-5, REQ-8 (schema grounding)

---

### TASK-T1 — Create failing test file [TEST-FIRST] ✓

**Type:** test  
**Requires:** TASK-0  
**Target files:** `api/src/application/reportes/__tests__/generate-boletin.terciario.test.ts` *(new file)*

**Action:** Create the test file with the following structure (all tests fail at this point because `buildMateriasTerciario` and the new types do not yet exist):

1. **Mock factories:**
   - `makePdfGenerator()`, `makePdfStorage()`, `makePrisma()` — identical pattern to `generate-boletin.inicial.test.ts`
   - `makeTerciarioClient(opts: { inscripciones?, finales? })` — exposes `inscripcionMateria.findMany`, `actaExamenNota.findMany`, `notaTrimestral.findMany`, `courseCycle.findMany`, `attendance.findMany` as vi.fn mocks
   - `makeInscripcion(opts)` — plain shaped object with: `{ materiaCarreraId, cuatrimestre, estado, notaCursada, notasCursada: [{slot, nota}], materiaCarrera: { subject: { name }, carrera: { name } } }`
   - `makeFinal(opts)` — `{ intento, nota, condicion, acta: { materiaCarreraId, fecha } }`

2. **Test cases covering all spec scenarios (1:1 mapping):**

   | Test describe | Scenarios covered | Assert |
   |---|---|---|
   | `dispatch — level 40` | 1.1 | `inscripcionMateria.findMany` called; result non-empty materias |
   | `dispatch — level 10 no-regression` | 1.2 | `inscripcionMateria.findMany` NOT called; `notaTrimestral.findMany` pathway used |
   | `inclusion — CURSANDO included` | 2.1 | materia with estado=CURSANDO appears in result |
   | `inclusion — REGULAR included` | 2.2 | materia with estado=REGULAR appears |
   | `inclusion — LIBRE excluded` | 2.3 | assert `where.estado.in` arg does NOT contain 'LIBRE'; result empty |
   | `inclusion — other anioAcademico excluded` | 2.4 | assert `where.anioAcademico === enrollment.academicYear` |
   | `slots — one nota, four null` | 3.1 | `slotsCursada` length 5; PARCIAL_1 nota=7; others null |
   | `slots — all five notas` | 3.2 | `slotsCursada` length 5; all slots have numeric nota |
   | `slots — zero notas` | 3.3 | `slotsCursada` length 5; all nota null |
   | `condicionCursada — REGULAR maps "Regular"` | 4.1 | `condicionCursada === 'Regular'` |
   | `notaCursadaConfirmada — null for CURSANDO without nota` | 4.2 | `notaCursadaConfirmada === null` |
   | `finales — three across years, chronological` | 5.1 | `intentosFinales` length 3, ordered by fecha asc |
   | `finales — no records → empty array` | 5.2 | `intentosFinales` equals `[]` |
   | `finales — LIBRE never surfaced` | 5.3 | `actaExamenNota.findMany` not called with LIBRE materiaCarreraId |
   | `carreraName — from Carrera.name` | 6.1 | result `carreraName === 'Profesorado de Lengua'` |
   | `carreraName — fallback to enrollment.grade` | 6.2 | result `carreraName === enrollment.grade` when carrera.name absent |
   | `carreraName — both absent → null` | 6.3 | result `carreraName === null`; no crash |
   | `grouping — 1C + 2C both present` | 7.1 | `cuatrimestresTerciario` has 2 groups; 1C first, 2C second |
   | `grouping — missing cuatrimestre not lost` | 7.2 | materia with no cuatrimestre appears in ANUAL/other group |
   | `no N+1 — 10 materias, 2 queries` | 8.1 | `inscripcionMateria.findMany` called once; `actaExamenNota.findMany` called once |

3. Each test invokes `(uc as any).buildMaterias(mockClient, enrollment)` with `enrollment.level = 40` (for Terciario tests) or `enrollment.level = 10` (for the level-10 regression test).

**Done-criteria:** File exists; `pnpm test` reports failing tests (not compile errors from missing types — adjust imports to be lenient or use `as any` for now).  
**Satisfies:** REQ-9 (test coverage scaffolding), all REQ scenarios

---

### TASK-I1 — Add Terciario types to `boletin.template.ts` [IMPL] ✓

**Type:** implementation  
**Requires:** TASK-T1  
**Target files:** `api/src/application/reportes/templates/boletin.template.ts`

**Action:**

1. Add import at top of file:
   ```ts
   import type { SlotCursadaTerciarioValue } from '@educandow/domain';
   ```

2. Add three new interfaces (after the existing Secundario types, before `MateriaBoletin`):
   ```ts
   export interface SlotCursadaBoletin {
     slot: SlotCursadaTerciarioValue;
     nota: number | null;
   }

   export interface IntentoFinalBoletin {
     intento: number;
     nota: number;
     condicion: string;  // "Aprobado" | "Desaprobado" | "Ausente"
   }

   export interface GrupoCuatrimestreBoletin {
     cuatrimestre: string;  // "1C" | "2C" | "ANUAL"
     materias: MateriaBoletin[];
   }
   ```

3. Extend `MateriaBoletin` with optional Terciario fields (all optional — backward-compatible):
   ```ts
   slotsCursada?:           SlotCursadaBoletin[];
   notaCursadaConfirmada?:  number | null;
   condicionCursada?:       string | null;
   intentosFinales?:        IntentoFinalBoletin[];
   cuatrimestre?:           string;
   ```

4. Extend `DatosBoletin` with optional Terciario fields:
   ```ts
   carreraName?:              string | null;
   cuatrimestresTerciario?:   GrupoCuatrimestreBoletin[];
   ```

**Done-criteria:** `pnpm --filter api typecheck` passes; test file compiles without import errors; existing level types remain unchanged and backward-compatible.  
**Satisfies:** REQ-3, REQ-4, REQ-5, REQ-6, REQ-7 (type layer)

---

### TASK-I2 — Implement `buildMateriasTerciario()` + dispatch + wire `execute()` [IMPL] ✓

**Type:** implementation  
**Requires:** TASK-I1  
**Parallel:** Can run in parallel with TASK-I3 after TASK-I1  
**Target files:** `api/src/application/reportes/generate-boletin.use-case.ts`

**Action:**

1. **Widen `buildMaterias` return type** to include `carreraName?: string | null` and `cuatrimestresTerciario?: GrupoCuatrimestreBoletin[]`. Update the import at the top to include the new types from `boletin.template.ts`.

2. **Widen `buildMaterias` enrollment param type** to include `grade?: string | null` (already on runtime object per the design — only the TS param type needs widening).

3. **Insert decade-4 dispatch** in `buildMaterias()` BEFORE the legacy `if (!enrollment.cycleId)` block:
   ```ts
   // ── Terciario path (decade 4) ──────────────────────────────────────────────
   if (Math.floor(enrollment.level / 10) === 4) {
     return this.buildMateriasTerciario(client, enrollment);
   }
   ```

4. **Add `buildMateriasTerciario` private method** implementing:

   a. Constants (defined at method scope or as file-level constants):
      ```ts
      const ESTADOS_INCLUIDOS = ['INSCRIPTO', 'CURSANDO', 'REGULAR', 'PROMOCIONAL', 'APROBADO'];
      const SLOT_ORDER: SlotCursadaTerciarioValue[] = ['PARCIAL_1', 'PARCIAL_2', 'RECUPERATORIO_PARCIAL_1', 'RECUPERATORIO_PARCIAL_2', 'TP'];
      const CONDICION_LABEL: Record<string, string> = {
        INSCRIPTO: 'Inscripto', CURSANDO: 'Cursando', REGULAR: 'Regular',
        PROMOCIONAL: 'Promocional', APROBADO: 'Aprobado',
      };
      const CONDICION_FINAL_LABEL: Record<string, string> = {
        APROBADO: 'Aprobado', DESAPROBADO: 'Desaprobado', AUSENTE: 'Ausente',
      };
      ```

   b. **Query 1** — inscripciones with full include chain (REQ-2, REQ-8):
      ```ts
      const inscripciones = await client.inscripcionMateria.findMany({
        where: {
          studentId: enrollment.studentId,
          anioAcademico: enrollment.academicYear,
          estado: { in: [...ESTADOS_INCLUIDOS] },
        },
        include: {
          notasCursada: true,
          materiaCarrera: { include: { subject: true, carrera: true } },
        },
        orderBy: [{ cuatrimestre: 'asc' }, { materiaCarreraId: 'asc' }],
      });
      ```

   c. **Query 2** — finales bulk (REQ-5, REQ-8):
      ```ts
      const materiaCarreraIds = [...new Set(inscripciones.map(i => i.materiaCarreraId))];
      const notasFinales = materiaCarreraIds.length === 0 ? [] :
        await client.actaExamenNota.findMany({
          where: {
            studentId: enrollment.studentId,
            acta: { materiaCarreraId: { in: materiaCarreraIds }, active: true },
          },
          include: { acta: { select: { materiaCarreraId: true, fecha: true } } },
          orderBy: [{ acta: { fecha: 'asc' } }, { intento: 'asc' }],
        });
      ```
      > **Risk R1 (from design):** If Prisma rejects `orderBy: { acta: { fecha: 'asc' } }` on a to-one relation at runtime, fall back to in-memory sort: `notasFinales.sort((a, b) => a.acta.fecha.getTime() - b.acta.fecha.getTime() || a.intento - b.intento)`.

   d. **Index finales by materiaCarreraId** for O(1) assembly:
      ```ts
      const finalesByMC = new Map<string, typeof notasFinales>();
      for (const n of notasFinales) {
        const k = n.acta.materiaCarreraId;
        if (!finalesByMC.has(k)) finalesByMC.set(k, []);
        finalesByMC.get(k)!.push(n);
      }
      ```

   e. **Per-inscripcion assembly** (REQ-3, REQ-4, REQ-5):
      - `slotsCursada`: Map from `notasCursada` by slot key; `SLOT_ORDER.map(slot => ({ slot, nota: notaBySlot.get(slot) ?? null }))`
      - `notaCursadaConfirmada = insc.notaCursada ?? null`
      - `condicionCursada = CONDICION_LABEL[insc.estado] ?? null`
      - `intentosFinales`: from `finalesByMC.get(insc.materiaCarreraId) ?? []`, map to `{ intento, nota, condicion: CONDICION_FINAL_LABEL[n.condicion] ?? n.condicion }`
      - `nombre = insc.materiaCarrera.subject.name`
      - `cuatrimestre = insc.cuatrimestre`
      - Legacy fields: `notas: [], promedio: '', valoracion: '', aprobado: false, docente: ''`

   f. **Carrera header** (REQ-6):
      ```ts
      const raw = inscripciones[0]?.materiaCarrera?.carrera?.name?.trim();
      const carreraName: string | null =
        raw ? raw : (enrollment.grade?.trim() || null);
      ```

   g. **Cuatrimestre grouping** (REQ-7):
      ```ts
      const CUATRI_ORDER = (c: string) => ({ '1C': 0, '2C': 1 } as Record<string, number>)[c] ?? 2;
      const grupos = new Map<string, MateriaBoletin[]>();
      for (const m of materiasFlat) {
        const k = m.cuatrimestre ?? 'ANUAL';
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k)!.push(m);
      }
      const cuatrimestresTerciario = [...grupos.entries()]
        .sort(([a], [b]) => CUATRI_ORDER(a) - CUATRI_ORDER(b))
        .map(([cuatrimestre, materias]) => ({ cuatrimestre, materias }));
      ```

   h. Return: `{ materias: materiasFlat, carreraName, cuatrimestresTerciario }`

5. **Wire `execute()`** — after `buildMaterias` call, destructure and populate `datos`:
   ```ts
   const { materias, previas, informesInicial, carreraName, cuatrimestresTerciario } =
     await this.buildMaterias(client, enrollment);
   // … in the datos object …
   carreraName,
   cuatrimestresTerciario,
   ```

**Done-criteria:** All TASK-T1 test cases for REQ-1 through REQ-8 pass; `pnpm test` green; legacy levels (10, 20, 30) unaffected.  
**Satisfies:** REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8

---

### TASK-I3 — Rebuild `boletin-terciario.hbs` template [IMPL] ✓

**Type:** implementation  
**Requires:** TASK-I1  
**Parallel:** Can run in parallel with TASK-I2 after TASK-I1  
**Target files:** `api/src/infrastructure/reporting/html-templates/boletin-terciario.hbs`

**Action:** Replace the entire file content with a transcript layout:

1. **`<title>`:** `Analítico Parcial — {{#if carreraName}}{{carreraName}}{{else}}{{grado}}{{/if}}`

2. **Header block** — update "Carrera:" row:
   ```hbs
   <tr><td>Carrera:</td><td>{{#if carreraName}}{{carreraName}}{{else}}{{grado}}{{/if}}</td></tr>
   ```

3. **Materias section** — replace the current `{{#each materias}}` table with:
   ```hbs
   {{#if cuatrimestresTerciario}}
     {{#each cuatrimestresTerciario}}
       <div class="section-title">{{cuatrimestre}}</div>
       <table class="grades">
         <thead>
           <tr>
             <th>Materia</th><th>Condición</th><th>Nota cursada</th>
             <th>P1</th><th>P2</th><th>RP1</th><th>RP2</th><th>TP</th>
             <th>Finales</th>
           </tr>
         </thead>
         <tbody>
           {{#each materias}}
           <tr>
             <td>{{nombre}}</td>
             <td>{{condicionCursada}}</td>
             <td>{{#if notaCursadaConfirmada}}{{notaCursadaConfirmada}}{{/if}}</td>
             {{#each slotsCursada}}
               <td>{{#if nota}}{{nota}}{{/if}}</td>
             {{/each}}
             <td>
               {{#if intentosFinales.length}}
                 {{#each intentosFinales}}
                   {{intento}}: {{nota}} ({{condicion}}){{#unless @last}} · {{/unless}}
                 {{/each}}
               {{/if}}
             </td>
           </tr>
           {{/each}}
         </tbody>
       </table>
     {{/each}}
   {{/if}}
   ```

4. **Keep unchanged:** `{{#if asistencia}}` attendance block, `.footer`, `.signature-line`.

5. **Keep existing CSS** classes (header, student-info, section-title, grades, footer, signature-line, approved, failed). Add no new CSS unless needed for readability.

**Done-criteria:** Template renders valid HTML without Handlebars syntax errors; `carreraName: null` renders empty string without crash; student with 1C + 2C materias renders two grouped sections; student with 0 inscripciones renders empty-but-valid PDF (no `{{#each}}` crash).  
**Satisfies:** REQ-3 (slot columns), REQ-4 (condicion/nota cursada display), REQ-5 (finales display), REQ-6 (carreraName header), REQ-7 (cuatrimestre grouping)

---

### TASK-V1 — Run full test suite + verify coverage [VERIFY] ✓

**Type:** verification  
**Requires:** TASK-I2, TASK-I3  
**Target files:** all

**Action:**

1. `pnpm test` from repo root — must exit 0.
2. `pnpm --filter api test:coverage` — confirm `generate-boletin.use-case.ts` coverage ≥ 80%.
3. `pnpm --filter api typecheck` — zero TypeScript errors.
4. Confirm no regressions in: `generate-boletin.inicial.test.ts`, `generate-boletin.use-case.test.ts`, `generate-boletin.docente-s2.test.ts`.
5. If coverage is below 80%, identify the uncovered branches from TASK-T1 test cases and add the missing assertions before declaring done.

**Done-criteria:** All tests green; `generate-boletin.use-case.ts` ≥ 80% coverage; typecheck clean; no regressions.  
**Satisfies:** REQ-9

---

## Summary

| # | ID | Type | Target file(s) | Sequential after | Parallel OK? | REQs |
|---|-----|------|---------------|-----------------|--------------|------|
| 1 | TASK-0 | prep | schema.prisma | — | yes (first) | 2,3,4,5,8 |
| 2 | TASK-T1 | test | generate-boletin.terciario.test.ts (new) | TASK-0 | yes | 9 + all |
| 3 | TASK-I1 | impl | boletin.template.ts | TASK-T1 | no | 3,4,5,6,7 |
| 4 | TASK-I2 | impl | generate-boletin.use-case.ts | TASK-I1 | yes (with I3) | 1,2,3,4,5,6,7,8 |
| 5 | TASK-I3 | impl | boletin-terciario.hbs | TASK-I1 | yes (with I2) | 3,4,5,6,7 |
| 6 | TASK-V1 | verify | all | TASK-I2 + TASK-I3 | no (gate) | 9 |

**Total tasks:** 6  
**Parallel pairs:** TASK-I2 ∥ TASK-I3 (after TASK-I1 completes)  
**Critical path:** TASK-0 → TASK-T1 → TASK-I1 → TASK-I2 → TASK-V1
