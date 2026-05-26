import { useState, useEffect, useRef, useCallback, Children } from 'react';
import './SidebarGroup.css';

export interface SidebarGroupProps {
  id: string; // used for localStorage key: sidebar-group-{id}
  label: string;
  icon?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Collapsible sidebar section.
 *
 * - Persists open/closed state in localStorage per group.
 * - Collapse animation via max-height CSS transition on the content.
 * - If all children are filtered out (zero React children), the entire
 *   group does NOT render — caller should check before using.
 * - In tablet collapsed mode (.sidebar:not(.sidebar-open)), only the
 *   group icon is visible.
 * - Uses native <details>/<summary> for built-in a11y.
 */
export function SidebarGroup({
  id,
  label,
  icon = '📁',
  defaultOpen = true,
  children,
}: SidebarGroupProps) {
  const storageKey = `sidebar-group-${id}`;

  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored !== null ? stored === 'true' : defaultOpen;
    } catch {
      return defaultOpen;
    }
  });

  const detailsRef = useRef<HTMLDetailsElement>(null);

  // Keep DOM in sync with React state (React open prop is not reactive
  // to native toggle; we manage it ourselves).
  useEffect(() => {
    if (detailsRef.current) {
      detailsRef.current.open = open;
    }
  }, [open]);

  const handleToggle = useCallback(() => {
    if (!detailsRef.current) return;
    const newOpen = detailsRef.current.open;
    setOpen(newOpen);
    try {
      localStorage.setItem(storageKey, String(newOpen));
    } catch {
      /* localStorage unavailable (SSR, private browsing) — fine */
    }
  }, [storageKey]);

  // Do not render if there are no children (all filtered out upstream).
  if (Children.count(children) === 0) return null;

  return (
    <details
      ref={detailsRef}
      className="sidebar-group"
      open={open}
      onToggle={handleToggle}
    >
      <summary>
        <span className="sidebar-group-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="sidebar-group-label">{label}</span>
        <span className="sidebar-group-chevron" aria-hidden="true">
          ▶
        </span>
      </summary>
      <div className="sidebar-group-content">{children}</div>
    </details>
  );
}
