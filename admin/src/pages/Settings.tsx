import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { rupees } from '../lib/format';
import { PageHead } from '../components/Layout';
import { Button, Checkbox, ErrorNote, Field, Input, SkeletonRows, Textarea, useToast } from '../components/ui';

interface Values {
  upi: { vpa: string; payeeName: string; qrKey: string | null };
  support: { whatsapp: string | null; email: string | null; hours: string };
  grievance: { name: string; email: string; address: string };
  company: { legalName: string; address: string };
  limits: Record<string, number>;
  moderation: { reviewNewItems: boolean };
  app: { minVersion: string; latestVersion: string };
  boostOptions: Array<{ days: number; pricePaise: number }>;
  help: { safetyTips: string[]; safetyTipsHi: string[]; faqs: Array<{ q: string; a: string }>; faqsHi: Array<{ q: string; a: string }> };
  legal: { privacyVersion: string; termsVersion: string; effectiveDate: string };
}

const LIMIT_LABELS: Record<string, string> = {
  contactsPerDay: 'Owners a person can contact per day',
  reportsToHide: 'Reports that auto-hide an item',
  sponsoredPerCity: 'Sponsored items per city',
  pendingPaymentsMax: 'Pending payments per person',
  utrPerDay: 'UTR submissions per day',
  requestsPerDay: 'Item requests per day',
  referralRewardsPerMonth: 'Referral rewards per month',
  referralRewardDays: 'Days given per referral',
  newAccountListingsFirstDay: 'Items a new account can add on day one',
  broadcastsPerDay: 'Push broadcasts per day',
};

function Section<T>({ title, sub, name, initial, editable, render, superOnly }: { title: string; sub?: string; name: keyof Values; initial: T; editable: boolean; superOnly?: boolean; render: (v: T, set: (v: T) => void) => ReactNode }) {
  const [v, setV] = useState<T>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { withStepUp } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  useEffect(() => setV(initial), [initial]);
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await withStepUp(() => api(`/admin/settings/${name}`, { method: 'PUT', body: v }));
      toast('Saved');
      void qc.invalidateQueries({ queryKey: ['settings'] });
    } catch (e) {
      setError(e instanceof ApiError ? (Object.values(e.details?.fields ?? {})[0] ?? e.message) : e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card stack">
      <div className="row-between">
        <div>
          <h3>{title}</h3>
          {sub && <p className="muted">{sub}</p>}
        </div>
        {superOnly && <span className="muted">Super admin</span>}
      </div>
      <fieldset disabled={!editable} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
        {render(v, setV)}
      </fieldset>
      {error && <div className="notice notice-error">{error}</div>}
      {editable && (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="text" disabled={!dirty} onClick={() => setV(initial)}>Reset</Button>
          <Button loading={busy} disabled={!dirty} onClick={save}>Save</Button>
        </div>
      )}
    </section>
  );
}

export function SettingsPage() {
  const { isSuper } = useAuth();
  const q = useQuery({ queryKey: ['settings'], queryFn: () => api<{ values: Values; upiQrUrl: string | null }>('/admin/settings') });
  if (q.isError) return <ErrorNote error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data?.values;
  if (!s) return <SkeletonRows rows={5} height={120} />;

  return (
    <>
      <PageHead title="Settings" sub={isSuper ? 'Business settings. Changing the UPI ID needs your 2-step code.' : 'Most settings can only be changed by a Super admin.'} />
      <div className="stack-lg">
        <Section title="UPI for plan payments" sub="Every UPI link and QR in the app is built from this." name="upi" initial={s.upi} editable={isSuper} superOnly
          render={(v, set) => (
            <div className="form-grid">
              <Field label="Company UPI ID">{(id) => <Input id={id} value={v.vpa} onChange={(e) => set({ ...v, vpa: e.target.value.trim() })} />}</Field>
              <Field label="Payee name" help="As shown in the UPI app">{(id) => <Input id={id} value={v.payeeName} onChange={(e) => set({ ...v, payeeName: e.target.value })} />}</Field>
              <QrUpload current={q.data?.upiQrUrl ?? null} onUploaded={(key) => set({ ...v, qrKey: key })} />
            </div>
          )} />
        <Section title="Support and grievance officer" sub="Shown in the app and in the Privacy Policy." name="support" initial={s.support} editable={isSuper} superOnly
          render={(v, set) => (
            <div className="form-grid">
              <Field label="Support WhatsApp" help="+91 and 10 digits">{(id) => <Input id={id} value={v.whatsapp ?? ''} onChange={(e) => set({ ...v, whatsapp: e.target.value.trim() || null })} />}</Field>
              <Field label="Support email">{(id) => <Input id={id} value={v.email ?? ''} onChange={(e) => set({ ...v, email: e.target.value.trim() || null })} />}</Field>
              <Field label="Support hours" className="full">{(id) => <Input id={id} value={v.hours} onChange={(e) => set({ ...v, hours: e.target.value })} />}</Field>
            </div>
          )} />
        <Section title="Grievance officer" name="grievance" initial={s.grievance} editable={isSuper} superOnly
          render={(v, set) => (
            <div className="form-grid">
              <Field label="Name">{(id) => <Input id={id} value={v.name} onChange={(e) => set({ ...v, name: e.target.value })} />}</Field>
              <Field label="Email">{(id) => <Input id={id} value={v.email} onChange={(e) => set({ ...v, email: e.target.value.trim() })} />}</Field>
              <Field label="Address" className="full">{(id) => <Textarea id={id} rows={2} value={v.address} onChange={(e) => set({ ...v, address: e.target.value })} />}</Field>
            </div>
          )} />
        <Section title="Company" name="company" initial={s.company} editable={isSuper} superOnly
          render={(v, set) => (
            <div className="form-grid">
              <Field label="Legal name">{(id) => <Input id={id} value={v.legalName} onChange={(e) => set({ ...v, legalName: e.target.value })} />}</Field>
              <Field label="Address">{(id) => <Input id={id} value={v.address} onChange={(e) => set({ ...v, address: e.target.value })} />}</Field>
            </div>
          )} />
        <Section title="Limits" name="limits" initial={s.limits} editable={isSuper} superOnly
          render={(v, set) => (
            <div className="form-grid">
              {Object.entries(v).map(([k, n]) => (
                <Field key={k} label={LIMIT_LABELS[k] ?? k}>{(id) => <Input id={id} inputMode="numeric" value={String(n)} onChange={(e) => set({ ...v, [k]: Number(e.target.value.replace(/\D/g, '') || 0) })} />}</Field>
              ))}
            </div>
          )} />
        <Section title="Boost prices" name="boostOptions" initial={s.boostOptions} editable={isSuper} superOnly
          render={(v, set) => (
            <div className="stack">
              {v.map((o, i) => (
                <div key={i} className="row">
                  <Input aria-label="Days" inputMode="numeric" value={String(o.days)} onChange={(e) => set(v.map((x, j) => (j === i ? { ...x, days: Number(e.target.value.replace(/\D/g, '') || 0) } : x)))} style={{ width: 90 }} />
                  <span className="muted">days for ₹</span>
                  <Input aria-label="Price" inputMode="numeric" value={String(o.pricePaise / 100)} onChange={(e) => set(v.map((x, j) => (j === i ? { ...x, pricePaise: Number(e.target.value.replace(/\D/g, '') || 0) * 100 } : x)))} style={{ width: 120 }} />
                  <span className="muted">{rupees(o.pricePaise)}</span>
                  {v.length > 1 && <Button size="sm" variant="text" onClick={() => set(v.filter((_, j) => j !== i))}>Remove</Button>}
                </div>
              ))}
              {v.length < 6 && <Button size="sm" variant="secondary" onClick={() => set([...v, { days: 30, pricePaise: 29900 }])}>Add option</Button>}
            </div>
          )} />
        <Section title="Item review" name="moderation" initial={s.moderation} editable
          render={(v, set) => <Checkbox label="New items wait for review before going live" checked={v.reviewNewItems} onChange={(x) => set({ reviewNewItems: x })} />} />
        <Section title="App version" sub="Phones below the minimum see a full-screen “Please update”." name="app" initial={s.app} editable={isSuper} superOnly
          render={(v, set) => (
            <div className="form-grid">
              <Field label="Minimum version">{(id) => <Input id={id} value={v.minVersion} onChange={(e) => set({ ...v, minVersion: e.target.value.trim() })} />}</Field>
              <Field label="Latest version">{(id) => <Input id={id} value={v.latestVersion} onChange={(e) => set({ ...v, latestVersion: e.target.value.trim() })} />}</Field>
            </div>
          )} />
        <Section title="Help and safety text" sub="Shown on the Help screen and the WhatsApp safety sheet." name="help" initial={s.help} editable
          render={(v, set) => (
            <div className="form-grid">
              <Field label="Safety tips (English), one per line">{(id) => <Textarea id={id} rows={4} value={v.safetyTips.join('\n')} onChange={(e) => set({ ...v, safetyTips: e.target.value.split('\n').filter(Boolean) })} />}</Field>
              <Field label="Safety tips (Hindi), one per line">{(id) => <Textarea id={id} rows={4} value={v.safetyTipsHi.join('\n')} onChange={(e) => set({ ...v, safetyTipsHi: e.target.value.split('\n').filter(Boolean) })} />}</Field>
              <p className="muted full">FAQs are edited as question / answer pairs: {v.faqs.length} in English, {v.faqsHi.length} in Hindi.</p>
            </div>
          )} />
        <Section title="Legal versions" sub="Raising the privacy version asks every user to accept again at next login." name="legal" initial={s.legal} editable={isSuper} superOnly
          render={(v, set) => (
            <div className="form-grid">
              <Field label="Privacy version">{(id) => <Input id={id} value={v.privacyVersion} onChange={(e) => set({ ...v, privacyVersion: e.target.value })} />}</Field>
              <Field label="Terms version">{(id) => <Input id={id} value={v.termsVersion} onChange={(e) => set({ ...v, termsVersion: e.target.value })} />}</Field>
              <Field label="Effective date">{(id) => <Input id={id} type="date" value={v.effectiveDate} onChange={(e) => set({ ...v, effectiveDate: e.target.value })} />}</Field>
            </div>
          )} />
      </div>
    </>
  );
}

function QrUpload({ current, onUploaded }: { current: string | null; onUploaded: (key: string) => void }) {
  const { withStepUp } = useAuth();
  const [preview, setPreview] = useState<string | null>(current);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const sign = await withStepUp(() => api<{ url: string; headers: Record<string, string>; token: string }>('/admin/settings/qr-upload', { body: { contentType: file.type, sizeBytes: file.size } }));
      const put = await fetch(sign.url, { method: 'PUT', headers: sign.headers, body: file });
      if (!put.ok) throw new Error('Upload failed');
      const done = await api<{ qrKey: string; url: string }>('/admin/settings/qr-complete', { body: { token: sign.token } });
      setPreview(done.url);
      onUploaded(done.qrKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="field full">
      <label>UPI QR image (shown when a phone has no UPI app)</label>
      <div className="row">
        {preview && <img src={preview} alt="UPI QR" width={96} height={96} style={{ borderRadius: 'var(--r-input)', border: '1px solid var(--line)' }} />}
        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
      </div>
      {error && <span className="error">{error}</span>}
    </div>
  );
}
