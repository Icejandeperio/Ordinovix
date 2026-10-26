import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from './shell';

// Core routes kept in initial chunk
import { TodayPage } from '@/routes/today/page';
import { TasksPage } from '@/routes/tasks/page';
import { TaskDetailPage } from '@/routes/tasks/detail';
import { ClientsPage } from '@/routes/clients/page';
import { ClientDetailPage } from '@/routes/clients/detail';
import { ClientImportPage } from '@/routes/clients/import';
import { FollowUpsPage } from '@/routes/follow-ups/page';
import { FollowUpsRunPage } from '@/routes/follow-ups/run';
import { VisitsPage } from '@/routes/visits/page';
import { VisitDetailPage } from '@/routes/visits/detail';
import { VisitRecordPage } from '@/routes/visits/record';
import { VisitSummaryPage } from '@/routes/visits/summary';
import { VisitPrintPage } from '@/routes/visits/print';
import { PaymentsPage } from '@/routes/payments/page';
import { OfficesPage } from '@/routes/offices/page';
import { NotificationsPage } from '@/routes/notifications/page';
import { SearchPage } from '@/routes/search/page';
import { NotFoundPage } from '@/routes/not-found';
import { SignInPage } from '@/routes/sign-in/page';
import { AccessPendingPage } from '@/routes/access-pending/page';
import { WelcomePage } from '@/routes/welcome/page';

// Code-split routes per Section 19.4
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
    element: <SignInPage />,
    errorElement: <NotFoundPage />,
  },
  {
    path: '/access-pending',
    element: <AccessPendingPage />,
    errorElement: <NotFoundPage />,
  },
  {
    path: '/welcome',
    element: <WelcomePage />,
    errorElement: <NotFoundPage />,
  },
  {
    path: '/',
    element: <AppShell />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <TodayPage /> },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'tasks/:taskId', element: <TaskDetailPage /> },
      { path: 'clients', element: <ClientsPage /> },
      { path: 'clients/import', element: <ClientImportPage /> },
      { path: 'clients/:clientId', element: <ClientDetailPage /> },
      { path: 'follow-ups', element: <FollowUpsPage /> },
      { path: 'follow-ups/run', element: <FollowUpsRunPage /> },
      { path: 'visits', element: <VisitsPage /> },
      { path: 'visits/:visitId', element: <VisitDetailPage /> },
      { path: 'visits/:visitId/record', element: <VisitRecordPage /> },
      { path: 'visits/:visitId/summary', element: <VisitSummaryPage /> },
      { path: 'visits/:visitId/print', element: <VisitPrintPage /> },
      { path: 'calendar', element: <RouteSuspense><CalendarPage /></RouteSuspense> },
      { path: 'documents', element: <RouteSuspense><DocumentsPage /></RouteSuspense> },
      { path: 'payments', element: <PaymentsPage /> },
      { path: 'offices', element: <OfficesPage /> },
      { path: 'offices/:officeId', element: <OfficesPage /> },
      { path: 'insights', element: <RouteSuspense><InsightsPage /></RouteSuspense> },
      { path: 'reports', element: <RouteSuspense><ReportsPage /></RouteSuspense> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'settings', element: <RouteSuspense><SettingsPage /></RouteSuspense> },
      { path: 'settings/*', element: <RouteSuspense><SettingsPage /></RouteSuspense> },
      { path: 'admin', element: <Navigate to="/settings/users" replace /> },
      { path: 'admin/users', element: <Navigate to="/settings/users" replace /> },
      { path: 'audit', element: <RouteSuspense><AuditPage /></RouteSuspense> },
      { path: 'help', element: <RouteSuspense><HelpPage /></RouteSuspense> },
      { path: 'dev/tokens', element: <RouteSuspense><DevTokensPage /></RouteSuspense> },
      { path: 'dev/states', element: <RouteSuspense><DevStatesPage /></RouteSuspense> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
