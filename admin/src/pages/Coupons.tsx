import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { date, rupees } from '../lib/format';
import { PageHead } from '../components/Layout';
import { Button, Checkbox, Dialog, Empty, ErrorNote, Field, Input, Pill, Select, SkeletonRows, useToast } from '../components/ui';
import { useCities } from './Dashboard';

interface Coupon {
  id: string;
  code: string;
  type: 'PERCENT' | 'FLAT';
  value: number;
  validFrom: string;
  validTo: string;
  maxUses: number | null;
  usedCount: number;
  perUserLimit: number;
  cityId: string | null;
  planIds: string[];
  isActive: boolean;
  revenuePaise: number;
  discountGivenPaise: number;
}

function CouponEditor({ coupon, onClose }: { coupon: Coupon | null; onClose: () => void }) {
  const cities = useCities();
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api<{ items: Array<{ id: string; name: string; pricePaise: number }> }>('/admin/plans') });
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({
    code: coupon?.code ?? '',
    type: coupon?.type ?? 'PERCENT',
    value: coupon ? String(coupon.type === 'FLAT' ? coupon.value / 100 : coupon.value) : '20',
    validFrom: coupon?.validFrom.slice(0, 10) ?? today,
    validTo: coupon?.validTo.slice(0, 10) ?? '',
    maxUses: coupon?.maxUses ? String(coupon.maxUses) : '',
    perUserLimit: String(coupon?.perUserLimit ?? 1),
    cityId: coupon?.cityId ?? '',
    planIds: coupon?.planIds ?? [],
    isActive: coupon?.isActive ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  const set = (k: keyof typeof f, v: unknown) => setF((x) => ({ ...x, [k]: v }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        code: f.code.trim().toUpperCase(),
        type: f.type,
        value: f.type === 'FLAT' ? Number(f.value) * 100 : Number(f.value),
        validFrom: new Date(`${f.validFrom}T00:00:00+05:30`).toISOString(),
        validTo: new Date(`${f.validTo}T23:59:59+05:30`).toISOString(),
        maxUses: f.maxUses ? Number(f.maxUses) : null,
        perUserLimit: Number(f.perUserLimit),
        cityId: f.cityId || null,
        planIds: f.planIds,
        isActive: f.isActive,
      };
      await api(coupon ? `/admin/coupons/${coupon.id}` : '/admin/coupons', { method: coupon ? 'PUT' : 'POST', body });
      toast('Coupon saved');
      void qc.invalidateQueries({ queryKey: ['coupons'] });
      onClose();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setFields(e.details?.fields ?? {});
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={coupon ? `Edit ${coupon.code}` : 'New coupon'} onClose={onClose} wide>
      <div className="form-grid">
        <Field label="Code" help="4–20 letters or numbers" error={fields.code}>{(id) => <Input id={id} value={f.code} maxLength={20} onChange={(e) => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />}</Field>
        <Field label="Discount">
          {(id) => (
            <div className="row">
              <Select id={id} value={f.type} onChange={(e) => set('type', e.target.value)} style={{ width: 130 }}>
                <option value="PERCENT">Percent</option>
                <option value="FLAT">Flat ₹</option>
              </Select>
              <Input aria-label="Value" inputMode="numeric" value={f.value} onChange={(e) => set('value', e.target.value.replace(/\D/g, ''))} className="grow" />
            </div>
          )}
        </Field>
        <Field label="Valid from">{(id) => <Input id={id} type="date" value={f.validFrom} onChange={(e) => set('validFrom', e.target.value)} />}</Field>
        <Field label="Valid till">{(id) => <Input id={id} type="date" value={f.validTo} onChange={(e) => set('validTo', e.target.value)} />}</Field>
        <Field label="Total uses" help="Empty = no limit">{(id) => <Input id={id} inputMode="numeric" value={f.maxUses} onChange={(e) => set('maxUses', e.target.value.replace(/\D/g, ''))} />}</Field>
        <Field label="Uses per person">{(id) => <Input id={id} inputMode="numeric" value={f.perUserLimit} onChange={(e) => set('perUserLimit', e.target.value.replace(/\D/g, ''))} />}</Field>
        <Field label="City">
          {(id) => (
            <Select id={id} value={f.cityId} onChange={(e) => set('cityId', e.target.value)}>
              <option value="">All cities</option>
              {cities.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
        </Field>
        <div className="field">
          <label>Works on plans</label>
          <div className="row">
            {plans.data?.items.filter((p) => p.pricePaise > 0).map((p) => (
              <button key={p.id} type="button" className="chip" aria-pressed={f.planIds.includes(p.id)} onClick={() => set('planIds', f.planIds.includes(p.id) ? f.planIds.filter((x) => x !== p.id) : [...f.planIds, p.id])}>
                {p.name}
              </button>
            ))}
          </div>
          <span className="help">None selected = all paid plans</span>
        </div>
        <div className="full"><Checkbox label="Active" checked={f.isActive} onChange={(v) => set('isActive', v)} /></div>
      </div>
      {error && <div className="notice notice-error">{error}</div>}
      <div className="dialog-actions">
        <Button variant="text" onClick={onClose}>Cancel</Button>
        <Button loading={busy} disabled={!f.code || !f.validTo} onClick={save}>Save coupon</Button>
      </div>
    </Dialog>
  );
}

export function CouponsPage() {
  const q = useQuery({ queryKey: ['coupons'], queryFn: () => api<{ items: Coupon[] }>('/admin/coupons') });
  const [editing, setEditing] = useState<Coupon | 'new' | null>(null);
  const [now] = useState(() => Date.now());
  return (
    <>
      <PageHead title="Coupons" sub="Checked when the lister pays and again when you approve the payment.">
        <Button onClick={() => setEditing('new')}>New coupon</Button>
      </PageHead>
      {q.isError && <ErrorNote error={q.error} />}
      <div className="card card-tight">
        {q.isLoading ? (
          <div style={{ padding: 16 }}><SkeletonRows /></div>
        ) : !q.data?.items.length ? (
          <Empty title="No coupons yet" />
        ) : (
          <table className="table">
            <thead>
              <tr><th>Code</th><th>Discount</th><th>Valid</th><th className="right">Used</th><th className="right">Revenue</th><th className="right">Discount given</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {q.data.items.map((c) => {
                const live = c.isActive && new Date(c.validTo).getTime() > now && new Date(c.validFrom).getTime() <= now;
                return (
                  <tr key={c.id}>
                    <td className="utr">{c.code}</td>
                    <td>{c.type === 'PERCENT' ? `${c.value}%` : rupees(c.value)}</td>
                    <td className="small">{date(c.validFrom)} – {date(c.validTo)}</td>
                    <td className="right num">{c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ''}</td>
                    <td className="right num">{rupees(c.revenuePaise)}</td>
                    <td className="right num">{rupees(c.discountGivenPaise)}</td>
                    <td><Pill status={live ? 'live' : 'hidden'} label={live ? 'Running' : c.isActive ? 'Not in dates' : 'Off'} /></td>
                    <td><Button variant="text" size="sm" onClick={() => setEditing(c)}>Edit</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {editing && <CouponEditor coupon={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
