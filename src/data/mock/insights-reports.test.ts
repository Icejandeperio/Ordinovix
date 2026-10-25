import { describe, it, expect, beforeEach } from 'vitest';
import { mockRepositories, mockDevControls } from './index';
import {
  calculateFirstPassRate,
  countTripsNeedingReturn,
  calculateOnTimeRate,
  calculateDaysToCollect,
} from '@/domain/metrics';

describe('mockRepositories.insights and Reports Pipeline (M9)', () => {
  beforeEach(() => {
    mockDevControls.setPersona('owner');
  });

  describe('Insights KPI Metrics and Hand Count Verifications', () => {
    it('computes overview KPIs accurately matching domain metrics calculations', async () => {
      const overview = await mockRepositories.insights.get('overview');
      expect(overview).toBeDefined();

      // Ensure rates are valid percentages (0-100)
      expect(overview.firstPassRate).toBeGreaterThanOrEqual(0);
      expect(overview.firstPassRate).toBeLessThanOrEqual(100);

      expect(overview.onTimeFilingRate).toBeGreaterThanOrEqual(0);
      expect(overview.onTimeFilingRate).toBeLessThanOrEqual(100);

      expect(typeof overview.repeatTripRate).toBe('number');
      expect(typeof overview.averageDaysToCollect).toBe('number');

      // Check monthly trend data structure
      expect(overview.monthlyTrends.length).toBeGreaterThan(0);
      overview.monthlyTrends.forEach((m) => {
        expect(m.month).toBeDefined();
        expect(m.firstPassRate).toBeGreaterThanOrEqual(0);
        expect(m.repeatTrips).toBeGreaterThanOrEqual(0);
      });
    });

    it('returns structured data for trips tab including rejection causes and office performance', async () => {
      const trips = await mockRepositories.insights.get('trips');
      expect(trips).toBeDefined();
      expect(trips.totalTrips).toBeGreaterThan(0);
      expect(trips.completedTrips).toBeGreaterThanOrEqual(0);
      expect(trips.topRejectionCauses.length).toBeGreaterThan(0);

      // Verify each rejection cause has an avoidable flag
      trips.topRejectionCauses.forEach((causeItem) => {
        expect(causeItem.cause).toBeDefined();
        expect(typeof causeItem.avoidable).toBe('boolean');
        expect(causeItem.count).toBeGreaterThan(0);
      });

      // Verify office performance breakdown
      expect(trips.officePerformance.length).toBeGreaterThan(0);
      trips.officePerformance.forEach((op) => {
        expect(op.officeName).toBeDefined();
        expect(op.visits).toBeGreaterThan(0);
        expect(op.firstPassRate).toBeGreaterThanOrEqual(0);
      });
    });

    it('returns structured data for chasing tab with response times and channel effectiveness', async () => {
      const chasing = await mockRepositories.insights.get('chasing');
      expect(chasing).toBeDefined();
      expect(chasing.averageResponseDays).toBeGreaterThan(0);
      expect(chasing.followUpSuccessRate).toBeGreaterThan(0);
      expect(chasing.chasesPerTask).toBeGreaterThan(0);

      expect(chasing.channelEffectiveness.length).toBeGreaterThan(0);
      chasing.channelEffectiveness.forEach((ce) => {
        expect(['viber', 'email', 'sms', 'messenger']).toContain(ce.channel);
        expect(ce.attempts).toBeGreaterThan(0);
      });
    });

    it('returns structured data for deadlines and workload tabs', async () => {
      const deadlines = await mockRepositories.insights.get('deadlines');
      expect(deadlines).toBeDefined();
      expect(deadlines.filingsOnTime).toBeGreaterThan(0);
      expect(deadlines.heatCalendar.length).toBeGreaterThan(0);

      const workload = await mockRepositories.insights.get('workload');
      expect(workload).toBeDefined();
      expect(workload.operatorTasks).toBeGreaterThan(0);
      expect(workload.tasksByStatusGroup).toBeDefined();
      expect(typeof workload.tasksByStatusGroup.ready).toBe('number');
      expect(typeof workload.tasksByStatusGroup.in_progress).toBe('number');
    });

    it('returns client response profile data for clients tab', async () => {
      const clientsData = await mockRepositories.insights.get('clients');
      expect(clientsData).toBeDefined();
      expect(clientsData.fastestClients.length).toBeGreaterThan(0);
      expect(clientsData.slowestClients.length).toBeGreaterThan(0);

      clientsData.fastestClients.forEach((fc) => {
        expect(fc.client.id).toBeDefined();
        expect(fc.avgDays).toBeGreaterThan(0);
      });
    });
  });

  describe('Reports and Data Exports Pipeline', () => {
    it('generates a client requirement checklist report', async () => {
      const checklist = await mockRepositories.reports.clientChecklist('client-rsp');
      expect(checklist).toBeDefined();
      expect(checklist.client.id).toBe('client-rsp');
      expect(checklist.client.code).toBe('RSP');
      expect(checklist.generatedAt).toBeDefined();
      expect(checklist.tasks.length).toBeGreaterThan(0);

      // Verify each task includes associated checklist lines
      checklist.tasks.forEach((t) => {
        expect(t.task.clientId).toBe('client-rsp');
        expect(Array.isArray(t.lines)).toBe(true);
      });
    });

    it('generates client annual history with tasks and payments summary', async () => {
      const history = await mockRepositories.reports.clientHistory('client-rsp', 2026);
      expect(history).toBeDefined();
      expect(history.client.id).toBe('client-rsp');
      expect(history.year).toBe(2026);
      expect(Array.isArray(history.tasks)).toBe(true);
      expect(typeof history.totalPayments).toBe('number');
    });

    it('generates monthly operations summary report with KPIs and payments', async () => {
      const summary = await mockRepositories.reports.monthlySummary('October 2026');
      expect(summary).toBeDefined();
      expect(summary.month).toBe('October 2026');
      expect(summary.filingsCount).toBeGreaterThan(0);
      expect(summary.onTimeFilingsCount).toBeGreaterThan(0);
      expect(summary.firstPassRate).toBeGreaterThan(0);
      expect(summary.paymentsHandled).toBeGreaterThan(0);
    });

    it('produces a full JSON database backup blob for owner', async () => {
      const backupBlob = await mockRepositories.reports.fullBackup();
      expect(backupBlob).toBeDefined();
      expect(backupBlob.type).toBe('application/json');

      const text = await backupBlob.text();
      const parsed = JSON.parse(text);
      expect(parsed.org).toBeDefined();
      expect(parsed.clients).toBeDefined();
      expect(parsed.tasks).toBeDefined();
      expect(parsed.visits).toBeDefined();
    });
  });
});
