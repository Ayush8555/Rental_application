import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, qs } from '../lib/api';
import { date, dateTime } from '../lib/format';
import { PageHead } from '../components/Layout';
import { Button, ConfirmDialog, Dialog, Empty, ErrorNote, Pager, Pill, SkeletonRows, Tabs, useToast } from '../components/ui';

interface Row {
  id: string;
  status: string;
  createdAt: string;
  decidedAt: string | null;
  rejectReason: string | null;
  hasDocument: boolean;
  user: { id: string; name: string | null; phoneMasked: string; city: string | null; since: string; listings: number };
}

type Tab = 'PENDING' | 'APPROVED' | 'REJECTED';

export function IdVerificationsPage() {
  const [tab, setTab] = useState<Tab>('PENDING');
  const [page, setPage] = useState(1);
  const [doc, setDoc] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['idv', tab, page], queryFn: () => api<{ items: Row[]; total: number }>(`/admin/id-verifications${qs({ status: tab, page })}`) });
  const view = useMutation({ mutationFn: (id: string) => api<{ url: string }>(`/admin/id-verifications/${id}/document`), onSuccess: (r) => setDoc(r.url), onError: (e: Error) => toast(e.message, { error: true }) });
  const decide = async (r: Row, decision: 'approve' | 'reject', reason?: string) => {
    await api(`/admin/id-verifications/${r.id}`, { body: { decision, ...(reason ? { reason } : {}) } });
    toast(decision === 'approve' ? 'Verified badge given' : 'Rejected');
    void qc.invalidateQueries({ queryKey: ['idv'] });
  };
  return (
    <>
      <PageHead title="ID checks" sub="Super admin only. Every view is logged and the photo is deleted 30 days after your decision." />
      <Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} items={[{ value: 'PENDING', label: 'Waiting' }, { value: 'APPROVED', label: 'Approved' }, { value: 'REJECTED', label: 'Rejected' }]} />
      {q.isError && <ErrorNote error={q.error} />}
      <div className="card card-tight">
        {q.isLoading ? <div style={{ padding: 16 }}><SkeletonRows /></div> : !q.data?.items.length ? <Empty title="Nothing here" /> : (
          <table className="table">
            <thead><tr><th>Lister</th><th>City</th><th className="right">Items</th><th>Sent</th><th /></tr></thead>
            <tbody>
              {q.data.items.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/users/${r.user.id}`}>{r.user.name ?? 'No name'}</Link><div className="muted num">{r.user.phoneMasked} · since {date(r.user.since)}</div></td>
                  <td>{r.user.city ?? '—'}</td>
                  <td className="right num">{r.user.listings}</td>
                  <td className="small">{dateTime(r.createdAt)}{r.rejectReason && <div className="danger-text">{r.rejectReason}</div>}</td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      {r.hasDocument ? <Button size="sm" variant="text" onClick={() => view.mutate(r.id)}>View ID</Button> : <span className="muted">Photo deleted</span>}
                      {tab === 'PENDING' ? (
                        <>
                          <Button size="sm" variant="danger-outline" onClick={() => setRejecting(r)}>Reject</Button>
                          <Button size="sm" onClick={() => decide(r, 'approve').catch((e: Error) => toast(e.message, { error: true }))}>Approve</Button>
                        </>
                      ) : <Pill status={r.status} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {q.data && <Pager page={page} pageSize={25} total={q.data.total} onPage={setPage} />}
      </div>
      {doc && (
        <Dialog title="ID document" onClose={() => setDoc(null)} wide>
          <div className="lightbox"><img src={doc} alt="ID document" referrerPolicy="no-referrer" /></div>
          <p className="muted">Do not download or screenshot this. The link expires in 10 minutes.</p>
        </Dialog>
      )}
      {rejecting && (
        <ConfirmDialog title="Reject ID" reasonLabel="Reason (sent to the lister)" reasons={['Photo is blurry', 'Name does not match', 'Document is cut off', 'Not a valid ID']} confirmLabel="Reject" danger onClose={() => setRejecting(null)} onConfirm={(reason) => decide(rejecting, 'reject', reason)} />
      )}
    </>
  );
}
