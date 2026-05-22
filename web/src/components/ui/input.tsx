import type { InputHTMLAttributes } from 'react';
import './input.css';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', id, ...props }: Props) {
  const inputId = id ?? props.name;
  return (
    <div className="field">
      {label && <label htmlFor={inputId} className="field-label">{label}</label>}
      <input id={inputId} className={`input ${error ? 'input-error' : ''} ${className}`} {...props} />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
