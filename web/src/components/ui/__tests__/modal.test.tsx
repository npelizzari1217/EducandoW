import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../modal';

describe('Modal', () => {
  it('renders null (no overlay) when open={false}', () => {
    const { container } = render(
      <Modal open={false} title="Titulo" onClose={vi.fn()}>
        <p>Contenido</p>
      </Modal>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders children when open={true}', () => {
    render(
      <Modal open={true} title="Mi Modal" onClose={vi.fn()}>
        <p>Contenido del modal</p>
      </Modal>,
    );
    expect(screen.getByText('Contenido del modal')).toBeInTheDocument();
    expect(screen.getByText('Mi Modal')).toBeInTheDocument();
  });

  it('calls onClose when close button (✕) is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open={true} title="Titulo" onClose={onClose}>
        <p>Contenido</p>
      </Modal>,
    );
    await user.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when the backdrop (overlay) is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open={true} title="Titulo" onClose={onClose}>
        <p>Contenido</p>
      </Modal>,
    );
    const overlay = screen.getByTestId('modal-overlay');
    await user.click(overlay);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <Modal open={true} title="Titulo" onClose={onClose}>
        <p>Contenido</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('has dialog semantics (role=dialog, aria-modal=true, labeled by title)', () => {
    render(
      <Modal open={true} title="Mi Modal con a11y" onClose={vi.fn()}>
        <p>Contenido</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Mi Modal con a11y' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('does NOT call onClose when clicking inside the panel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open={true} title="Titulo" onClose={onClose}>
        <p data-testid="inner">Contenido</p>
      </Modal>,
    );
    await user.click(screen.getByTestId('inner'));
    expect(onClose).not.toHaveBeenCalled();
  });
});
