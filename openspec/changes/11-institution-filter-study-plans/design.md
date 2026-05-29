# Design: Institution Filter — Consistent Pattern Across All Modules

## Technical Approach

Align the institution filter combobox in `study-plans.tsx`, `teachers.tsx`, and `enrollments.tsx` to match the canonical pattern from `users.tsx` (lines 250-278). Three changes per file: (1) remove `if (isRoot)` guard from institution fetch, (2) add `useEffect` to default ROOT to first institution after fetch, (3) replace non-ROOT disabled `<select>` with disabled `<input type="text">`. No backend changes.

## Architecture Decisions

### Decision: Default ROOT to first institution after fetch

| Option | Tradeoff | Decision |
|--------|----------|----------|
| `useEffect` after institutions load: if ROOT && empty → set first | Simple, follows React patterns, no extra deps | **Selected** |
| Initialize state with async default | Can't — state init is synchronous | Rejected |
| Server-side default in API response | Backend change, out of scope | Rejected |

**Rationale**: The `useEffect` approach is the minimal delta. After `apiClient.get('/institutions')` resolves and populates `institutions` state, a second effect checks `isRoot && !institutionId` and sets `institutionId = institutions[0]?.id ?? ""`. This triggers one re-fetch of the filtered data with the correct institution.

### Decision: Keep per-file pattern (no shared component extraction)

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Extract shared `<InstitutionFilter>` component | Better DRY, but larger refactoring scope | Rejected |
| Inline pattern in each file (copy-paste) | Duplicated code, but minimal risk and scope | **Selected** |

**Rationale**: This change is presentation-layer alignment, not a refactor. Extracting a shared component is a separate change. Each file's filter block has slightly different surrounding layout (flex gaps, labels, button placement), making extraction non-trivial.

## Data Flow

```
Component mount
    │
    ├─ useState(institutionId = userInstitutionId)  // "" for ROOT, real ID for non-ROOT
    │
    ├─ useEffect: GET /institutions → setInstitutions([...])
    │       │
    │       └─► (ROOT only) useEffect: if !institutionId → setInstitutionId(institutions[0]?.id)
    │
    ├─ useApiList('/resource', institutionId ? { institutionId } : undefined)
    │       │
    │       └─► GET /v1/resource?institutionId=inst-1
    │
    └─ User changes select (ROOT only) → setInstitutionId(newId) → re-fetch
```

## File Changes

### 1. `web/src/pages/dashboard/study-plans.tsx` — Modify

| Change | Lines | Detail |
|--------|-------|--------|
| Remove `if (isRoot)` guard | 85-89 | Fetch institutions unconditionally |
| Add default-first effect | After 89 | `useEffect(() => { if (isRoot && !institutionId && institutions.length > 0) setInstitutionId(institutions[0].id); }, [isRoot, institutionId, institutions]);` |
| Replace `{isRoot && (...)}` block | 570-584 | Render for ALL users: ROOT gets `<select>`, non-ROOT gets `<input type="text" disabled>` matching users.tsx pattern |

**Reference code for the filter block** (replace lines 570-584):
```tsx
<div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}>
  <div>
    <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Institución</label>
    {isRoot ? (
      <select
        value={institutionId}
        onChange={e => setInstitutionId(e.target.value)}
        style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', minWidth: '220px' }}
      >
        <option value="">Seleccionar institución</option>
        {institutions.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
      </select>
    ) : (
      <input
        type="text"
        value={institutions.find(i => i.id === institutionId)?.name || config.name || institutionId}
        disabled
        style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: '#f8fafc', color: '#64748b', fontSize: 'var(--text-sm)', minWidth: '220px' }}
      />
    )}
  </div>
</div>
```

### 2. `web/src/pages/dashboard/teachers.tsx` — Modify

| Change | Lines | Detail |
|--------|-------|--------|
| Add default-first effect | After 33 | Same pattern as study-plans |
| Replace disabled select with conditional | 89-101 | ROOT: enabled `<select>`, non-ROOT: disabled `<input type="text">` |
| Remove "Todas" option | 98 | Replace with "Seleccionar institución" (matches canonical) |

**Reference code for the filter block** (replace lines 89-101):
```tsx
<div className="flex gap-md items-center" style={{ marginBottom: 'var(--space-md)' }}>
  <div>
    <label style={{ fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>Filtrar por institución</label>
    {isRoot ? (
      <select
        className="input"
        value={institutionId}
        onChange={e => setInstitutionId(e.target.value)}
        style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 'var(--text-sm)', minWidth: '220px' }}
      >
        <option value="">Seleccionar institución</option>
        {institutions.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
      </select>
    ) : (
      <input
        type="text"
        value={institutions.find(i => i.id === institutionId)?.name || config.name || institutionId}
        disabled
        style={{ padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: '#f8fafc', color: '#64748b', fontSize: 'var(--text-sm)', minWidth: '220px' }}
      />
    )}
  </div>
  <Button variant="ghost" onClick={reload} style={{ marginTop: '1.25rem' }}>Buscar</Button>
</div>
```

### 3. `web/src/pages/dashboard/enrollments.tsx` — Modify

| Change | Lines | Detail |
|--------|-------|--------|
| Add default-first effect | After 31 | Same pattern, but updates `filters.institutionId` via `setFilters` |
| No JSX changes needed | 52-68 | Already has correct ROOT/non-ROOT conditional with disabled input |

**Reference code for the default-first effect** (add after line 31):
```tsx
useEffect(() => {
  if (isRoot && !filters.institutionId && institutions.length > 0) {
    setFilters(f => ({ ...f, institutionId: institutions[0].id }));
  }
}, [isRoot, filters.institutionId, institutions]);
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Manual | ROOT sees first institution selected on load | Open each page as ROOT, verify dropdown shows first item |
| Manual | Non-ROOT sees disabled input with institution name | Open each page as DIRECTOR, verify text input is disabled |
| Manual | ROOT can change institution and data re-filters | Change dropdown, verify list updates |
| Regression | Existing create/edit modals unchanged | Verify form institution selectors still work |

## Migration / Rollout

No migration needed. Presentation-layer only. Revert the three `.tsx` files via git to rollback.

## Open Questions

- None
