import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ComponentProps, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { humanize } from '../lib/format';

// ---------------------------------------------------------------- Button

type BtnVariant = 'primary' | 'secondary' | 'text' | 'danger' | 'danger-outline';

export function Button({
  variant = 'primary',
  size,
  loading,
  full,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm'; loading?: boolean; full?: boolean }) {
  const cls = ['btn', `btn-${variant}`, size === 'sm' && 'btn-sm', full && 'btn-full', className].filter(Boolean).join(' ');
  return (
    <button type="button" {...rest} className={cls} disabled={rest.disabled || loading} aria-busy={loading || undefined}>
      {loading && <span className="spinner" aria-hidden />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Form fields

export function Field({ label, help, error, children, className }: { label: string; help?: string; error?: string; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {error ? <span className="error">{error}</span> : help ? <span className="help">{help}</span> : null}
    </div>
  );
}

export const Input = (p: ComponentProps<'input'>) => <input {...p} className={['input', p.className].filter(Boolean).join(' ')} />;
export const Select = (p: ComponentProps<'select'>) => <select {...p} className={['select', p.className].filter(Boolean).join(' ')} />;
export const Textarea = (p: ComponentProps<'textarea'>) => <textarea {...p} className={['textarea', p.className].filter(Boolean).join(' ')} />;

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

// ---------------------------------------------------------------- Status pill (fixed colours)

export function Pill({ status, label }: { status: string; label?: string }) {
  return <span className={`pill pill-${status.toLowerCase()}`}>{label ?? humanize(status)}</span>;
}

// ---------------------------------------------------------------- Tabs

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: Array<{ value: T; label: string; count?: number }> }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((i) => (
        <button key={i.value} role="tab" aria-selected={value === i.value} onClick={() => onChange(i.value)}>
          {i.label}
          {i.count !== undefined && <span className="count">{i.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Loading / empty / error

export function SkeletonRows({ rows = 5, height = 44 }: { rows?: number; height?: number }) {
  return (
    <div className="stack" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <span>{children}</span>}
      {action}
    </div>
  );
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'Something went wrong';
  return (
    <div className="notice notice-error row-between">
      <span>{msg}</span>
      {onRetry && (
        <Button variant="text" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Pagination

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="row-between" style={{ padding: 'var(--s3) var(--s4)' }}>
      <span className="muted">
        Page {page} of {pages} · {total} total
      </span>
      <div className="row">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Dialog

export function Dialog({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={['dialog', wide && 'wide'].filter(Boolean).join(' ')} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

// Confirm with optional required reason. Used for every destructive action.
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger,
  reasonLabel,
  reasons,
  onConfirm,
  onClose,
}: {
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  reasonLabel?: string;
  reasons?: readonly string[];
  onConfirm: (reason: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsReason = !!reasonLabel;
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setBusy(false);
    }
  };
  return (
    <Dialog title={title} onClose={onClose}>
      {body && <div className="stack small">{body}</div>}
      {needsReason && (
        <div className="stack">
          {reasons && (
            <div className="row">
              {reasons.map((r) => (
                <button key={r} type="button" className="chip" aria-pressed={reason === r} onClick={() => setReason(r)}>
                  {r}
                </button>
              ))}
            </div>
          )}
          <Field label={reasonLabel}>{(id) => <Textarea id={id} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} rows={2} />}</Field>
        </div>
      )}
      {error && <div className="notice notice-error">{error}</div>}
      <div className="dialog-actions">
        <Button variant="text" onClick={onClose}>
          Cancel
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={busy} disabled={needsReason && reason.trim().length < 3} onClick={go}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Toasts

interface Toast {
  id: number;
  text: string;
  error?: boolean;
  undo?: () => void;
}
const ToastCtx = createContext<(text: string, opts?: { error?: boolean; undo?: () => void }) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, opts: { error?: boolean; undo?: () => void } = {}) => {
    const id = Date.now() + Math.random();
    setItems((t) => [...t, { id, text, ...opts }]);
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={['toast', t.error && 'error'].filter(Boolean).join(' ')}>
            <span className="grow">{t.text}</span>
            {t.undo && (
              <button className="btn btn-text btn-sm" style={{ color: '#fff' }} onClick={t.undo}>
                Undo
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------------------------------------------------------------- Image with lightbox

export function Thumbs({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!urls.length) return <div className="thumb-empty" aria-label="No photos" />;
  return (
    <>
      <div className="thumbs">
        {urls.map((u) => (
          <img key={u} src={u} alt="" loading="lazy" onClick={() => setOpen(u)} referrerPolicy="no-referrer" />
        ))}
      </div>
      {open && (
        <Dialog title="Photo" onClose={() => setOpen(null)} wide>
          <div className="lightbox">
            <img src={open} alt="" referrerPolicy="no-referrer" />
          </div>
        </Dialog>
      )}
    </>
  );
}
