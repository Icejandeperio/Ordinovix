import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './shell';

// Route components
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
import { CalendarPage } from '@/routes/calendar/page';
import { DocumentsPage } from '@/routes/documents/page';
import { PaymentsPage } from '@/routes/payments/page';
import { OfficesPage } from '@/routes/offices/page';
import { InsightsPage } from '@/routes/insights/page';
import { ReportsPage } from '@/routes/reports/page';
import { NotificationsPage } from '@/routes/notifications/page';
import { SearchPage } from '@/routes/search/page';
import { SettingsPage } from '@/routes/settings/page';
import { AuditPage } from '@/routes/audit/page';
import { HelpPage } from '@/routes/help/page';
import { DevTokensPage } from '@/routes/dev/tokens';
import { DevStatesPage } from '@/routes/dev/states';
import { NotFoundPage } from '@/routes/not-found';

export const router = createBrowserRouter([
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
      { path: 'calendar', element: <CalendarPage /> },
      { path: 'documents', element: <DocumentsPage /> },
      { path: 'payments', element: <PaymentsPage /> },
      { path: 'offices', element: <OfficesPage /> },
      { path: 'offices/:officeId', element: <OfficesPage /> },
      { path: 'insights', element: <InsightsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'settings/*', element: <SettingsPage /> },
      { path: 'audit', element: <AuditPage /> },
      { path: 'help', element: <HelpPage /> },
      { path: 'dev/tokens', element: <DevTokensPage /> },
      { path: 'dev/states', element: <DevStatesPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
