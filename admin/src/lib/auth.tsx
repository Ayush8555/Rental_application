import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, onAuthError, setCsrf } from './api';
import { Button, Dialog, Field, Input } from '../components/ui';

export interface AdminMe {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  totpEnabled: boolean;
}

type Stage = 'loading' | 'signed-out' | '2fa' | 'totp-setup' | 'ready';

interface AuthState {
  stage: Stage;
  admin: AdminMe | null;
  refresh: () => Promise<void>;
  setStage: (s: Stage) => void;
  isSuper: boolean;
  // Runs a call; if the server asks for a fresh 2-step code, asks for it and retries once.
  withStepUp: <T>(fn: () => Promise<T>) => Promise<T>;
}

const Ctx = createContext<AuthState | null>(null);
export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [stage, setStage] = useState<Stage>('loading');
  const [admin, setAdmin] = useState<AdminMe | null>(null);
  const [stepUp, setStepUp] = useState<{ resolve: () => void; reject: (e: unknown) => void } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ admin: AdminMe; stage: Stage; csrfToken: string }>('/admin/auth/me');
      setCsrf(me.csrfToken);
      setAdmin(me.admin);
      setStage(me.stage);
    } catch {
      setCsrf(null);
      setAdmin(null);
      setStage('signed-out');
    }
  }, []);

  useEffect(() => {
    void refresh();
    return onAuthError(() => {
      setCsrf(null);
      setAdmin(null);
      setStage('signed-out');
    });
  }, [refresh]);

  const withStepUp = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof ApiError) || e.code !== 'STEP_UP_REQUIRED') throw e;
      await new Promise<void>((resolve, reject) => setStepUp({ resolve, reject }));
      return fn();
    }
  }, []);

  return (
    <Ctx.Provider value={{ stage, admin, refresh, setStage, isSuper: admin?.role === 'SUPER_ADMIN', withStepUp }}>
      {children}
      {stepUp && (
        <StepUpDialog
          onDone={() => {
            stepUp.resolve();
            setStepUp(null);
          }}
          onCancel={() => {
            stepUp.reject(new Error('Cancelled'));
            setStepUp(null);
          }}
        />
      )}
    </Ctx.Provider>
  );
}

function StepUpDialog({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('/admin/auth/step-up', { body: { code } });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setCode('');
      ref.current?.focus();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title="Confirm it's you" onClose={onCancel}>
      <p className="small">This change needs a fresh code from your authenticator app.</p>
      <Field label="6-digit code" error={error ?? undefined}>
        {(id) => (
          <Input
            id={id}
            ref={ref}
            className="code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && void submit()}
          />
        )}
      </Field>
      <div className="dialog-actions">
        <Button variant="text" onClick={onCancel}>
          Cancel
        </Button>
        <Button loading={busy} disabled={code.length !== 6} onClick={submit}>
          Confirm
        </Button>
      </div>
    </Dialog>
  );
}
