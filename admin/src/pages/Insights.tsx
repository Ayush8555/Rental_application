import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, qs } from '../lib/api';
import { count, rupees } from '../lib/format';
import { PageHead } from '../components/Layout';
import { Button, Empty, ErrorNote, Select, SkeletonRows } from '../components/ui';
import { useCities } from './Dashboard';

interface Insights {
  topSearches: Array<{ query: string; count: number; avgResults: number }>;
  zeroResults: Array<{ query: string; count: number }>;
  categories: Array<{ name: string; live: number; searches: number }>;
  cities: Array<{ name: string; live: number; users: number; searches: number }>;
  planRevenue: Array<{ plan: string; count: number; paise: number }>;
}

function Bars({ rows }: { rows: Array<{ label: string; value: number; extra?: string }> }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="muted">No data yet.</p>;
  return (
    <div className="stack">
      {rows.map((r) => (
        <div key={r.label} className="hbar">
          <span title={r.label} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
          <div className="track"><div className="fill" style={{ width: `${(r.value / max) * 100}%` }} /></div>
          <span className="num right">{r.extra ?? count(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function InsightsPage() {
  const [days, setDays] = useState(30);
  const [cityId, setCityId] = useState('');
  const cities = useCities();
  const q = useQuery({ queryKey: ['insights', days, cityId], queryFn: () => api<Insights>(`/admin/insights${qs({ days, cityId: cityId || undefined })}`) });
  const exportCsv = () => {
    // Plain link; the session cookie authorises it. Aggregates only, no personal data.
    window.location.href = `${import.meta.env.VITE_API_URL ?? ''}/admin/insights${qs({ days, cityId: cityId || undefined, format: 'csv' })}`;
  };
  const d = q.data;
  return (
    <>
      <PageHead title="Insights" sub="What people look for, and what they cannot find.">
        <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value))} style={{ width: 140 }} aria-label="Period">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </Select>
        <Select value={cityId} onChange={(e) => setCityId(e.target.value)} style={{ width: 170 }} aria-label="City">
          <option value="">All cities</option>
          {cities.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Button variant="secondary" onClick={exportCsv}>Download CSV</Button>
      </PageHead>
      {q.isError && <ErrorNote error={q.error} />}
      {!d ? <SkeletonRows rows={4} height={120} /> : (
        <div className="stack-lg">
          <div className="split" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="card stack"><h3>Top searches</h3><Bars rows={d.topSearches.slice(0, 12).map((t) => ({ label: t.query, value: t.count }))} /></div>
            <div className="card stack">
              <h3>Searches with no results</h3>
              <p className="muted">Good ideas for listers, and for "Request an item" pushes.</p>
              {d.zeroResults.length ? <Bars rows={d.zeroResults.slice(0, 12).map((t) => ({ label: t.query, value: t.count }))} /> : <Empty title="Nothing missing" />}
            </div>
          </div>
          <div className="split" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="card stack"><h3>Categories: live items</h3><Bars rows={d.categories.map((c) => ({ label: c.name, value: c.live, extra: `${count(c.live)} · ${count(c.searches)} searches` }))} /></div>
            <div className="card stack"><h3>Cities: live items</h3><Bars rows={d.cities.map((c) => ({ label: c.name, value: c.live, extra: `${count(c.live)} · ${count(c.users)} users` }))} /></div>
          </div>
          <div className="card stack"><h3>Plan revenue</h3><Bars rows={d.planRevenue.map((p) => ({ label: p.plan, value: p.paise, extra: `${rupees(p.paise)} · ${p.count}` }))} /></div>
        </div>
      )}
    </>
  );
}
