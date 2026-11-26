import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, qs } from '../lib/api';
import { dateTime, humanize } from '../lib/format';
import { PageHead } from '../components/Layout';
import { Button, ConfirmDialog, Empty, ErrorNote, Pager, Pill, SkeletonRows, Tabs, useToast } from '../components/ui';

interface Report {
  id: string;
  reason: string;
  note: string | null;
  status: string;
  actionNote: string | null;
  createdAt: string;
  listing: { id: string; title: string; status: string } | null;
  user: { id: string; name: string | null; status: string } | null;
  reporterMasked: string;
}

type Tab = 'OPEN' | 'ACTIONED' | 'DISMISSED';
type Action = 'remove_item' | 'warn' | 'block_user' | 'dismiss';

const ACTION_LABEL: Record<Action, string> = { remove_item: 'Remove item', warn: 'Warn lister', block_user: 'Block user', dismiss: 'Dismiss' };

export function ReportsPage() {
  const [tab, setTab] = useState<Tab>('OPEN');
  const [page, setPage] = useState(1);
  const [acting, setActing] = useState<{ r: Report; action: Action } | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['reports', tab, page], queryFn: () => api<{ items: Report[]; total: number }>(`/admin/reports${qs({ status: tab, page })}`) });

  return (
    <>
      <PageHead title="Reports" sub="Every action needs a short note. Reporters are never shown to the person reported." />
      <Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} items={[{ value: 'OPEN', label: 'Open' }, { value: 'ACTIONED', label: 'Actioned' }, { value: 'DISMISSED', label: 'Dismissed' }]} />
      {q.isError && <ErrorNote error={q.error} />}
      <div className="card card-tight">
        {q.isLoading ? (
          <div style={{ padding: 16 }}><SkeletonRows /></div>
        ) : !q.data?.items.length ? (
          <Empty title={tab === 'OPEN' ? 'No open reports' : 'Nothing here'} />
        ) : (
          <table className="table">
            <thead>
              <tr><th>About</th><th>Reason</th><th>Reporter</th><th>When</th><th /></tr>
            </thead>
            <tbody>
              {q.data.items.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.listing ? <>Item: <strong>{r.listing.title}</strong> <Pill status={r.listing.status} /></> : <>Person</>}
                    {r.user && <div className="small"><Link to={`/users/${r.user.id}`}>{r.user.name ?? 'No name'}</Link> {r.user.status !== 'ACTIVE' && <Pill status={r.user.status} />}</div>}
                  </td>
                  <td>
                    {humanize(r.reason)}
                    {r.note && <div className="small pre muted">“{r.note}”</div>}
                    {r.actionNote && <div className="small">{r.actionNote}</div>}
                  </td>
                  <td className="num small">{r.reporterMasked}</td>
                  <td className="small">{dateTime(r.createdAt)}</td>
                  <td>
                    {tab === 'OPEN' && (
                      <div className="row" style={{ justifyContent: 'flex-end' }}>
                        <Button size="sm" variant="text" onClick={() => setActing({ r, action: 'dismiss' })}>Dismiss</Button>
                        <Button size="sm" variant="secondary" onClick={() => setActing({ r, action: 'warn' })}>Warn</Button>
                        {r.listing && <Button size="sm" variant="secondary" onClick={() => setActing({ r, action: 'remove_item' })}>Remove item</Button>}
                        <Button size="sm" variant="danger-outline" onClick={() => setActing({ r, action: 'block_user' })}>Block</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {q.data && <Pager page={page} pageSize={25} total={q.data.total} onPage={setPage} />}
      </div>
      {acting && (
        <ConfirmDialog
          title={ACTION_LABEL[acting.action]}
          body={acting.action === 'block_user' ? <p>The person is signed out on every phone and all their items are hidden.</p> : undefined}
          reasonLabel={acting.action === 'warn' ? 'Message to the lister' : 'Note'}
          confirmLabel={ACTION_LABEL[acting.action]}
          danger={acting.action === 'block_user' || acting.action === 'remove_item'}
          onClose={() => setActing(null)}
          onConfirm={async (note) => {
            await api(`/admin/reports/${acting.r.id}/action`, { body: { action: acting.action, note } });
            toast('Done');
            void qc.invalidateQueries({ queryKey: ['reports'] });
            void qc.invalidateQueries({ queryKey: ['dashboard'] });
          }}
        />
      )}
    </>
  );
}
