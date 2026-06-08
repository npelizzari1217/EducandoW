import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import ModuleAccessGrid, { type ModuleAccessItem, type ModuleInfo } from '../module-access-grid';

// ── Datos de prueba ───────────────────────────────────────

const MODULES: ModuleInfo[] = [
  { code: 'M1', name: 'Módulo 1', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'] },
  { code: 'M2', name: 'Módulo 2', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'] },
  { code: 'M3', name: 'Módulo 3', actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'PRINT'] },
];

// ── Wrapper controlado ────────────────────────────────────
// Mantiene `value` en estado local y delega onChange hacia afuera.

interface WrapperProps {
  initialValue: ModuleAccessItem[];
  onChange?: (v: ModuleAccessItem[]) => void;
}

function Wrapper({ initialValue, onChange }: WrapperProps) {
  const [value, setValue] = useState<ModuleAccessItem[]>(initialValue);
  return (
    <ModuleAccessGrid
      availableModules={MODULES}
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

// ── Tests ─────────────────────────────────────────────────

describe('ModuleAccessGrid — column header toggle', () => {
  // T1: select-all de columna (E1)
  it('T1 — click en cabecera READ con value vacío selecciona todos los módulos', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<Wrapper initialValue={[]} onChange={onChange} />);

    const header = screen.getByTestId('column-header-READ') as HTMLInputElement;
    await user.click(header);

    expect(onChange).toHaveBeenCalledOnce();
    const received = onChange.mock.calls[0][0] as ModuleAccessItem[];
    // Los 3 módulos deben aparecer en el resultado con READ incluido
    for (const mod of MODULES) {
      const item = received.find((i) => i.moduleCode === mod.code);
      expect(item, `${mod.code} debe estar en el resultado`).toBeDefined();
      expect(item!.actions).toContain('READ');
    }
  });

  // T2: deselect-all de columna (E2)
  it('T2 — click en cabecera READ cuando todos tienen READ la deselecciona en todos', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    // M1, M2, M3 sólo con READ
    const initialValue: ModuleAccessItem[] = MODULES.map((m) => ({
      moduleCode: m.code,
      actions: ['READ'],
    }));

    render(<Wrapper initialValue={initialValue} onChange={onChange} />);

    const header = screen.getByTestId('column-header-READ') as HTMLInputElement;
    await user.click(header);

    expect(onChange).toHaveBeenCalledOnce();
    const received = onChange.mock.calls[0][0] as ModuleAccessItem[];
    // Todos los módulos quedaron vacíos → se eliminan → array vacío
    expect(received).toHaveLength(0);
  });

  // T3: estado indeterminate (E3)
  it('T3 — con algunos módulos con READ la cabecera queda indeterminate', () => {
    // M1 tiene READ; M2 y M3 no
    const initialValue: ModuleAccessItem[] = [{ moduleCode: 'M1', actions: ['READ'] }];

    render(<Wrapper initialValue={initialValue} onChange={vi.fn()} />);

    const header = screen.getByTestId('column-header-READ') as HTMLInputElement;
    expect(header.indeterminate).toBe(true);
    expect(header.checked).toBe(false);
  });

  // T4: auto-derivación de cabecera (E4 + E5 + E6)
  it('T4 — tildar la última celda faltante pone la cabecera checked; destildar una la pone indeterminate', async () => {
    const user = userEvent.setup();

    // Empezar con M1 con READ (indeterminate)
    const initialValue: ModuleAccessItem[] = [{ moduleCode: 'M1', actions: ['READ'] }];
    const onChange = vi.fn();
    render(<Wrapper initialValue={initialValue} onChange={onChange} />);

    const header = screen.getByTestId('column-header-READ') as HTMLInputElement;

    // Estado inicial: indeterminate
    expect(header.indeterminate).toBe(true);
    expect(header.checked).toBe(false);

    // E4: tildar cabecera (select-all) → queda checked
    await user.click(header);
    expect(header.checked).toBe(true);
    expect(header.indeterminate).toBe(false);

    // E6: verificar payload del onChange — todos los módulos deben tener READ
    const payloadE6 = onChange.mock.calls.at(-1)![0] as ModuleAccessItem[];
    for (const mod of MODULES) {
      const item = payloadE6.find((i) => i.moduleCode === mod.code);
      expect(item, `${mod.code} debe estar en el payload`).toBeDefined();
      expect(item!.actions).toContain('READ');
    }

    // E5: destildar la celda READ de M1 → cabecera pasa a indeterminate
    const cellM1Read = screen.getByTestId('cell-M1-READ') as HTMLInputElement;
    await user.click(cellM1Read);
    expect(header.indeterminate).toBe(true);
    expect(header.checked).toBe(false);
  });

  // T5: cabecera checked cuando todos tienen la acción (E4 estado final)
  it('T5 — con todos los módulos con READ la cabecera queda checked', () => {
    const initialValue: ModuleAccessItem[] = MODULES.map((m) => ({
      moduleCode: m.code,
      actions: ['READ'],
    }));

    render(<Wrapper initialValue={initialValue} onChange={vi.fn()} />);

    const header = screen.getByTestId('column-header-READ') as HTMLInputElement;
    expect(header.checked).toBe(true);
    expect(header.indeterminate).toBe(false);
  });
});
