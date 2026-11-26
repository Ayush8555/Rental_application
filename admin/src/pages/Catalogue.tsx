import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, qs } from '../lib/api';
import { count } from '../lib/format';
import { PageHead } from '../components/Layout';
import { Button, Checkbox, ConfirmDialog, Dialog, Empty, ErrorNote, Field, Input, Pill, Select, SkeletonRows, useToast } from '../components/ui';

interface City {
  id: string;
  name: string;
  nameHi: string | null;
  state: string;
  isOpen: boolean;
  lat: number;
  lng: number;
  liveItems: number;
  users: number;
  waitlist: number;
  areas: number;
}

function NewCity({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ name: '', nameHi: '', state: '', lat: '', lng: '' });
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  return (
    <Dialog title="Add city" onClose={onClose}>
      <div className="form-grid">
        <Field label="City">{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <Field label="City (Hindi)">{(id) => <Input id={id} value={f.nameHi} onChange={(e) => setF({ ...f, nameHi: e.target.value })} />}</Field>
        <Field label="State" className="full">{(id) => <Input id={id} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} />}</Field>
        <Field label="Latitude" help="City centre, from Google Maps">{(id) => <Input id={id} inputMode="decimal" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} />}</Field>
        <Field label="Longitude">{(id) => <Input id={id} inputMode="decimal" value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} />}</Field>
      </div>
      <p className="muted">New cities start closed. Open them once areas are added.</p>
      {error && <div className="notice notice-error">{error}</div>}
      <div className="dialog-actions">
        <Button variant="text" onClick={onClose}>Cancel</Button>
        <Button onClick={async () => {
          try {
            await api('/admin/cities', { body: { name: f.name.trim(), nameHi: f.nameHi.trim() || null, state: f.state.trim(), lat: Number(f.lat), lng: Number(f.lng) } });
            toast('City added');
            void qc.invalidateQueries({ queryKey: ['cities'] });
            onClose();
          } catch (e) { setError(e instanceof ApiError ? e.message : 'Failed'); }
        }}>Add city</Button>
      </div>
    </Dialog>
  );
}

function Areas({ city, onClose }: { city: City; onClose: () => void }) {
  const q = useQuery({ queryKey: ['areas', city.id], queryFn: () => api<{ items: Array<{ id: string; name: string; lat: number; lng: number; listings: number }> }>(`/admin/areas${qs({ cityId: city.id })}`) });
  const [f, setF] = useState({ name: '', lat: '', lng: '' });
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const add = async () => {
    setError(null);
    try {
      await api('/admin/areas', { body: { cityId: city.id, name: f.name.trim(), lat: Number(f.lat), lng: Number(f.lng) } });
      setF({ name: '', lat: '', lng: '' });
      void qc.invalidateQueries({ queryKey: ['areas', city.id] });
      void qc.invalidateQueries({ queryKey: ['cities'] });
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Failed'); }
  };
  return (
    <Dialog title={`Areas in ${city.name}`} onClose={onClose} wide>
      {q.isLoading ? <SkeletonRows rows={3} /> : (
        <table className="table">
          <thead><tr><th>Area</th><th className="right">Lat</th><th className="right">Lng</th><th className="right">Items</th></tr></thead>
          <tbody>
            {q.data?.items.map((a) => (
              <tr key={a.id}><td>{a.name}</td><td className="right num">{a.lat.toFixed(4)}</td><td className="right num">{a.lng.toFixed(4)}</td><td className="right num">{a.listings}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="row">
        <Input placeholder="Area name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="grow" />
        <Input placeholder="Lat" inputMode="decimal" value={f.lat} onChange={(e) => setF({ ...f, lat: e.target.value })} style={{ width: 110 }} />
        <Input placeholder="Lng" inputMode="decimal" value={f.lng} onChange={(e) => setF({ ...f, lng: e.target.value })} style={{ width: 110 }} />
        <Button onClick={add} disabled={!f.name || !f.lat || !f.lng}>Add</Button>
      </div>
      {error && <div className="notice notice-error">{error}</div>}
    </Dialog>
  );
}

export function CitiesPage() {
  const q = useQuery({ queryKey: ['cities'], queryFn: () => api<{ items: City[] }>('/admin/cities') });
  const [adding, setAdding] = useState(false);
  const [areas, setAreas] = useState<City | null>(null);
  const [toggling, setToggling] = useState<City | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  return (
    <>
      <PageHead title="Cities" sub="Closing a city hides its items and pauses plan days. Opening it brings everything back and tells the waitlist.">
        <Button onClick={() => setAdding(true)}>Add city</Button>
      </PageHead>
      {q.isError && <ErrorNote error={q.error} />}
      <div className="card card-tight">
        {q.isLoading ? <div style={{ padding: 16 }}><SkeletonRows /></div> : !q.data?.items.length ? <Empty title="No cities yet" /> : (
          <table className="table">
            <thead><tr><th>City</th><th>State</th><th className="right">Live items</th><th className="right">Users</th><th className="right">Waitlist</th><th className="right">Areas</th><th>Status</th><th /></tr></thead>
            <tbody>
              {q.data.items.map((c) => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong>{c.nameHi && <div className="muted">{c.nameHi}</div>}</td>
                  <td>{c.state}</td>
                  <td className="right num">{count(c.liveItems)}</td>
                  <td className="right num">{count(c.users)}</td>
                  <td className="right num">{count(c.waitlist)}</td>
                  <td className="right num">{c.areas}</td>
                  <td><Pill status={c.isOpen ? 'live' : 'hidden'} label={c.isOpen ? 'Open' : 'Coming soon'} /></td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      <Button size="sm" variant="text" onClick={() => setAreas(c)}>Areas</Button>
                      <Button size="sm" variant={c.isOpen ? 'danger-outline' : 'secondary'} onClick={() => setToggling(c)}>{c.isOpen ? 'Close' : 'Open'}</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {adding && <NewCity onClose={() => setAdding(false)} />}
      {areas && <Areas city={areas} onClose={() => setAreas(null)} />}
      {toggling && (
        <ConfirmDialog
          title={toggling.isOpen ? `Close ${toggling.name}?` : `Open ${toggling.name}?`}
          body={toggling.isOpen
            ? <p>{count(toggling.liveItems)} live items will be hidden within a minute, nobody can add new ones, and plan days stop counting. Nothing is deleted.</p>
            : <p>Items come back and {count(toggling.waitlist)} people on the waitlist get a notification.</p>}
          confirmLabel={toggling.isOpen ? 'Close city' : 'Open city'}
          danger={toggling.isOpen}
          onClose={() => setToggling(null)}
          onConfirm={async () => {
            await api(`/admin/cities/${toggling.id}`, { method: 'PATCH', body: { isOpen: !toggling.isOpen } });
            toast(toggling.isOpen ? 'City closed' : 'City opened');
            void qc.invalidateQueries({ queryKey: ['cities'] });
          }}
        />
      )}
    </>
  );
}

interface FieldDef { key: string; label: string; labelHi?: string; type: 'text' | 'number' | 'select'; options?: string[]; required?: boolean }
interface Category { id: string; name: string; nameHi: string; icon: string; sortOrder: number; isActive: boolean; fieldsSchema: FieldDef[]; listings: number }

function CategoryEditor({ cat, nextOrder, onClose }: { cat: Category | null; nextOrder: number; onClose: () => void }) {
  const [f, setF] = useState({ name: cat?.name ?? '', nameHi: cat?.nameHi ?? '', icon: cat?.icon ?? '', sortOrder: String(cat?.sortOrder ?? nextOrder), isActive: cat?.isActive ?? true });
  const [fields, setFields] = useState<FieldDef[]>(cat?.fieldsSchema ?? []);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const upd = (i: number, patch: Partial<FieldDef>) => setFields(fields.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const save = async () => {
    setError(null);
    try {
      const body = {
        name: f.name.trim(), nameHi: f.nameHi.trim(), icon: f.icon.trim(), sortOrder: Number(f.sortOrder), isActive: f.isActive,
        fieldsSchema: fields.map((x) => ({ ...x, key: x.key || x.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), options: x.type === 'select' ? x.options?.filter(Boolean) : undefined })),
      };
      await api(cat ? `/admin/categories/${cat.id}` : '/admin/categories', { method: cat ? 'PATCH' : 'POST', body });
      toast('Category saved');
      void qc.invalidateQueries({ queryKey: ['categories'] });
      onClose();
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Failed'); }
  };
  return (
    <Dialog title={cat ? `Edit ${cat.name}` : 'New category'} onClose={onClose} wide>
      <div className="form-grid">
        <Field label="Name (English)">{(id) => <Input id={id} value={f.name} maxLength={40} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <Field label="Name (Hindi)">{(id) => <Input id={id} value={f.nameHi} maxLength={40} onChange={(e) => setF({ ...f, nameHi: e.target.value })} />}</Field>
        <Field label="Icon" help="Phosphor icon name, e.g. camera, wrench, armchair">{(id) => <Input id={id} value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value.toLowerCase() })} />}</Field>
        <Field label="Order">{(id) => <Input id={id} inputMode="numeric" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value.replace(/\D/g, '') })} />}</Field>
        <div className="full"><Checkbox label="Shown in the app" checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} /></div>
      </div>
      <div className="stack">
        <h3>Extra fields</h3>
        <p className="muted">Asked when someone lists in this category, e.g. Vehicles: model, year, fuel.</p>
        {fields.map((x, i) => (
          <div key={i} className="row">
            <Input placeholder="Label" value={x.label} onChange={(e) => upd(i, { label: e.target.value })} style={{ width: 160 }} />
            <Input placeholder="Hindi label" value={x.labelHi ?? ''} onChange={(e) => upd(i, { labelHi: e.target.value })} style={{ width: 140 }} />
            <Select value={x.type} onChange={(e) => upd(i, { type: e.target.value as FieldDef['type'] })} style={{ width: 120 }} aria-label="Type">
              <option value="text">Text</option><option value="number">Number</option><option value="select">Choice</option>
            </Select>
            {x.type === 'select' && <Input placeholder="Choices, comma separated" value={(x.options ?? []).join(', ')} onChange={(e) => upd(i, { options: e.target.value.split(',').map((s) => s.trim()) })} className="grow" />}
            <Checkbox label="Required" checked={!!x.required} onChange={(v) => upd(i, { required: v })} />
            <Button size="sm" variant="text" onClick={() => setFields(fields.filter((_, j) => j !== i))}>Remove</Button>
          </div>
        ))}
        {fields.length < 12 && <Button size="sm" variant="secondary" onClick={() => setFields([...fields, { key: '', label: '', type: 'text' }])}>Add field</Button>}
      </div>
      {error && <div className="notice notice-error">{error}</div>}
      <div className="dialog-actions">
        <Button variant="text" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={!f.name || !f.nameHi || !f.icon}>Save</Button>
      </div>
    </Dialog>
  );
}

export function CategoriesPage() {
  const q = useQuery({ queryKey: ['categories'], queryFn: () => api<{ items: Category[] }>('/admin/categories') });
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const items = q.data?.items ?? [];
  return (
    <>
      <PageHead title="Categories" sub="Changes show in the app the next time it refreshes.">
        <Button onClick={() => setEditing('new')}>New category</Button>
      </PageHead>
      {q.isError && <ErrorNote error={q.error} />}
      <div className="card card-tight">
        {q.isLoading ? <div style={{ padding: 16 }}><SkeletonRows /></div> : !items.length ? <Empty title="No categories yet" /> : (
          <table className="table">
            <thead><tr><th className="right">Order</th><th>Name</th><th>Hindi</th><th>Icon</th><th>Extra fields</th><th className="right">Items</th><th>Shown</th><th /></tr></thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td className="right num">{c.sortOrder}</td>
                  <td><strong>{c.name}</strong></td>
                  <td>{c.nameHi}</td>
                  <td className="muted">{c.icon}</td>
                  <td className="small">{c.fieldsSchema.map((x) => x.label).join(', ') || '—'}</td>
                  <td className="right num">{c.listings}</td>
                  <td><Pill status={c.isActive ? 'live' : 'hidden'} label={c.isActive ? 'Yes' : 'No'} /></td>
                  <td><Button size="sm" variant="text" onClick={() => setEditing(c)}>Edit</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {editing && <CategoryEditor cat={editing === 'new' ? null : editing} nextOrder={(items.at(-1)?.sortOrder ?? 0) + 1} onClose={() => setEditing(null)} />}
    </>
  );
}
