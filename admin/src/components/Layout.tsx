import { NavLink, Outlet } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ChartBar, CurrencyInr, ClipboardText, Tag, Ticket, Package, Flag, Users, MapPin, SquaresFour, Megaphone,
  ChartLineUp, Gear, IdentificationCard, UserGear, ListChecks, SignOut, Key,
} from '@phosphor-icons/react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Counts {
  pendingPayments: number;
  pendingReview: number;
  openReports: number;
}

function Item({ to, icon, label, badge }: { to: string; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <NavLink to={to} end={to === '/'}>
      {icon}
      <span>{label}</span>
      {badge ? <span className="badge num">{badge > 99 ? '99+' : badge}</span> : null}
    </NavLink>
  );
}

export function Layout() {
  const { admin, isSuper, refresh } = useAuth();
  const counts = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Counts>('/admin/dashboard'), refetchInterval: 60_000 });
  const c = counts.data;
  const icon = { size: 18 } as const;

  const logout = async () => {
    await api('/admin/auth/logout', { body: {} }).catch(() => undefined);
    await refresh();
  };

  return (
    <div className="shell">
      <nav className="side" aria-label="Main">
        <div className="brand">RentNook Admin</div>
        <Item to="/" icon={<ChartBar {...icon} />} label="Dashboard" />
        <div className="group">Money</div>
        <Item to="/payments" icon={<CurrencyInr {...icon} />} label="Payments" badge={c?.pendingPayments} />
        <Item to="/plan-requests" icon={<ListChecks {...icon} />} label="Free plan requests" />
        <Item to="/plans" icon={<Tag {...icon} />} label="Plans" />
        <Item to="/coupons" icon={<Ticket {...icon} />} label="Coupons" />
        <div className="group">Marketplace</div>
        <Item to="/listings" icon={<Package {...icon} />} label="Listings" badge={c?.pendingReview} />
        <Item to="/reports" icon={<Flag {...icon} />} label="Reports" badge={c?.openReports} />
        <Item to="/users" icon={<Users {...icon} />} label="Users" />
        <Item to="/cities" icon={<MapPin {...icon} />} label="Cities" />
        <Item to="/categories" icon={<SquaresFour {...icon} />} label="Categories" />
        <div className="group">Grow</div>
        <Item to="/push" icon={<Megaphone {...icon} />} label="Push messages" />
        <Item to="/insights" icon={<ChartLineUp {...icon} />} label="Insights" />
        <div className="group">Settings</div>
        <Item to="/settings" icon={<Gear {...icon} />} label="Settings" />
        {isSuper && <Item to="/id-verifications" icon={<IdentificationCard {...icon} />} label="ID checks" />}
        {isSuper && <Item to="/admins" icon={<UserGear {...icon} />} label="Staff" />}
        {isSuper && <Item to="/audit" icon={<ClipboardText {...icon} />} label="Audit log" />}
        <Item to="/sessions" icon={<Key {...icon} />} label="My sessions" />
        <div className="foot stack">
          <span>
            {admin?.name}
            <br />
            {admin?.role === 'SUPER_ADMIN' ? 'Super admin' : 'Admin'}
          </span>
          <button className="btn btn-text btn-sm" style={{ color: '#d8e0ea', justifyContent: 'flex-start', padding: 0 }} onClick={logout}>
            <SignOut size={16} /> Sign out
          </button>
        </div>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}
