import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ago, dateTime } from '../lib/format';
import { PageHead } from '../components/Layout';
import { Button, ConfirmDialog, Dialog, Empty, ErrorNote, Field, Input, Pager, Pill, Select, SkeletonRows, useToast } from '../components/ui';

interface Admin { id: string; name: string; email: string; role: 'ADMIN' | 'SUPER_ADMIN'; lastLoginAt: string | null; disabled: boolean; totpEnabled: boolean }
interface Invite { id: string; email: string; name: string; role: string; expiresAt: string }

export function AdminsPage() {
  const { admin: me, withStepUp } = useAuth();
  const q = useQuery({ queryKey: ['admins'], queryFn: () => api<{ items: Admin[]; invites: Invite[] }>('/admin/admins') });
  const [inviting, setInviting] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [toggle, setToggle] = useState<Admin | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  return (
    <>
      <PageHead title="Staff accounts" sub="ADMIN does the daily work. SUPER_ADMIN also changes settings, staff and ID checks.">
        <Button onClick={() => setInviting(true)}>Invite</Button>
      </PageHead>
      {q.isError && <ErrorNote error={q.error} />}
      <div className="card card-tight">
        {q.isLoading ? <div style={{ padding: 16 }}><SkeletonRows rows={3} /></div> : (
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>2-step</th><th>Last login</th><th>Status</th><th /></tr></thead>
            <tbody>
              {q.data?.items.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}{a.id === me?.id && <span className="muted"> (you)</span>}</td>
                  <td>{a.email}</td>
                  <td>{a.role === 'SUPER_ADMIN' ? 'Super admin' : 'Admin'}</td>
                  <td>{a.totpEnabled ? 'On' : <span className="danger-text">Not set</span>}</td>
                  <td className="small">{ago(a.lastLoginAt)}</td>
                  <td><Pill status={a.disabled ? 'blocked' : 'active'} label={a.disabled ? 'Disabled' : 'Active'} /></td>
                  <td>
                    {a.id !== me?.id && (
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <Button size="sm" variant="text" onClick={async () => {
                          try {
                            await withStepUp(() => api(`/admin/admins/${a.id}`, { method: 'PATCH', body: { role: a.role === 'ADMIN' ? 'SUPER_ADMIN' : 'ADMIN' } }));
                            void qc.invalidateQueries({ queryKey: ['admins'] });
                            toast('Role changed');
                          } catch (e) { toast(e instanceof Error ? e.message : 'Failed', { error: true }); }
                        }}>Make {a.role === 'ADMIN' ? 'Super admin' : 'Admin'}</Button>
                        <Button size="sm" variant={a.disabled ? 'secondary' : 'danger-outline'} onClick={() => setToggle(a)}>{a.disabled ? 'Enable' : 'Disable'}</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {!!q.data?.invites.length && (
        <>
          <h2 style={{ margin: 'var(--s6) 0 var(--s3)' }}>Open invites</h2>
          <div className="card card-tight">
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Expires</th><th /></tr></thead>
              <tbody>
                {q.data.invites.map((i) => (
                  <tr key={i.id}><td>{i.name}</td><td>{i.email}</td><td>{i.role}</td><td className="small">{dateTime(i.expiresAt)}</td>
                    <td><Button size="sm" variant="text" onClick={async () => { await api(`/admin/admins/invites/${i.id}`, { method: 'DELETE' }); void qc.invalidateQueries({ queryKey: ['admins'] }); }}>Cancel</Button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {inviting && <InviteDialog onClose={() => setInviting(false)} onDone={(url) => { setInviting(false); setLink(url); void qc.invalidateQueries({ queryKey: ['admins'] }); }} />}
      {link && (
        <Dialog title="Invite link" onClose={() => setLink(null)}>
          <p className="small">Send this privately (not in a group). It works once and expires in 24 hours.</p>
          <Input readOnly value={link} onFocus={(e) => e.target.select()} />
          <div className="dialog-actions"><Button onClick={() => { void navigator.clipboard.writeText(link); toast('Copied'); }}>Copy</Button></div>
        </Dialog>
      )}
      {toggle && (
        <ConfirmDialog title={toggle.disabled ? `Enable ${toggle.name}?` : `Disable ${toggle.name}?`} body={!toggle.disabled ? <p>They are signed out right away.</p> : undefined} confirmLabel={toggle.disabled ? 'Enable' : 'Disable'} danger={!toggle.disabled} onClose={() => setToggle(null)}
          onConfirm={async () => { await withStepUp(() => api(`/admin/admins/${toggle.id}`, { method: 'PATCH', body: { disabled: !toggle.disabled } })); void qc.invalidateQueries({ queryKey: ['admins'] }); }} />
      )}
    </>
  );
}

function InviteDialog({ onClose, onDone }: { onClose: () => void; onDone: (url: string) => void }) {
  const { withStepUp } = useAuth();
  const [f, setF] = useState({ email: '', name: '', role: 'ADMIN' });
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog title="Invite staff" onClose={onClose}>
      <Field label="Name">{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
      <Field label="Work email">{(id) => <Input id={id} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
      <Field label="Role">{(id) => <Select id={id} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="ADMIN">Admin</option><option value="SUPER_ADMIN">Super admin</option></Select>}</Field>
      {error && <div className="notice notice-error">{error}</div>}
      <div className="dialog-actions">
        <Button variant="text" onClick={onClose}>Cancel</Button>
        <Button disabled={!f.email || f.name.length < 2} onClick={async () => {
          try { const r = await withStepUp(() => api<{ inviteUrl: string }>('/admin/admins', { body: f })); onDone(r.inviteUrl); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
        }}>Create invite</Button>
      </div>
    </Dialog>
  );
}

interface AuditRow { id: string; actorName: string; actorType: string; action: string; entity: string; entityId: string | null; before: unknown; after: unknown; ip: string | null; createdAt: string }

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [open, setOpen] = useState<AuditRow | null>(null);
  const q = useQuery({
    queryKey: ['audit', page, actorId, action, from, to],
    queryFn: () => api<{ items: AuditRow[]; total: number; admins: Array<{ id: string; name: string }> }>(`/admin/audit${qs({ page, actorId: actorId || undefined, action: action || undefined, from: from || undefined, to: to || undefined })}`),
  });
  return (
    <>
      <PageHead title="Audit log" sub="Every admin action. Rows cannot be edited or deleted, by anyone." />
      <div className="row" style={{ marginBottom: 'var(--s4)' }}>
        <Select value={actorId} onChange={(e) => { setActorId(e.target.value); setPage(1); }} style={{ width: 180 }} aria-label="Admin">
          <option value="">All admins</option>
          {q.data?.admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <Input placeholder="Action starts with, e.g. payment" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} style={{ width: 260 }} />
        <Input type="date" aria-label="From" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} style={{ width: 160 }} />
        <Input type="date" aria-label="To" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} style={{ width: 160 }} />
      </div>
      {q.isError && <ErrorNote error={q.error} />}
      <div className="card card-tight">
        {q.isLoading ? <div style={{ padding: 16 }}><SkeletonRows /></div> : !q.data?.items.length ? <Empty title="No entries" /> : (
          <table className="table">
            <thead><tr><th>When</th><th>Who</th><th>Action</th><th>What</th><th>IP</th></tr></thead>
            <tbody>
              {q.data.items.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => setOpen(r)}>
                  <td className="small">{dateTime(r.createdAt)}</td>
                  <td>{r.actorName}</td>
                  <td className="utr">{r.action}</td>
                  <td className="small">{r.entity}{r.entityId ? ` ${r.entityId.slice(0, 8)}` : ''}</td>
                  <td className="small num">{r.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {q.data && <Pager page={page} pageSize={25} total={q.data.total} onPage={setPage} />}
      </div>
      {open && (
        <Dialog title={open.action} onClose={() => setOpen(null)} wide>
          <p className="small">{open.actorName} · {dateTime(open.createdAt)} · {open.entity} {open.entityId}</p>
          <div className="split" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div><strong className="small">Before</strong><pre className="card small pre">{JSON.stringify(open.before, null, 2) ?? '—'}</pre></div>
            <div><strong className="small">After</strong><pre className="card small pre">{JSON.stringify(open.after, null, 2) ?? '—'}</pre></div>
          </div>
        </Dialog>
      )}
    </>
  );
}

export function SessionsPage() {
  const q = useQuery({ queryKey: ['sessions'], queryFn: () => api<{ items: Array<{ id: string; ip: string | null; userAgent: string | null; createdAt: string; lastSeenAt: string; current: boolean }> }>('/admin/auth/sessions') });
  const qc = useQueryClient();
  return (
    <>
      <PageHead title="My sessions" sub="Sign out anywhere you do not recognise. Sessions end after 8 hours, or 30 minutes of no use." />
      <div className="card card-tight">
        {q.isLoading ? <div style={{ padding: 16 }}><SkeletonRows rows={2} /></div> : (
          <table className="table">
            <thead><tr><th>Browser</th><th>IP</th><th>Started</th><th>Last used</th><th /></tr></thead>
            <tbody>
              {q.data?.items.map((s) => (
                <tr key={s.id}>
                  <td className="small">{s.userAgent?.slice(0, 80) ?? 'Unknown'}{s.current && <strong> (this one)</strong>}</td>
                  <td className="num small">{s.ip}</td>
                  <td className="small">{dateTime(s.createdAt)}</td>
                  <td className="small">{ago(s.lastSeenAt)}</td>
                  <td>{!s.current && <Button size="sm" variant="text" onClick={async () => { await api(`/admin/auth/sessions/${s.id}`, { method: 'DELETE' }); void qc.invalidateQueries({ queryKey: ['sessions'] }); }}>Sign out</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
