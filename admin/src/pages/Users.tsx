import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ago, date, dateTime, humanize, rupees } from '../lib/format';
import { PageHead } from '../components/Layout';
import { Button, ConfirmDialog, Dialog, Empty, ErrorNote, Field, Input, Pager, Pill, Select, SkeletonRows, Textarea, useToast } from '../components/ui';
import { useCities } from './Dashboard';

interface UserRow {
  id: string;
  name: string | null;
  phoneMasked: string;
  city: string | null;
  status: string;
  isLister: boolean;
  idVerified: boolean;
  listings: number;
  createdAt: string;
  lastSeenAt: string | null;
}

export function UsersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [listers, setListers] = useState('');
  const [cityId, setCityId] = useState('');
  const [page, setPage] = useState(1);
  const cities = useCities();
  const q = useQuery({
    queryKey: ['users', search, status, listers, cityId, page],
    queryFn: () => api<{ items: UserRow[]; total: number }>(`/admin/users${qs({ q: search || undefined, status: status || undefined, listers: listers || undefined, cityId: cityId || undefined, page })}`),
  });
  return (
    <>
      <PageHead title="Users" sub="Search by name or the last 4 digits of the number." />
      <div className="row" style={{ marginBottom: 'var(--s4)' }}>
        <Input placeholder="Name or last 4 digits" value={search} maxLength={60} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ maxWidth: 280 }} />
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} style={{ width: 150 }} aria-label="Status">
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="BLOCKED">Blocked</option>
          <option value="DELETED">Deleted</option>
        </Select>
        <Select value={listers} onChange={(e) => { setListers(e.target.value); setPage(1); }} style={{ width: 150 }} aria-label="Type">
          <option value="">Everyone</option>
          <option value="true">Listers</option>
          <option value="false">Seekers</option>
        </Select>
        <Select value={cityId} onChange={(e) => { setCityId(e.target.value); setPage(1); }} style={{ width: 170 }} aria-label="City">
          <option value="">All cities</option>
          {cities.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      {q.isError && <ErrorNote error={q.error} />}
      <div className="card card-tight">
        {q.isLoading ? (
          <div style={{ padding: 16 }}><SkeletonRows /></div>
        ) : !q.data?.items.length ? (
          <Empty title="No one matches" />
        ) : (
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Number</th><th>City</th><th>Type</th><th className="right">Items</th><th>Joined</th><th>Last seen</th><th>Status</th></tr>
            </thead>
            <tbody>
              {q.data.items.map((u) => (
                <tr key={u.id}>
                  <td><Link to={`/users/${u.id}`}>{u.name ?? 'No name yet'}</Link>{u.idVerified && <span className="muted"> · verified</span>}</td>
                  <td className="num">{u.phoneMasked}</td>
                  <td>{u.city ?? '—'}</td>
                  <td>{u.isLister ? 'Lister' : 'Seeker'}</td>
                  <td className="right num">{u.listings}</td>
                  <td className="small">{date(u.createdAt)}</td>
                  <td className="small">{ago(u.lastSeenAt)}</td>
                  <td><Pill status={u.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {q.data && <Pager page={page} pageSize={25} total={q.data.total} onPage={setPage} />}
      </div>
    </>
  );
}

interface UserDetail {
  id: string;
  name: string | null;
  phoneMasked: string;
  city: string | null;
  status: string;
  blockReason: string | null;
  isLister: boolean;
  idVerified: boolean;
  language: string;
  createdAt: string;
  lastSeenAt: string | null;
  deletion: { requestedAt: string; dueAt: string; completedAt: string | null } | null;
  listings: Array<{ id: string; title: string; status: string; viewCount: number; waClickCount: number; reportCount: number }>;
  subscriptions: Array<{ id: string; planName: string; type: string; status: string; startsAt: string | null; endsAt: string | null; source: string; assignReason: string | null }>;
  payments: Array<{ id: string; reference: string; purpose: string; amountPaise: number; status: string; utrLast4: string | null; createdAt: string }>;
  reports: Array<{ id: string; reason: string; status: string; createdAt: string }>;
}

export function UserDetailPage() {
  const { id } = useParams();
  const { withStepUp } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['user', id], queryFn: () => api<UserDetail>(`/admin/users/${id}`) });
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api<{ items: Array<{ id: string; name: string; pricePaise: number; visibility: string; durationDays: number }> }>('/admin/plans') });
  const [dialog, setDialog] = useState<'block' | 'unblock' | 'give' | 'reveal' | null>(null);
  const [cancelSub, setCancelSub] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['user', id] });

  if (q.isError) return <ErrorNote error={q.error} onRetry={() => q.refetch()} />;
  const u = q.data;
  if (!u) return <SkeletonRows rows={4} height={90} />;

  return (
    <>
      <PageHead title={u.name ?? 'No name yet'} sub={`${u.city ?? 'No city'} · joined ${date(u.createdAt)}`}>
        {u.status === 'ACTIVE' && <Button variant="secondary" onClick={() => setDialog('give')}>Give plan</Button>}
        {u.status === 'ACTIVE' && <Button variant="danger-outline" onClick={() => setDialog('block')}>Block</Button>}
        {u.status === 'BLOCKED' && <Button variant="secondary" onClick={() => setDialog('unblock')}>Unblock</Button>}
      </PageHead>
      <div className="split">
        <div className="stack-lg">
          <div className="card stack">
            <h3>Items</h3>
            {u.listings.length ? (
              <table className="table">
                <thead><tr><th>Title</th><th>Status</th><th className="right">Views</th><th className="right">Chats</th><th className="right">Reports</th></tr></thead>
                <tbody>
                  {u.listings.map((l) => (
                    <tr key={l.id}><td>{l.title}</td><td><Pill status={l.status} /></td><td className="right num">{l.viewCount}</td><td className="right num">{l.waClickCount}</td><td className="right num">{l.reportCount}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="muted">No items.</p>}
          </div>
          <div className="card stack">
            <h3>Plans</h3>
            {u.subscriptions.length ? (
              <table className="table">
                <thead><tr><th>Plan</th><th>Status</th><th>From</th><th>To</th><th>Source</th><th /></tr></thead>
                <tbody>
                  {u.subscriptions.map((s) => (
                    <tr key={s.id}>
                      <td>{s.planName}</td>
                      <td><Pill status={s.status} /></td>
                      <td className="small">{date(s.startsAt)}</td>
                      <td className="small">{date(s.endsAt)}</td>
                      <td className="small">{s.source}{s.assignReason ? ` — ${s.assignReason}` : ''}</td>
                      <td>{['ACTIVE', 'EXPIRING', 'SCHEDULED'].includes(s.status) && <Button size="sm" variant="text" onClick={() => setCancelSub(s.id)}>Cancel</Button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="muted">No plans.</p>}
          </div>
          <div className="card stack">
            <h3>Payments</h3>
            {u.payments.length ? (
              <table className="table">
                <thead><tr><th>Ref</th><th>For</th><th className="right">Amount</th><th>UTR</th><th>Status</th><th>When</th></tr></thead>
                <tbody>
                  {u.payments.map((p) => (
                    <tr key={p.id}><td className="utr">{p.reference}</td><td>{humanize(p.purpose)}</td><td className="right num">{rupees(p.amountPaise)}</td><td className="utr">{p.utrLast4 ? `…${p.utrLast4}` : '—'}</td><td><Pill status={p.status} /></td><td className="small">{dateTime(p.createdAt)}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="muted">No payments.</p>}
          </div>
        </div>
        <div className="card stack">
          <h3>Profile</h3>
          <dl className="kv">
            <dt>Status</dt><dd><Pill status={u.status} /></dd>
            {u.blockReason && (<><dt>Block reason</dt><dd>{u.blockReason}</dd></>)}
            <dt>Number</dt>
            <dd className="num">
              {revealed ?? u.phoneMasked}{' '}
              {!revealed && u.status !== 'DELETED' && <Button size="sm" variant="text" onClick={() => setDialog('reveal')}>Show</Button>}
            </dd>
            <dt>Language</dt><dd>{u.language === 'hi' ? 'Hindi' : 'English'}</dd>
            <dt>Type</dt><dd>{u.isLister ? 'Lister' : 'Seeker'}</dd>
            <dt>ID verified</dt><dd>{u.idVerified ? 'Yes' : 'No'}</dd>
            <dt>Last seen</dt><dd>{ago(u.lastSeenAt)}</dd>
            {u.deletion && (<><dt>Deletion</dt><dd>{u.deletion.completedAt ? `Done ${date(u.deletion.completedAt)}` : `Requested, due ${date(u.deletion.dueAt)}`}</dd></>)}
          </dl>
          <h3>Reports against</h3>
          {u.reports.length ? u.reports.map((r) => <div key={r.id} className="row-between small"><span>{humanize(r.reason)}</span><Pill status={r.status} /></div>) : <p className="muted">None.</p>}
        </div>
      </div>

      {dialog === 'block' && (
        <ConfirmDialog title="Block this account?" body={<p>They are signed out on every phone and all items are hidden.</p>} reasonLabel="Reason" confirmLabel="Block" danger onClose={() => setDialog(null)}
          onConfirm={async (reason) => { await api(`/admin/users/${u.id}/block`, { body: { reason } }); toast('Account blocked'); void refresh(); }} />
      )}
      {dialog === 'unblock' && (
        <ConfirmDialog title="Unblock this account?" body={<p>Their items come back as drafts.</p>} reasonLabel="Reason" confirmLabel="Unblock" onClose={() => setDialog(null)}
          onConfirm={async (reason) => { await api(`/admin/users/${u.id}/unblock`, { body: { reason } }); toast('Account unblocked'); void refresh(); }} />
      )}
      {dialog === 'reveal' && (
        <ConfirmDialog title="Show full number" body={<p>This is recorded in the audit log with your name.</p>} reasonLabel="Why do you need it?" confirmLabel="Show number" onClose={() => setDialog(null)}
          onConfirm={async (why) => { const r = await api<{ phone: string }>(`/admin/users/${u.id}/reveal-phone`, { body: { why } }); setRevealed(r.phone); }} />
      )}
      {cancelSub && (
        <ConfirmDialog title="Cancel this plan?" body={<p>It ends now. Items go to hidden if there is no other plan. No refund is made automatically.</p>} reasonLabel="Reason" confirmLabel="Cancel plan" danger onClose={() => setCancelSub(null)}
          onConfirm={async (reason) => { await api(`/admin/subscriptions/${cancelSub}/cancel`, { body: { reason } }); toast('Plan cancelled'); void refresh(); }} />
      )}
      {dialog === 'give' && (
        <GivePlan
          plans={(plans.data?.items ?? []).filter((p) => p.visibility !== 'ARCHIVED')}
          onClose={() => setDialog(null)}
          onGive={async (planId, reason) => {
            await withStepUp(() => api(`/admin/users/${u.id}/give-plan`, { body: { planId, reason } }));
            toast('Plan given');
            void refresh();
          }}
        />
      )}
    </>
  );
}

function GivePlan({ plans, onClose, onGive }: { plans: Array<{ id: string; name: string; pricePaise: number; durationDays: number }>; onClose: () => void; onGive: (planId: string, reason: string) => Promise<void> }) {
  const { isSuper } = useAuth();
  const [planId, setPlanId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const plan = plans.find((p) => p.id === planId);
  return (
    <Dialog title="Give a plan" onClose={onClose}>
      <p className="small">For partners, compensation or offline payments. Logged with your reason.</p>
      <Field label="Plan">
        {(id) => (
          <Select id={id} value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">Choose…</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id} disabled={p.pricePaise > 0 && !isSuper}>
                {p.name} — {p.pricePaise ? rupees(p.pricePaise) : 'Free'}, {p.durationDays} days{p.pricePaise > 0 && !isSuper ? ' (Super admin only)' : ''}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Reason">{(id) => <Textarea id={id} rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      {plan && plan.pricePaise > 0 && <div className="notice notice-warn">You are giving a paid plan for free. You will be asked for your 2-step code.</div>}
      {error && <div className="notice notice-error">{error}</div>}
      <div className="dialog-actions">
        <Button variant="text" onClick={onClose}>Cancel</Button>
        <Button loading={busy} disabled={!planId || reason.trim().length < 3} onClick={async () => {
          setBusy(true);
          setError(null);
          try { await onGive(planId, reason.trim()); onClose(); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); setBusy(false); }
        }}>Give plan</Button>
      </div>
    </Dialog>
  );
}
