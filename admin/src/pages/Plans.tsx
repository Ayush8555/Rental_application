import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api';
import { date, rupees } from '../lib/format';
import { PageHead } from '../components/Layout';
import { Button, Checkbox, ConfirmDialog, Dialog, Empty, ErrorNote, Field, Input, Pill, Select, SkeletonRows, useToast } from '../components/ui';
import { useCities } from './Dashboard';

type PlanType = 'PAID' | 'FREE' | 'TRIAL' | 'BUSINESS';
interface Plan {
  id: string;
  name: string;
  nameHi: string;
  type: PlanType;
  pricePaise: number;
  durationDays: number;
  listingLimit: number | null;
  boostCredits: number;
  shopPage: boolean;
  maxPerUser: number | null;
  needsApproval: boolean;
  visibility: 'PUBLIC' | 'HIDDEN' | 'ARCHIVED';
  allCities: boolean;
  cityIds: string[];
  validFrom: string | null;
  validTo: string | null;
  badge: string | null;
  badgeHi: string | null;
  sortOrder: number;
  points: string[];
  pointsHi: string[];
  activeSubscribers: number;
  everBought: number;
}

const blank = {
  name: '',
  nameHi: '',
  type: 'PAID' as PlanType,
  price: '299',
  durationDays: '30',
  listingLimit: '5',
  unlimited: false,
  boostCredits: '0',
  shopPage: false,
  maxPerUser: '',
  needsApproval: false,
  visibility: 'PUBLIC' as Plan['visibility'],
  allCities: true,
  cityIds: [] as string[],
  validFrom: '',
  validTo: '',
  badge: '',
  badgeHi: '',
  sortOrder: '0',
  points: ['', '', '', ''],
  pointsHi: ['', '', '', ''],
};
type Form = typeof blank;

function toForm(p: Plan): Form {
  const pad = (a: string[]) => [...a, '', '', '', ''].slice(0, 4);
  return {
    name: p.name,
    nameHi: p.nameHi,
    type: p.type,
    price: String(p.pricePaise / 100),
    durationDays: String(p.durationDays),
    listingLimit: p.listingLimit === null ? '' : String(p.listingLimit),
    unlimited: p.listingLimit === null,
    boostCredits: String(p.boostCredits),
    shopPage: p.shopPage,
    maxPerUser: p.maxPerUser === null ? '' : String(p.maxPerUser),
    needsApproval: p.needsApproval,
    visibility: p.visibility,
    allCities: p.allCities,
    cityIds: p.cityIds,
    validFrom: p.validFrom?.slice(0, 10) ?? '',
    validTo: p.validTo?.slice(0, 10) ?? '',
    badge: p.badge ?? '',
    badgeHi: p.badgeHi ?? '',
    sortOrder: String(p.sortOrder),
    points: pad(p.points),
    pointsHi: pad(p.pointsHi),
  };
}

function toBody(f: Form) {
  const free = f.type === 'FREE' || f.type === 'TRIAL';
  return {
    name: f.name.trim(),
    nameHi: f.nameHi.trim(),
    type: f.type,
    pricePaise: free ? 0 : Math.round(Number(f.price) * 100),
    durationDays: Number(f.durationDays),
    listingLimit: f.unlimited ? null : Number(f.listingLimit),
    boostCredits: Number(f.boostCredits || 0),
    shopPage: f.type === 'BUSINESS' ? true : f.shopPage,
    maxPerUser: f.maxPerUser ? Number(f.maxPerUser) : null,
    needsApproval: free ? f.needsApproval : false,
    visibility: f.visibility,
    allCities: f.allCities,
    cityIds: f.allCities ? [] : f.cityIds,
    validFrom: f.validFrom ? new Date(`${f.validFrom}T00:00:00+05:30`).toISOString() : null,
    validTo: f.validTo ? new Date(`${f.validTo}T23:59:59+05:30`).toISOString() : null,
    badge: f.badge.trim() || null,
    badgeHi: f.badgeHi.trim() || null,
    sortOrder: Number(f.sortOrder || 0),
    points: f.points.map((p) => p.trim()).filter(Boolean),
    pointsHi: f.pointsHi.map((p) => p.trim()).filter(Boolean),
  };
}

// What the plan card looks like in the app (A-16).
function Preview({ f }: { f: Form }) {
  const b = toBody(f);
  const free = b.pricePaise === 0;
  return (
    <div className="preview-phone stack">
      <span className="muted">Preview in the app</span>
      <div className="preview-plan">
        {b.badge && <span className="badge">{b.badge}</span>}
        <strong>{b.name || 'Plan name'}</strong>
        <span className="price">{free ? 'Free' : rupees(b.pricePaise || 0)}</span>
        <span className="small">
          {b.durationDays || '—'} days · {b.listingLimit === null ? 'Unlimited items' : `${b.listingLimit || '—'} item${b.listingLimit === 1 ? '' : 's'}`}
        </span>
        {b.points.length > 0 && (
          <ul>
            {b.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <Button full>{free ? 'Activate free plan' : `Pay ${rupees(b.pricePaise || 0)} via UPI`}</Button>
      </div>
    </div>
  );
}

function PlanEditor({ plan, onClose }: { plan: Plan | null; onClose: () => void }) {
  const [f, setF] = useState<Form>(plan ? toForm(plan) : blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cities = useCities();
  const qc = useQueryClient();
  const toast = useToast();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const free = f.type === 'FREE' || f.type === 'TRIAL';

  const save = async () => {
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      await api(plan ? `/admin/plans/${plan.id}` : '/admin/plans', { method: plan ? 'PUT' : 'POST', body: toBody(f) });
      toast(plan ? 'Plan saved. Existing buyers keep their old terms.' : 'Plan created. It shows in the app now.');
      void qc.invalidateQueries({ queryKey: ['plans'] });
      onClose();
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
        setErrors(e.details?.fields ?? {});
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={plan ? `Edit ${plan.name}` : 'New plan'} onClose={onClose} wide>
      {plan && plan.everBought > 0 && <div className="notice notice-info">{plan.everBought} people bought this plan. Changes apply to new purchases only.</div>}
      <div className="split" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px' }}>
        <div className="form-grid">
          <Field label="Name (English)" error={errors.name}>{(id) => <Input id={id} value={f.name} maxLength={40} onChange={(e) => set('name', e.target.value)} />}</Field>
          <Field label="Name (Hindi)" error={errors.nameHi}>{(id) => <Input id={id} value={f.nameHi} maxLength={40} onChange={(e) => set('nameHi', e.target.value)} />}</Field>
          <Field label="Type">
            {(id) => (
              <Select id={id} value={f.type} onChange={(e) => set('type', e.target.value as PlanType)}>
                <option value="PAID">Paid</option>
                <option value="FREE">Free</option>
                <option value="TRIAL">Trial</option>
                <option value="BUSINESS">Business (shop page)</option>
              </Select>
            )}
          </Field>
          <Field label="Price (₹)" help={free ? 'Free and trial plans are always ₹0' : 'Whole rupees'} error={errors.pricePaise}>
            {(id) => <Input id={id} inputMode="numeric" disabled={free} value={free ? '0' : f.price} onChange={(e) => set('price', e.target.value.replace(/\D/g, ''))} />}
          </Field>
          <Field label="Duration (days)" help="1 to 730" error={errors.durationDays}>{(id) => <Input id={id} inputMode="numeric" value={f.durationDays} onChange={(e) => set('durationDays', e.target.value.replace(/\D/g, ''))} />}</Field>
          <Field label="Listing limit" error={errors.listingLimit}>
            {(id) => (
              <div className="row">
                <Input id={id} inputMode="numeric" disabled={f.unlimited} value={f.unlimited ? '' : f.listingLimit} onChange={(e) => set('listingLimit', e.target.value.replace(/\D/g, ''))} className="grow" />
                <Checkbox label="Unlimited" checked={f.unlimited} onChange={(v) => set('unlimited', v)} />
              </div>
            )}
          </Field>
          <Field label="Boost credits per month">{(id) => <Input id={id} inputMode="numeric" value={f.boostCredits} onChange={(e) => set('boostCredits', e.target.value.replace(/\D/g, ''))} />}</Field>
          <Field label="Max times per user" help={free ? 'Required for free plans. Usually 1.' : 'Empty = no limit'} error={errors.maxPerUser}>
            {(id) => <Input id={id} inputMode="numeric" value={f.maxPerUser} onChange={(e) => set('maxPerUser', e.target.value.replace(/\D/g, ''))} />}
          </Field>
          <Field label="Visibility">
            {(id) => (
              <Select id={id} value={f.visibility} onChange={(e) => set('visibility', e.target.value as Plan['visibility'])}>
                <option value="PUBLIC">Public — shown to everyone</option>
                <option value="HIDDEN">Hidden — only by Give plan</option>
                <option value="ARCHIVED">Archived — no new sales</option>
              </Select>
            )}
          </Field>
          <Field label="Order on Plans screen">{(id) => <Input id={id} inputMode="numeric" value={f.sortOrder} onChange={(e) => set('sortOrder', e.target.value.replace(/\D/g, ''))} />}</Field>
          <Field label="Sale starts (optional)">{(id) => <Input id={id} type="date" value={f.validFrom} onChange={(e) => set('validFrom', e.target.value)} />}</Field>
          <Field label="Sale ends (optional)">{(id) => <Input id={id} type="date" value={f.validTo} onChange={(e) => set('validTo', e.target.value)} />}</Field>
          <Field label="Badge (English)" help="e.g. Popular, Best value">{(id) => <Input id={id} value={f.badge} maxLength={20} onChange={(e) => set('badge', e.target.value)} />}</Field>
          <Field label="Badge (Hindi)">{(id) => <Input id={id} value={f.badgeHi} maxLength={20} onChange={(e) => set('badgeHi', e.target.value)} />}</Field>
          <div className="full stack">
            {free && <Checkbox label="Activate only after an admin approves" checked={f.needsApproval} onChange={(v) => set('needsApproval', v)} />}
            {f.type !== 'BUSINESS' && <Checkbox label="Includes a shop page" checked={f.shopPage} onChange={(v) => set('shopPage', v)} />}
            <Checkbox label="Available in all cities" checked={f.allCities} onChange={(v) => set('allCities', v)} />
            {!f.allCities && (
              <div className="row">
                {cities.data?.items.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="chip"
                    aria-pressed={f.cityIds.includes(c.id)}
                    onClick={() => set('cityIds', f.cityIds.includes(c.id) ? f.cityIds.filter((x) => x !== c.id) : [...f.cityIds, c.id])}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="full stack">
            <span className="small"><strong>Points shown under the plan</strong> (up to 4)</span>
            {f.points.map((p, i) => (
              <div className="row" key={i}>
                <Input aria-label={`Point ${i + 1} English`} placeholder="English" value={p} maxLength={60} onChange={(e) => set('points', f.points.map((x, j) => (j === i ? e.target.value : x)))} className="grow" />
                <Input aria-label={`Point ${i + 1} Hindi`} placeholder="हिंदी" value={f.pointsHi[i]} maxLength={60} onChange={(e) => set('pointsHi', f.pointsHi.map((x, j) => (j === i ? e.target.value : x)))} className="grow" />
              </div>
            ))}
          </div>
        </div>
        <Preview f={f} />
      </div>
      {error && <div className="notice notice-error">{error}</div>}
      <div className="dialog-actions">
        <Button variant="text" onClick={onClose}>
          Cancel
        </Button>
        <Button loading={busy} onClick={save}>
          {plan ? 'Save changes' : 'Create plan'}
        </Button>
      </div>
    </Dialog>
  );
}

export function PlansPage() {
  const q = useQuery({ queryKey: ['plans'], queryFn: () => api<{ items: Plan[] }>('/admin/plans') });
  const [editing, setEditing] = useState<Plan | 'new' | null>(null);
  const [archiving, setArchiving] = useState<Plan | null>(null);
  const qc = useQueryClient();
  const toast = useToast();

  return (
    <>
      <PageHead title="Plans" sub="Every plan in the app comes from here. Edits never change what people already bought.">
        <Button onClick={() => setEditing('new')}>New plan</Button>
      </PageHead>
      {q.isError && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      <div className="card card-tight">
        {q.isLoading ? (
          <div style={{ padding: 16 }}><SkeletonRows /></div>
        ) : !q.data?.items.length ? (
          <Empty title="No plans yet" action={<Button onClick={() => setEditing('new')}>Create the first plan</Button>}>Listers cannot go live until there is at least one plan.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th className="right">Price</th>
                <th className="right">Days</th>
                <th className="right">Items</th>
                <th>Visibility</th>
                <th className="right">Active</th>
                <th>Sale window</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    <div className="muted">{p.nameHi}</div>
                  </td>
                  <td><Pill status="neutral" label={p.type.toLowerCase()} /></td>
                  <td className="right num">{p.pricePaise ? rupees(p.pricePaise) : 'Free'}</td>
                  <td className="right num">{p.durationDays}</td>
                  <td className="right num">{p.listingLimit ?? '∞'}</td>
                  <td><Pill status={p.visibility === 'PUBLIC' ? 'live' : p.visibility === 'HIDDEN' ? 'pending' : 'hidden'} label={p.visibility.toLowerCase()} /></td>
                  <td className="right num">{p.activeSubscribers}</td>
                  <td className="small">{p.validFrom || p.validTo ? `${date(p.validFrom)} – ${date(p.validTo)}` : 'Always'}</td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      <Button variant="text" size="sm" onClick={() => setEditing(p)}>Edit</Button>
                      {p.visibility !== 'ARCHIVED' && <Button variant="text" size="sm" onClick={() => setArchiving(p)}>Archive</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editing && <PlanEditor plan={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {archiving && (
        <ConfirmDialog
          title={`Archive ${archiving.name}?`}
          body={<p>It stops being sold. People who already have it keep it until it ends.</p>}
          confirmLabel="Archive"
          onClose={() => setArchiving(null)}
          onConfirm={async () => {
            const body = { ...toBody(toForm(archiving)), visibility: 'ARCHIVED' };
            await api(`/admin/plans/${archiving.id}`, { method: 'PUT', body });
            toast('Plan archived');
            void qc.invalidateQueries({ queryKey: ['plans'] });
          }}
        />
      )}
    </>
  );
}

interface PlanRequest {
  id: string;
  planName: string;
  createdAt: string;
  user: { id: string; name: string | null; city: string | null; since: string };
}

export function PlanRequestsPage() {
  const q = useQuery({ queryKey: ['plan-requests'], queryFn: () => api<{ items: PlanRequest[]; total: number }>('/admin/plan-requests') });
  const [rejecting, setRejecting] = useState<PlanRequest | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const approve = async (r: PlanRequest) => {
    try {
      await api(`/admin/plan-requests/${r.id}`, { body: { decision: 'approve' } });
      toast(`${r.planName} activated for ${r.user.name ?? 'user'}`);
      void qc.invalidateQueries({ queryKey: ['plan-requests'] });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed', { error: true });
    }
  };
  return (
    <>
      <PageHead title="Free plan requests" sub="Free plans that were set to need approval wait here." />
      <div className="card card-tight">
        {q.isLoading ? (
          <div style={{ padding: 16 }}><SkeletonRows /></div>
        ) : !q.data?.items.length ? (
          <Empty title="Nothing waiting" />
        ) : (
          <table className="table">
            <thead>
              <tr><th>Person</th><th>City</th><th>Plan</th><th>Asked</th><th /></tr>
            </thead>
            <tbody>
              {q.data.items.map((r) => (
                <tr key={r.id}>
                  <td>{r.user.name ?? 'No name'}<div className="muted">Member since {date(r.user.since)}</div></td>
                  <td>{r.user.city ?? '—'}</td>
                  <td>{r.planName}</td>
                  <td className="small">{date(r.createdAt)}</td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      <Button variant="danger-outline" size="sm" onClick={() => setRejecting(r)}>Reject</Button>
                      <Button size="sm" onClick={() => approve(r)}>Approve</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {rejecting && (
        <ConfirmDialog
          title="Reject request"
          reasonLabel="Reason"
          confirmLabel="Reject"
          danger
          onClose={() => setRejecting(null)}
          onConfirm={async (reason) => {
            await api(`/admin/plan-requests/${rejecting.id}`, { body: { decision: 'reject', reason } });
            void qc.invalidateQueries({ queryKey: ['plan-requests'] });
          }}
        />
      )}
    </>
  );
}
