import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { ShieldCheck } from '@phosphor-icons/react';
import { api, ApiError, setCsrf } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Field, Input } from '../components/ui';

// Only relative, known paths are allowed after login (no open redirect).
const SAFE_NEXT = /^\/(?:[a-z-]+(?:\/[a-z0-9-]+)?)?$/;
export function safeNext(raw: string | null) {
  return raw && SAFE_NEXT.test(raw) ? raw : '/';
}

function Brand() {
  return (
    <div className="brand">
      <ShieldCheck size={26} weight="duotone" color="var(--primary)" /> RentNook Admin
    </div>
  );
}

export function LoginPage() {
  const { setStage, stage, refresh } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const next = safeNext(new URLSearchParams(loc.search).get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (stage === 'ready') nav(next, { replace: true });
  }, [stage, nav, next]);

  if (stage === '2fa') return <TwoFactor onDone={async () => { await refresh(); nav(next, { replace: true }); }} />;
  if (stage === 'totp-setup') return <TotpSetup onDone={async () => { await refresh(); nav(next, { replace: true }); }} />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ stage: '2fa' | 'totp-setup'; csrfToken: string }>('/admin/auth/login', { body: { email, password } });
      setCsrf(r.csrfToken);
      setStage(r.stage);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="card login-card stack-lg" onSubmit={submit}>
        <Brand />
        <h1>Sign in</h1>
        <Field label="Work email">{(id) => <Input id={id} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />}</Field>
        <Field label="Password">{(id) => <Input id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}</Field>
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        <Button type="submit" full loading={busy}>
          Sign in
        </Button>
        <p className="muted">Staff accounts only. Ask a Super admin for an invite.</p>
      </form>
    </div>
  );
}

function CodeBox({ value, onChange, onEnter }: { value: string; onChange: (v: string) => void; onEnter: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <Input
      ref={ref}
      className="code-input"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={9}
      value={value}
      aria-label="Code"
      onChange={(e) => onChange(e.target.value.replace(/[^0-9a-zA-Z-]/g, ''))}
      onKeyDown={(e) => e.key === 'Enter' && onEnter()}
    />
  );
}

function TwoFactor({ onDone }: { onDone: () => Promise<void> }) {
  const { setStage } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ok = /^\d{6}$/.test(code) || /^[a-z0-9]{4}-[a-z0-9]{4}$/i.test(code);
  const submit = async () => {
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ csrfToken: string }>('/admin/auth/2fa', { body: { code } });
      setCsrf(r.csrfToken);
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setCode('');
      if (err instanceof ApiError && err.status === 401 && err.code !== 'BAD_CODE') setStage('signed-out');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="login-wrap">
      <div className="card login-card stack-lg">
        <Brand />
        <h1>Enter your code</h1>
        <p className="muted">Open your authenticator app and type the 6-digit code for RentNook Admin. Lost your phone? Use one of your backup codes.</p>
        <CodeBox value={code} onChange={setCode} onEnter={submit} />
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        <Button full loading={busy} disabled={!ok} onClick={submit}>
          Continue
        </Button>
        <Button variant="text" onClick={() => setStage('signed-out')}>
          Use another account
        </Button>
      </div>
    </div>
  );
}

function TotpSetup({ onDone }: { onDone: () => Promise<void> }) {
  const [setup, setSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ qrDataUrl: string; secret: string }>('/admin/auth/totp-setup/start', { body: {} })
      .then(setSetup)
      .catch((e: Error) => setError(e.message));
  }, []);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ backupCodes: string[]; csrfToken: string }>('/admin/auth/totp-setup/confirm', { body: { code } });
      setCsrf(r.csrfToken);
      setCodes(r.backupCodes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  if (codes) {
    return (
      <div className="login-wrap">
        <div className="card login-card stack-lg">
          <Brand />
          <h1>Save your backup codes</h1>
          <p className="small">Each code works once if you lose your phone. They will not be shown again. Keep them in the company password manager.</p>
          <div className="backup-codes">{codes.map((c) => <span key={c}>{c}</span>)}</div>
          <Button full onClick={onDone}>
            I have saved them
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-wrap">
      <div className="card login-card stack-lg">
        <Brand />
        <h1>Set up 2-step login</h1>
        <p className="small">Scan this with Google Authenticator, Microsoft Authenticator or 1Password, then enter the code it shows.</p>
        {setup ? (
          <>
            <img src={setup.qrDataUrl} alt="QR code for the authenticator app" width={220} height={220} />
            <details>
              <summary className="muted">Can't scan? Enter this key</summary>
              <code className="utr">{setup.secret}</code>
            </details>
          </>
        ) : (
          <div className="skeleton" style={{ width: 220, height: 220 }} />
        )}
        <CodeBox value={code} onChange={setCode} onEnter={confirm} />
        {error && <div className="notice notice-error">{error}</div>}
        <Button full loading={busy} disabled={!/^\d{6}$/.test(code)} onClick={confirm}>
          Turn on 2-step login
        </Button>
      </div>
    </div>
  );
}

export function AcceptInvitePage() {
  const token = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
  const nav = useNavigate();
  const [info, setInfo] = useState<{ email: string; name: string; role: string } | null>(null);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Read the token from the fragment and drop it from the address bar so it
    // does not end up in browser history or screenshots.
    window.history.replaceState(null, '', window.location.pathname);
    api<{ email: string; name: string; role: string }>('/admin/auth/invite', { body: { token } })
      .then(setInfo)
      .catch((e: Error) => setError(e.message));
  }, [token]);

  const submit = async () => {
    if (password !== again) return setError('The two passwords do not match');
    setBusy(true);
    setError(null);
    try {
      await api('/admin/auth/accept-invite', { body: { token, password } });
      nav('/login', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="card login-card stack-lg">
        <Brand />
        <h1>Create your account</h1>
        {info ? (
          <>
            <p className="small">
              {info.name} · {info.email}
            </p>
            <Field label="Password" help="At least 12 characters. A few random words work well.">
              {(id) => <Input id={id} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
            </Field>
            <Field label="Password again">{(id) => <Input id={id} type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />}</Field>
            {error && <div className="notice notice-error">{error}</div>}
            <Button full loading={busy} disabled={password.length < 12} onClick={submit}>
              Create account
            </Button>
          </>
        ) : (
          error && <div className="notice notice-error">{error}</div>
        )}
      </div>
    </div>
  );
}
