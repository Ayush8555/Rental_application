import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { count, dateTime } from '../lib/format';
import { PageHead } from '../components/Layout';
import { Button, ConfirmDialog, Empty, Field, Input, Pill, Select, SkeletonRows, Textarea, useToast } from '../components/ui';
import { useCities } from './Dashboard';

interface Broadcast { id: string; audience: string; title: string; body: string; targetCount: number; sentCount: number; status: string; createdAt: string }

export function PushPage() {
  const [audience, setAudience] = useState<'all' | 'city' | 'listers'>('all');
  const [cityId, setCityId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [size, setSize] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const cities = useCities();
  const qc = useQueryClient();
  const toast = useToast();
  const history = useQuery({ queryKey: ['push'], queryFn: () => api<{ items: Broadcast[] }>('/admin/push') });
  const ready = title.trim().length >= 3 && body.trim().length >= 3 && (audience !== 'city' || !!cityId);

  useEffect(() => {
    if (audience === 'city' && !cityId) return setSize(null);
    let live = true;
    api<{ audienceSize: number }>('/admin/push/preview', { body: { audience, cityId: cityId || null } })
      .then((r) => live && setSize(r.audienceSize))
      .catch(() => live && setSize(null));
    return () => { live = false; };
  }, [audience, cityId]);

  return (
    <>
      <PageHead title="Push messages" sub="Up to 3 a day. Keep it useful; people turn off apps that send too much." />
      <div className="split">
        <div className="card stack-lg">
          <div className="form-grid">
            <Field label="Send to">
              {(id) => (
                <Select id={id} value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
                  <option value="all">Everyone</option>
                  <option value="city">One city</option>
                  <option value="listers">Listers only</option>
                </Select>
              )}
            </Field>
            {audience !== 'all' && (
              <Field label={audience === 'listers' ? 'City (optional)' : 'City'}>
                {(id) => (
                  <Select id={id} value={cityId} onChange={(e) => setCityId(e.target.value)}>
                    <option value="">{audience === 'listers' ? 'All cities' : 'Choose…'}</option>
                    {cities.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                )}
              </Field>
            )}
            <Field label="Title" help={`${title.length}/60`} className="full">{(id) => <Input id={id} value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />}</Field>
            <Field label="Message" help={`${body.length}/160`} className="full">{(id) => <Textarea id={id} value={body} maxLength={160} rows={3} onChange={(e) => setBody(e.target.value)} />}</Field>
          </div>
          <div className="row-between">
            <span className="muted">{size === null ? '' : `${count(size)} people with notifications on`}</span>
            <Button disabled={!ready} onClick={() => setConfirm(true)}>Send</Button>
          </div>
        </div>
        <div className="card stack">
          <span className="muted">Preview</span>
          <div className="card stack" style={{ background: 'var(--background)' }}>
            <strong className="small">RentNook · now</strong>
            <strong>{title || 'Title'}</strong>
            <span className="small">{body || 'Message text'}</span>
          </div>
        </div>
      </div>
      <h2 style={{ margin: 'var(--s6) 0 var(--s3)' }}>Sent</h2>
      <div className="card card-tight">
        {history.isLoading ? <div style={{ padding: 16 }}><SkeletonRows rows={3} /></div> : !history.data?.items.length ? <Empty title="Nothing sent yet" /> : (
          <table className="table">
            <thead><tr><th>When</th><th>To</th><th>Message</th><th className="right">Sent</th><th>Status</th></tr></thead>
            <tbody>
              {history.data.items.map((b) => (
                <tr key={b.id}><td className="small">{dateTime(b.createdAt)}</td><td>{b.audience}</td><td><strong>{b.title}</strong><div className="small muted">{b.body}</div></td><td className="right num">{count(b.sentCount)} / {count(b.targetCount)}</td><td><Pill status={b.status === 'DONE' ? 'live' : 'pending'} label={b.status.toLowerCase()} /></td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {confirm && (
        <ConfirmDialog
          title={`Send to ${size === null ? '' : count(size)} people?`}
          body={<p>“{title}” — this cannot be taken back.</p>}
          confirmLabel="Send now"
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            await api('/admin/push', { body: { audience, cityId: cityId || null, title: title.trim(), body: body.trim() } });
            toast('Message queued');
            setTitle('');
            setBody('');
            void qc.invalidateQueries({ queryKey: ['push'] });
          }}
        />
      )}
    </>
  );
}
