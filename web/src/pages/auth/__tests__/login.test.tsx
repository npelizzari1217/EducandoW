import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../../../context/theme-context';
import LoginPage from '../login';

// ── Mocks (vi.hoisted must run before vi.mock hoisting) ──────────
const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  isLoading: false,
  navigate: vi.fn(),
}));

vi.mock('/home/usuario/proyectos/educandow/web/src/context/auth-context', () => ({
  useAuth: () => ({ login: mocks.login, isLoading: mocks.isLoading }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mocks.navigate };
});

// ── Helper ───────────────────────────────────────────────────────
function renderLogin() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <LoginPage />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isLoading = false;
  });

  // 1 ─────────────────────────────────────────────────────────────
  it('renders login form with email, password, submit button and register link', () => {
    renderLogin();

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /ingresar/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Registrate')).toBeInTheDocument();
  });

  // 2 ─────────────────────────────────────────────────────────────
  it('shows validation errors when submitting an empty form', async () => {
    mocks.login.mockRejectedValue(new Error('invalid'));
    renderLogin();

    fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(screen.getByText('El email es requerido')).toBeInTheDocument();
    });
    expect(screen.getByText('La contraseña es requerida')).toBeInTheDocument();
  });

  // 3 ─────────────────────────────────────────────────────────────
  it('shows email format error when typing an invalid email and blurring', async () => {
    renderLogin();

    const emailInput = screen.getByLabelText('Email');
    fireEvent.change(emailInput, { target: { value: 'notanemail' } });
    fireEvent.blur(emailInput);

    await waitFor(() => {
      expect(
        screen.getByText('Ingresá un email válido'),
      ).toBeInTheDocument();
    });
  });

  // 4 ─────────────────────────────────────────────────────────────
  it('shows server error when login rejects', async () => {
    mocks.login.mockRejectedValue(new Error('Unauthorized'));
    renderLogin();

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'test@test.com' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'pass123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Email o contraseña incorrectos'),
      ).toBeInTheDocument();
    });
  });

  // 5 ─────────────────────────────────────────────────────────────
  it('navigates to / on successful login', async () => {
    mocks.login.mockResolvedValue(undefined);
    renderLogin();

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'test@test.com' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), {
      target: { value: 'pass123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/');
    });
  });

  // 6 ─────────────────────────────────────────────────────────────
  it('shows loading button text and disables it when isLoading is true', () => {
    mocks.isLoading = true;
    renderLogin();

    const button = screen.getByRole('button', { name: /ingresando/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  // 7 ─────────────────────────────────────────────────────────────
  it('toggles password visibility between text and password', () => {
    renderLogin();

    const passwordInput = screen.getByLabelText('Contraseña');
    const showToggle = screen.getByLabelText('Mostrar contraseña');

    // Initially hidden
    expect(passwordInput).toHaveAttribute('type', 'password');

    // Click to show
    fireEvent.click(showToggle);
    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(
      screen.getByLabelText('Ocultar contraseña'),
    ).toBeInTheDocument();

    // Click to hide again
    fireEvent.click(screen.getByLabelText('Ocultar contraseña'));
    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(
      screen.getByLabelText('Mostrar contraseña'),
    ).toBeInTheDocument();
  });

  // 8 ─────────────────────────────────────────────────────────────
  it('renders the loading overlay when isLoading is true', () => {
    mocks.isLoading = true;
    renderLogin();

    expect(
      document.querySelector('.login-loading-overlay'),
    ).toBeInTheDocument();
  });
});
