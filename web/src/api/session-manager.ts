/**
 * SessionManager — bridges axios interceptors and the React re-login modal.
 * Singleton. Uses CustomEvent bus so no React imports needed here.
 */
class SessionManager {
  private pendingRelogin: Promise<void> | null = null;
  private pendingCallbacks: { resolve: () => void; reject: (r?: unknown) => void } | null = null;

  /** Returns a promise that resolves when user re-auths, rejects on cancel.
   *  If already pending, returns the SAME promise (no double modals). */
  requireRelogin(): Promise<void> {
    if (this.pendingRelogin) return this.pendingRelogin;

    this.pendingRelogin = new Promise<void>((resolve, reject) => {
      this.pendingCallbacks = { resolve, reject };
    });

    window.dispatchEvent(new CustomEvent('auth:session-expired'));
    return this.pendingRelogin;
  }

  resolveRelogin(): void {
    this.pendingCallbacks?.resolve();
    this.pendingCallbacks = null;
    this.pendingRelogin = null;
  }

  rejectRelogin(reason?: unknown): void {
    this.pendingCallbacks?.reject(reason ?? new Error('Re-login cancelled'));
    this.pendingCallbacks = null;
    this.pendingRelogin = null;
  }

  get isPending(): boolean { return this.pendingRelogin !== null; }
}

export const sessionManager = new SessionManager();
