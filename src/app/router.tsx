import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './shell';

// Today stays in the initial chunk; every other route loads when it is first visited
import { TodayPage } from '@/routes/today/page';
import { RouteErrorPage } from '@/routes/error-page';

// Code-split routes per Section 19.4
const TasksPage = lazy(() => import('@/routes/tasks/page').then((m) => ({ default: m.TasksPage })));
const TaskDetailPage = lazy(() => import('@/routes/tasks/detail').then((m) => ({ default: m.TaskDetailPage })));
const ClientsPage = lazy(() => import('@/routes/clients/page').then((m) => ({ default: m.ClientsPage })));
const ClientDetailPage = lazy(() => import('@/routes/clients/detail').then((m) => ({ default: m.ClientDetailPage })));
const ClientImportPage = lazy(() => import('@/routes/clients/import').then((m) => ({ default: m.ClientImportPage })));
const FollowUpsPage = lazy(() => import('@/routes/follow-ups/page').then((m) => ({ default: m.FollowUpsPage })));
const FollowUpsRunPage = lazy(() => import('@/routes/follow-ups/run').then((m) => ({ default: m.FollowUpsRunPage })));
const VisitsPage = lazy(() => import('@/routes/visits/page').then((m) => ({ default: m.VisitsPage })));
const VisitDetailPage = lazy(() => import('@/routes/visits/detail').then((m) => ({ default: m.VisitDetailPage })));
const VisitRecordPage = lazy(() => import('@/routes/visits/record').then((m) => ({ default: m.VisitRecordPage })));
const VisitSummaryPage = lazy(() => import('@/routes/visits/summary').then((m) => ({ default: m.VisitSummaryPage })));
const VisitPrintPage = lazy(() => import('@/routes/visits/print').then((m) => ({ default: m.VisitPrintPage })));
const PaymentsPage = lazy(() => import('@/routes/payments/page').then((m) => ({ default: m.PaymentsPage })));
const OfficesPage = lazy(() => import('@/routes/offices/page').then((m) => ({ default: m.OfficesPage })));
const NotificationsPage = lazy(() => import('@/routes/notifications/page').then((m) => ({ default: m.NotificationsPage })));
const SearchPage = lazy(() => import('@/routes/search/page').then((m) => ({ default: m.SearchPage })));
const NotFoundPage = lazy(() => import('@/routes/not-found').then((m) => ({ default: m.NotFoundPage })));
const SignInPage = lazy(() => import('@/routes/sign-in/page').then((m) => ({ default: m.SignInPage })));
const AccessPendingPage = lazy(() => import('@/routes/access-pending/page').then((m) => ({ default: m.AccessPendingPage })));
const WelcomePage = lazy(() => import('@/routes/welcome/page').then((m) => ({ default: m.WelcomePage })));
const CalendarPage = lazy(() => import('@/routes/calendar/page').then(m => ({ default: m.CalendarPage })));
const DocumentsPage = lazy(() => import('@/routes/documents/page').then(m => ({ default: m.DocumentsPage })));
const InsightsPage = lazy(() => import('@/routes/insights/page').then(m => ({ default: m.InsightsPage })));
const ReportsPage = lazy(() => import('@/routes/reports/page').then(m => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('@/routes/settings/page').then(m => ({ default: m.SettingsPage })));
const AuditPage = lazy(() => import('@/routes/audit/page').then(m => ({ default: m.AuditPage })));
const HelpPage = lazy(() => import('@/routes/help/page').then(m => ({ default: m.HelpPage })));
const DevTokensPage = lazy(() => import('@/routes/dev/tokens').then(m => ({ default: m.DevTokensPage })));
const DevStatesPage = lazy(() => import('@/routes/dev/states').then(m => ({ default: m.DevStatesPage })));

function RouteSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center" role="status" aria-label="Loading view">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand-green border-t-transparent mb-2" />
          <div className="text-xs text-ink-3">Loading view...</div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/sign-in',
    element: <RouteSuspense><SignInPage /></RouteSuspense>,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/access-pending',
    element: <RouteSuspense><AccessPendingPage /></RouteSuspense>,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/welcome',
    element: <RouteSuspense><WelcomePage /></RouteSuspense>,
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'tasks', element: <RouteSuspense><TasksPage /></RouteSuspense> },
      { path: 'tasks/:taskId', element: <RouteSuspense><TaskDetailPage /></RouteSuspense> },
      { path: 'clients', element: <RouteSuspense><ClientsPage /></RouteSuspense> },
      { path: 'clients/import', element: <RouteSuspense><ClientImportPage /></RouteSuspense> },
      { path: 'clients/:clientId', element: <RouteSuspense><ClientDetailPage /></RouteSuspense> },
      { path: 'follow-ups', element: <RouteSuspense><FollowUpsPage /></RouteSuspense> },
      { path: 'follow-ups/run', element: <RouteSuspense><FollowUpsRunPage /></RouteSuspense> },
      { path: 'visits', element: <RouteSuspense><VisitsPage /></RouteSuspense> },
      { path: 'visits/:visitId', element: <RouteSuspense><VisitDetailPage /></RouteSuspense> },
      { path: 'visits/:visitId/record', element: <RouteSuspense><VisitRecordPage /></RouteSuspense> },
      { path: 'visits/:visitId/summary', element: <RouteSuspense><VisitSummaryPage /></RouteSuspense> },
      { path: 'visits/:visitId/print', element: <RouteSuspense><VisitPrintPage /></RouteSuspense> },
      { path: 'calendar', element: <RouteSuspense><CalendarPage /></RouteSuspense> },
      { path: 'documents', element: <RouteSuspense><DocumentsPage /></RouteSuspense> },
      { path: 'payments', element: <RouteSuspense><PaymentsPage /></RouteSuspense> },
      { path: 'offices', element: <RouteSuspense><OfficesPage /></RouteSuspense> },
      { path: 'offices/:officeId', element: <RouteSuspense><OfficesPage /></RouteSuspense> },
      { path: 'insights', element: <RouteSuspense><InsightsPage /></RouteSuspense> },
      { path: 'reports', element: <RouteSuspense><ReportsPage /></RouteSuspense> },
      { path: 'notifications', element: <RouteSuspense><NotificationsPage /></RouteSuspense> },
      { path: 'search', element: <RouteSuspense><SearchPage /></RouteSuspense> },
      { path: 'settings', element: <RouteSuspense><SettingsPage /></RouteSuspense> },
      { path: 'settings/*', element: <RouteSuspense><SettingsPage /></RouteSuspense> },
      { path: 'admin', element: <Navigate to="/settings/users" replace /> },
      { path: 'admin/users', element: <Navigate to="/settings/users" replace /> },
      { path: 'audit', element: <RouteSuspense><AuditPage /></RouteSuspense> },
      { path: 'help', element: <RouteSuspense><HelpPage /></RouteSuspense> },
      { path: 'dev/tokens', element: <RouteSuspense><DevTokensPage /></RouteSuspense> },
      { path: 'dev/states', element: <RouteSuspense><DevStatesPage /></RouteSuspense> },
      { path: '*', element: <RouteSuspense><NotFoundPage /></RouteSuspense> },
    ],
  },
]);
