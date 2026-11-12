import type { ReactNode } from 'react';
import { StatusBadge } from './StatusBadge';

interface BaseProps {
  label: string;
  hint?: string;
}

interface TextProps extends BaseProps {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'url';
  placeholder?: string;
  maxLength?: number;
  list?: string;
}

export function TextField({ label, hint, value, onChange, ...rest }: TextProps) {
  return (
    <label>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
      {hint && <span className="muted">{hint}</span>}
    </label>
  );
}

export function TextAreaField({ label, hint, value, onChange, maxLength = 1000 }: BaseProps & {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}) {
  return (
    <label>
      {label}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} maxLength={maxLength} />
      {hint && <span className="muted">{hint}</span>}
    </label>
  );
}

export interface Option {
  value: string;
  label: string;
}

export function SelectField({ label, hint, value, onChange, options, emptyLabel }: BaseProps & {
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<Option>;
  /** إن وُجد تُضاف خيار فارغ بهذا النص */
  emptyLabel?: string;
}) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="muted">{hint}</span>}
    </label>
  );
}

export function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert">
      <StatusBadge kind="danger" label={message} />
    </p>
  );
}

export function Loading() {
  return <StatusBadge kind="info" label="جارٍ التحميل" />;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
