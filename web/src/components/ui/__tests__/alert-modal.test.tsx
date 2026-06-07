import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlertModal } from '../alert-modal';

describe('AlertModal', () => {
  it('renders null (no overlay) when open={false}', () => {
    const { container } = render(
      <AlertModal open={false} title="Titulo" message="Mensaje" onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders title and message when open={true}', () => {
    render(
      <AlertModal open={true} title="No se puede eliminar" message="Tiene 2 cursos vinculados." onClose={vi.fn()} />,
    );
    expect(screen.getByText('No se puede eliminar')).toBeInTheDocument();
    expect(screen.getByText('Tiene 2 cursos vinculados.')).toBeInTheDocument();
  });

  it('calls onClose when "Aceptar" button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AlertModal open={true} title="Titulo" message="Mensaje" onClose={onClose} />,
    );
    await user.click(screen.getByRole('button', { name: 'Aceptar' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('exposes accessible dialog semantics (role, aria-modal, labelled by title)', () => {
    render(
      <AlertModal open={true} title="No se puede eliminar" message="Tiene 2 cursos vinculados." onClose={vi.fn()} />,
    );
    const dialog = screen.getByRole('dialog', { name: 'No se puede eliminar' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('calls onClose when the backdrop (overlay) is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AlertModal open={true} title="Titulo" message="Mensaje" onClose={onClose} />,
    );
    // Click the overlay (the outermost div, not the card)
    const overlay = screen.getByTestId('alert-modal-overlay');
    await user.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
