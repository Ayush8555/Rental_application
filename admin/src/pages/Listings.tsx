import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { WarningCircle } from '@phosphor-icons/react';
import { api, qs } from '../lib/api';
import { ago, count, date, humanize, rentLine, rupees } from '../lib/format';
import { PageHead } from '../components/Layout';
import { Button, Checkbox, ConfirmDialog, Empty, ErrorNote, Input, Pager, Pill, Select, SkeletonRows, Tabs, Thumbs, useToast } from '../components/ui';
import { useCities } from './Dashboard';

interface AdminListing {
  id: string;
  shortId: string;
  title: string;
  description: string;
  status: string;
  hiddenReason: string | null;
  rejectReason: string | null;
  category: string;
  place: string;
  rentDayPaise: number | null;
  rentWeekPaise: number | null;
  rentMonthPaise: number | null;
  depositPaise: number | null;
  flags: string[];
  reportCount: number;
  viewCount: number;
  waClickCount: number;
  photos: string[];
  lister: { id: string; name: string | null; phoneMasked: string; since: string; verified: boolean };
  updatedAt: string;
}

type Tab = 'review' | 'all' | 'hidden';
type Action = 'approve' | 'reject' | 'hide' | 'remove' | 'restore';

const FLAG_TEXT: Record<string, string> = {
  SCAM_WORDS: 'Scam words in text',
  PRICE_OUTLIER: 'Price very different from similar items',
  DUPLICATE_PHOTO: 'Photo used by another lister',
};

export function ListingsPage() {
  const [tab, setTab] = useState<Tab>('review');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [cityId, setCityId] = useState('');
  const [acting, setActing] = useState<{ l: AdminListing; action: Action } | null>(null);
  const cities = useCities();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({
    queryKey: ['listings', tab, page, search, cityId],
    queryFn: () => api<{ items: AdminListing[]; total: number }>(`/admin/listings${qs({ tab, page, q: search || undefined, cityId: cityId || undefined })}`),
  });
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<{ values: { moderation: { reviewNewItems: boolean } } }>('/admin/settings') });
  const moderationOn = settings.data?.values.moderation.reviewNewItems ?? false;

  const run = async (l: AdminListing, action: Action, reason?: string) => {
    await api(`/admin/listings/${l.id}/action`, { body: { action, ...(reason ? { reason } : {}) } });
    toast(`${humanize(action)}d: ${l.title}`);
    void qc.invalidateQueries({ queryKey: ['listings'] });
    void qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const toggleModeration = async (v: boolean) => {
    await api('/admin/settings/moderation', { method: 'PUT', body: { reviewNewItems: v } });
    void qc.invalidateQueries({ queryKey: ['settings'] });
    toast(v ? 'New items now wait for review' : 'New items go live straight away');
  };

  return (
    <>
      <PageHead title="Listings" sub="Text written by listers is always shown as plain text here.">
        <Checkbox label="Review new items before they go live" checked={moderationOn} onChange={toggleModeration} />
      </PageHead>
      <Tabs value={tab} onChange={(t) => { setTab(t); setPage(1); }} items={[{ value: 'review', label: 'Review queue' }, { value: 'all', label: 'All items' }, { value: 'hidden', label: 'Hidden' }]} />
      <div className="row" style={{ marginBottom: 'var(--s4)' }}>
        <Input placeholder="Search title" value={search} maxLength={60} onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ maxWidth: 320 }} />
        <Select value={cityId} onChange={(e) => { setCityId(e.target.value); setPage(1); }} style={{ width: 200 }} aria-label="City">
          <option value="">All cities</option>
          {cities.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>
      {q.isError && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {q.isLoading ? (
        <SkeletonRows rows={3} height={150} />
      ) : !q.data?.items.length ? (
        <div className="card"><Empty title={tab === 'review' ? 'Review queue is empty' : 'No items'}>{tab === 'review' && !moderationOn ? 'Only flagged items come here while review is off.' : undefined}</Empty></div>
      ) : (
        <div className="stack">
          {q.data.items.map((l) => (
            <div key={l.id} className="card review-card">
              <Thumbs urls={l.photos} />
              <div className="stack">
                <div className="row">
                  <Pill status={l.status} />
                  {l.hiddenReason && <span className="muted">{humanize(l.hiddenReason)}</span>}
                  <span className="muted">{l.category} · {l.place}</span>
                </div>
                {/* Plain text children only; React escapes them. */}
                <h3>{l.title}</h3>
                <p className="small pre">{l.description}</p>
                <p className="num"><strong>{rentLine(l)}</strong>{l.depositPaise ? <span className="muted"> · deposit {rupees(l.depositPaise)}</span> : null}</p>
                {l.flags.map((f) => (
                  <span key={f} className="flag"><WarningCircle size={14} /> {FLAG_TEXT[f] ?? humanize(f)}</span>
                ))}
                {l.reportCount > 0 && <span className="flag"><WarningCircle size={14} /> {l.reportCount} report{l.reportCount > 1 ? 's' : ''}</span>}
                {l.rejectReason && <p className="small danger-text">Last note: {l.rejectReason}</p>}
              </div>
              <div className="stack">
                <div className="small">
                  <Link to={`/users/${l.lister.id}`}>{l.lister.name ?? 'No name'}</Link>
                  {l.lister.verified && <span className="muted"> · ID verified</span>}
                  <div className="muted num">{l.lister.phoneMasked}</div>
                  <div className="muted">Joined {date(l.lister.since)}</div>
                  <div className="muted">{count(l.viewCount)} views · {count(l.waClickCount)} chats · edited {ago(l.updatedAt)}</div>
                </div>
                {l.status === 'REVIEW' && (
                  <>
                    <Button size="sm" onClick={() => run(l, 'approve').catch((e: Error) => toast(e.message, { error: true }))}>Approve</Button>
                    <Button size="sm" variant="secondary" onClick={() => setActing({ l, action: 'reject' })}>Send back</Button>
                  </>
                )}
                {l.status === 'HIDDEN' && <Button size="sm" variant="secondary" onClick={() => run(l, 'restore').catch((e: Error) => toast(e.message, { error: true }))}>Restore</Button>}
                {['LIVE', 'RENTED_OUT', 'REVIEW'].includes(l.status) && <Button size="sm" variant="secondary" onClick={() => setActing({ l, action: 'hide' })}>Hide</Button>}
                {l.status !== 'REMOVED' && <Button size="sm" variant="danger-outline" onClick={() => setActing({ l, action: 'remove' })}>Remove</Button>}
              </div>
            </div>
          ))}
          <Pager page={page} pageSize={25} total={q.data.total} onPage={setPage} />
        </div>
      )}
      {acting && (
        <ConfirmDialog
          title={acting.action === 'reject' ? 'Send back to the lister' : acting.action === 'hide' ? 'Hide this item' : 'Remove this item'}
          body={<p>“{acting.l.title}” — the lister sees this reason.</p>}
          reasonLabel="Reason"
          reasons={acting.action === 'reject' ? ['Photos are not of the real item', 'Price looks wrong', 'Not allowed on RentNook', 'Please add more details'] : ['Reported as a scam', 'Banned item', 'Fake or copied photos']}
          confirmLabel={acting.action === 'reject' ? 'Send back' : humanize(acting.action)}
          danger={acting.action === 'remove'}
          onClose={() => setActing(null)}
          onConfirm={(reason) => run(acting.l, acting.action, reason)}
        />
      )}
    </>
  );
}
