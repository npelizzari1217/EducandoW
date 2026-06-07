import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LevelCheckboxGroup } from '../level-checkbox-group';
import { LEVEL_CATALOG } from '../../../constants/levels';

// ── Multi mode (default) ────────────────────────────────────────

describe('LevelCheckboxGroup — multi mode (default)', () => {
  it('renders checkboxes for every catalog entry', () => {
    render(<LevelCheckboxGroup selected={new Set()} onToggle={vi.fn()} />);
    const inputs = screen.getAllByRole('checkbox');
    expect(inputs).toHaveLength(LEVEL_CATALOG.length);
  });

  it('marks the correct entries as checked', () => {
    // Pre-select indices 0 and 3 (Inicial and Primario)
    render(<LevelCheckboxGroup selected={new Set([0, 3])} onToggle={vi.fn()} />);
    const inputs = screen.getAllByRole('checkbox');
    expect(inputs[0]).toBeChecked();
    expect(inputs[3]).toBeChecked();
    expect(inputs[1]).not.toBeChecked();
  });

  it('calls onToggle with the clicked index', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<LevelCheckboxGroup selected={new Set()} onToggle={onToggle} />);
    const inputs = screen.getAllByRole('checkbox');
    await user.click(inputs[2]);
    expect(onToggle).toHaveBeenCalledWith(2);
  });

  it('renders the default label', () => {
    render(<LevelCheckboxGroup selected={new Set()} onToggle={vi.fn()} />);
    expect(screen.getByText('Niveles educativos')).toBeInTheDocument();
  });

  it('renders a custom label', () => {
    render(<LevelCheckboxGroup selected={new Set()} onToggle={vi.fn()} label="Mis niveles" />);
    expect(screen.getByText('Mis niveles')).toBeInTheDocument();
  });

  it('shows error message when provided', () => {
    render(<LevelCheckboxGroup selected={new Set()} onToggle={vi.fn()} error="Campo requerido" />);
    expect(screen.getByText('Campo requerido')).toBeInTheDocument();
  });
});

// ── Single mode ──────────────────────────────────────────────────

describe('LevelCheckboxGroup — single mode', () => {
  it('renders radio inputs instead of checkboxes', () => {
    render(<LevelCheckboxGroup mode="single" selected={new Set()} onToggle={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(LEVEL_CATALOG.length);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('all radios share the same name attribute', () => {
    render(<LevelCheckboxGroup mode="single" selected={new Set()} onToggle={vi.fn()} />);
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    const names = new Set(radios.map(r => r.name));
    expect(names.size).toBe(1);
    expect(names.values().next().value).not.toBe('');
  });

  it('marks exactly one radio as checked when selected has one element', () => {
    render(<LevelCheckboxGroup mode="single" selected={new Set([1])} onToggle={vi.fn()} />);
    const radios = screen.getAllByRole('radio');
    const checked = radios.filter(r => (r as HTMLInputElement).checked);
    expect(checked).toHaveLength(1);
    expect(radios[1]).toBeChecked();
  });

  it('calls onToggle with the clicked index', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<LevelCheckboxGroup mode="single" selected={new Set()} onToggle={onToggle} />);
    const radios = screen.getAllByRole('radio');
    await user.click(radios[0]);
    expect(onToggle).toHaveBeenCalledWith(0);
  });

  it('renders the same visual grouping as multi mode', () => {
    const { container: multiContainer } = render(
      <LevelCheckboxGroup mode="multi" selected={new Set()} onToggle={vi.fn()} />
    );
    const { container: singleContainer } = render(
      <LevelCheckboxGroup mode="single" selected={new Set()} onToggle={vi.fn()} />
    );
    // Both should show the same group labels
    const multiLabels = Array.from(multiContainer.querySelectorAll('div[style*="text-transform: uppercase"]')).map(el => el.textContent);
    const singleLabels = Array.from(singleContainer.querySelectorAll('div[style*="text-transform: uppercase"]')).map(el => el.textContent);
    expect(singleLabels).toEqual(multiLabels);
  });

  it('shows error message when provided', () => {
    render(<LevelCheckboxGroup mode="single" selected={new Set()} onToggle={vi.fn()} error="Seleccioná un nivel" />);
    expect(screen.getByText('Seleccioná un nivel')).toBeInTheDocument();
  });

  it('uses a custom label', () => {
    render(<LevelCheckboxGroup mode="single" selected={new Set()} onToggle={vi.fn()} label="Nivel educativo" />);
    expect(screen.getByText('Nivel educativo')).toBeInTheDocument();
  });
});
