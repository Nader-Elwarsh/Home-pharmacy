export type StatusKind = 'ok' | 'warning' | 'danger' | 'info';

const ICONS: Record<StatusKind, string> = {
  ok: '✓',
  warning: '⚠',
  danger: '✕',
  info: 'ℹ',
};

interface Props {
  kind: StatusKind;
  label: string;
}

/** الحالة تُعرض بنص ورمز ولون معًا، ولا يعتمد المعنى على اللون وحده. */
export function StatusBadge({ kind, label }: Props) {
  return (
    <span className={`badge badge-${kind}`}>
      <span aria-hidden="true">{ICONS[kind]}</span>
      <span>{label}</span>
    </span>
  );
}
