import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router';
import '@fontsource/noto-sans/400.css';
import '@fontsource/noto-sans/600.css';
import '@fontsource/noto-sans/700.css';
import '@fontsource/sora/600.css';
import '@fontsource/sora/700.css';
import './styles.css';
import { AuthProvider, useAuth } from './lib/auth';
import { ApiError } from './lib/api';
import { ToastProvider } from './components/ui';
import { Layout } from './components/Layout';
import { AcceptInvitePage, LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { PaymentsPage } from './pages/Payments';
import { PlanRequestsPage, PlansPage } from './pages/Plans';
import { CouponsPage } from './pages/Coupons';
import { ListingsPage } from './pages/Listings';
import { ReportsPage } from './pages/Reports';
import { UserDetailPage, UsersPage } from './pages/Users';
import { CategoriesPage, CitiesPage } from './pages/Catalogue';
import { PushPage } from './pages/Push';
import { InsightsPage } from './pages/Insights';
import { SettingsPage } from './pages/Settings';
import { IdVerificationsPage } from './pages/IdVerifications';
import { AdminsPage, AuditPage, SessionsPage } from './pages/Staff';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
      refetchOnWindowFocus: true,
    },
  },
});

function Guard() {
  const { stage } = useAuth();
  const loc = useLocation();
  if (stage === 'loading') return <div className="login-wrap"><div className="spinner" /></div>;
  if (stage !== 'ready') return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <Layout />;
}

function SuperOnly() {
  const { isSuper } = useAuth();
  return isSuper ? <Outlet /> : <Navigate to="/" replace />;
}

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/accept-invite', element: <AcceptInvitePage /> },
  {
    path: '/',
    element: <Guard />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'payments', element: <PaymentsPage /> },
      { path: 'plan-requests', element: <PlanRequestsPage /> },
      { path: 'plans', element: <PlansPage /> },
      { path: 'coupons', element: <CouponsPage /> },
      { path: 'listings', element: <ListingsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'users/:id', element: <UserDetailPage /> },
      { path: 'cities', element: <CitiesPage /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'push', element: <PushPage /> },
      { path: 'insights', element: <InsightsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'sessions', element: <SessionsPage /> },
      {
        element: <SuperOnly />,
        children: [
          { path: 'id-verifications', element: <IdVerificationsPage /> },
          { path: 'admins', element: <AdminsPage /> },
          { path: 'audit', element: <AuditPage /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
