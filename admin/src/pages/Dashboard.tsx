import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api, qs } from '../lib/api';
import { count, dateTime, humanize, rupees } from '../lib/format';
import { PageHead } from '../components/Layout';
import { ErrorNote, Select, SkeletonRows } from '../components/ui';

interface Dashboard {
  users: number;
  activeListers: number;
  liveItems: number;
  pendingPayments: number;
  pendingReview: number;
  openReports: number;
  revenueThisMonthPaise: number;
  revenueTrend: Array<{ day: string; paise: number }>;
  recent: Array<{ action: string; entity: string; createdAt: string }>;
}

export function useCities() {
  return useQuery({ queryKey: ['cities'], queryFn: () => api<{ items: Array<{ id: string; name: string; state: string; isOpen: boolean }> }>('/admin/cities') });
}

export function DashboardPage() {
  const [cityId, setCityId] = useState('');
  const cities = useCities();
  const q = useQuery({ queryKey: ['dashboard', cityId], queryFn: () => api<Dashboard>(`/admin/dashboard${qs({ cityId })}`) });
  const d = q.data;
  const max = Math.max(1, ...(d?.revenueTrend.map((t) => t.paise) ?? [1]));

  return (
    <>
      <PageHead title="Dashboard" sub="Today at a glance">
        <Select value={cityId} onChange={(e) => setCityId(e.target.value)} aria-label="City" style={{ width: 200 }}>
          <option value="">All cities</option>
          {cities.data?.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </PageHead>
      {q.isError && <ErrorNote error={q.error} onRetry={() => q.refetch()} />}
      {!d ? (
        <SkeletonRows rows={3} height={80} />
      ) : (
        <div className="stack-lg">
          <div className="cards">
            <Link to="/payments" className={`card stat ${d.pendingPayments ? 'alert' : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="label">Payments to check</div>
              <div className="value">{count(d.pendingPayments)}</div>
            </Link>
            <Link to="/listings" className={`card stat ${d.pendingReview ? 'alert' : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="label">Items to review</div>
              <div className="value">{count(d.pendingReview)}</div>
            </Link>
            <Link to="/reports" className={`card stat ${d.openReports ? 'alert' : ''}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="label">Open reports</div>
              <div className="value">{count(d.openReports)}</div>
            </Link>
            <div className="card stat">
              <div className="label">Revenue this month</div>
              <div className="value">{rupees(d.revenueThisMonthPaise)}</div>
            </div>
          </div>
          <div className="cards">
            <div className="card stat">
              <div className="label">Active users</div>
              <div className="value">{count(d.users)}</div>
            </div>
            <div className="card stat">
              <div className="label">Listers with a plan</div>
              <div className="value">{count(d.activeListers)}</div>
            </div>
            <div className="card stat">
              <div className="label">Live items</div>
              <div className="value">{count(d.liveItems)}</div>
            </div>
          </div>
          <div className="split">
            <div className="card stack">
              <h3>Approved payments, last 30 days</h3>
              {d.revenueTrend.length ? (
                <div className="bars" role="img" aria-label="Revenue per day">
                  {d.revenueTrend.map((t) => (
                    <div key={t.day} title={`${t.day}: ${rupees(t.paise)}`} style={{ height: `${(t.paise / max) * 100}%` }} />
                  ))}
                </div>
              ) : (
                <p className="muted">No approved payments in the last 30 days.</p>
              )}
            </div>
            <div className="card stack">
              <h3>Recent admin activity</h3>
              {d.recent.length ? (
                d.recent.map((r, i) => (
                  <div key={i} className="row-between small">
                    <span>{humanize(r.action.replace('.', ' '))}</span>
                    <span className="muted">{dateTime(r.createdAt)}</span>
                  </div>
                ))
              ) : (
                <p className="muted">Nothing yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
