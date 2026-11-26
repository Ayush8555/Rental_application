import { useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { WarningCircle } from '@phosphor-icons/react';
import { api, newIdempotencyKey, qs } from '../lib/api';
import { ago, dateTime, rupees } from '../lib/format';
import { PageHead } from '../components/Layout';
import { Button, ConfirmDialog, Dialog, Empty, ErrorNote, Input, Pager, Pill, SkeletonRows, Tabs, useToast } from '../components/ui';

interface Payment {
  id: string;
  reference: string;
  purpose: 'PLAN' | 'BOOST';
  what: string;
  listPricePaise: number;
  discountPaise: number;
  amountPaise: number;
  coupon: string | null;
  utr: string | null;
  duplicateUtr: boolean;
  hasScreenshot: boolean;
  status: string;
  rejectReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  submitCount: number;
  user: { id: string; name: string | null; phoneMasked: string; since: string; history: Record<string, number> };
}

type Tab = 'PENDING' | 'APPROVED' | 'REJECTED';

export function PaymentsPage() {
  const [tab, setTab] = useState<Tab>('PENDING');
  const [page, setPage] = useState(1);
  const [utr, setUtr] = useState('');
  const [approving, setApproving] = useState<Payment | null>(null);
  const [rejecting, setRejecting] = useState<Payment | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const qc = useQueryClient();
  const toast = useToast();

  const q = useQuery({
    queryKey: ['payments', tab, page, utr],
    queryFn: () => api<{ items: Payment[]; total: number; rejectReasons: string[] }>(`/admin/payments${qs({ tab, page, utr: utr.length >= 4 ? utr : undefined })}`),
    refetchInterval: tab === 'PENDING' ? 30_000 : false,
  });

  const done = () => {
    void qc.invalidateQueries({ queryKey: ['payments'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const openShot = useMutation({
    mutationFn: (id: string) => api<{ url: string }>(`/admin/payments/${id}/screenshot`),
    onSuccess: (r) => setShot(r.url),
    onError: (e: Error) => toast(e.message, { error: true }),
  });

  return (
    <>
      <PageHead title="Payments" sub="Match every UTR and amount with the bank statement before approving. The screenshot is only supporting proof.">
        <Input placeholder="Search last digits of UTR" inputMode="numeric" value={utr} onChange={(e) => { setUtr(e.target.value.replace(/\D/g, '').slice(0, 12)); setPage(1); }} style={{ width: 230 }} />
      </PageHead>
      <Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} items={[{ value: 'PENDING', label: 'Pending' }, { value: 'APPROVED', label: 'Approved' }, { value: 'REJECTED', label: 'Rejected' }]} />
      {q.isError && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      <div className="card card-tight">
        {q.isLoading ? (
          <div style={{ padding: 16 }}><SkeletonRows /></div>
        ) : !q.data?.items.length ? (
          <Empty title={tab === 'PENDING' ? 'No payments waiting' : 'Nothing here yet'}>{tab === 'PENDING' ? 'New UTR submissions show up here within a minute.' : undefined}</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Person</th>
                  <th>For</th>
                  <th className="right">Amount</th>
                  <th>UTR</th>
                  <th>Submitted</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((p) => (
                  <tr key={p.id}>
                    <td className="utr">{p.reference}</td>
                    <td>
                      <Link to={`/users/${p.user.id}`}>{p.user.name ?? 'No name'}</Link>
                      <div className="muted num">{p.user.phoneMasked}</div>
                      <div className="muted">
                        {p.user.history.APPROVED ?? 0} approved · {p.user.history.REJECTED ?? 0} rejected
                      </div>
                    </td>
                    <td>
                      {p.what}
                      {p.coupon && <div className="muted">Coupon {p.coupon}</div>}
                    </td>
                    <td className="right num">
                      <strong>{rupees(p.amountPaise)}</strong>
                      {p.discountPaise > 0 && <div className="muted">of {rupees(p.listPricePaise)}</div>}
                    </td>
                    <td>
                      <span className={`utr ${p.duplicateUtr ? 'dup' : ''}`}>{p.utr ?? '—'}</span>
                      {p.duplicateUtr && (
                        <div className="flag"><WarningCircle size={14} /> Used on another payment</div>
                      )}
                      {p.submitCount > 1 && <div className="muted">Try {p.submitCount}</div>}
                    </td>
                    <td className="small">
                      {tab === 'PENDING' ? ago(p.submittedAt) : dateTime(p.reviewedAt)}
                      {p.rejectReason && <div className="danger-text">{p.rejectReason}</div>}
                    </td>
                    <td>
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        {p.hasScreenshot && (
                          <Button variant="text" size="sm" onClick={() => openShot.mutate(p.id)}>
                            Screenshot
                          </Button>
                        )}
                        {tab === 'PENDING' ? (
                          <>
                            <Button variant="danger-outline" size="sm" onClick={() => setRejecting(p)}>
                              Reject
                            </Button>
                            <Button size="sm" disabled={p.duplicateUtr} onClick={() => setApproving(p)}>
                              Approve
                            </Button>
                          </>
                        ) : (
                          <Pill status={p.status} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {q.data && <Pager page={page} pageSize={25} total={q.data.total} onPage={setPage} />}
      </div>

      {approving && (
        <ConfirmDialog
          title={`Approve ${rupees(approving.amountPaise)}?`}
          body={
            <>
              <p>
                UTR <span className="utr">{approving.utr}</span> · {approving.reference}
              </p>
              <p>Approve only if this exact UTR and amount appear in the company bank statement. This starts the {approving.purpose === 'PLAN' ? 'plan' : 'boost'} right away.</p>
            </>
          }
          confirmLabel="Approve payment"
          onClose={() => setApproving(null)}
          onConfirm={async () => {
            // One key per click: a double click or a retry cannot approve twice.
            await api(`/admin/payments/${approving.id}/approve`, { body: {}, headers: { 'Idempotency-Key': newIdempotencyKey() } });
            toast('Payment approved');
            done();
          }}
        />
      )}
      {rejecting && (
        <ConfirmDialog
          title="Reject payment"
          body={<p>The person gets a notification with this reason and can submit again.</p>}
          reasonLabel="Reason"
          reasons={q.data?.rejectReasons}
          confirmLabel="Reject"
          danger
          onClose={() => setRejecting(null)}
          onConfirm={async (reason) => {
            await api(`/admin/payments/${rejecting.id}/reject`, { body: { reason } });
            toast('Payment rejected');
            done();
          }}
        />
      )}
      {shot && (
        <Dialog title="Payment screenshot" onClose={() => setShot(null)} wide>
          <div className="lightbox">
            <img src={shot} alt="Payment screenshot" referrerPolicy="no-referrer" />
          </div>
          <p className="muted">This link expires in 10 minutes. Opening it was recorded in the audit log.</p>
        </Dialog>
      )}
    </>
  );
}
