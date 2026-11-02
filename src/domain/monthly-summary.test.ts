import { describe, it, expect } from 'vitest';
import { computeInsights, computeMonthlySummary } from './metrics';
import { EXPORT_HEADERS, toCsv, pesoDecimal } from './exports';
import type { Task, Visit, VisitItem, Payment, Baseline } from './types';

// One month of hand-countable records (October 2026, today is the 31st). Only the fields the measures read are set.
const task = (o: Partial<Task>): Task => ({ createdAt: '2026-09-01T00:00:00+08:00', status: 'in_preparation', ...o }) as Task;
const visit = (o: Partial<Visit>): Visit => o as Visit;
const item = (o: Partial<VisitItem>): VisitItem => ({ isFirstVisitForTask: true, ...o }) as VisitItem;
const payment = (o: Partial<Payment>): Payment => o as Payment;

const tasks = [
  task({ id: 't1', dueDate: '2026-10-10', submittedAt: '2026-10-09T10:00:00+08:00', status: 'submitted', createdAt: '2026-10-01T00:00:00+08:00', readyAt: '2026-10-04T00:00:00+08:00' }),
  task({ id: 't2', dueDate: '2026-10-15', completedAt: '2026-10-20T10:00:00+08:00', status: 'completed', createdAt: '2026-10-02T00:00:00+08:00', readyAt: '2026-10-08T00:00:00+08:00' }),
  task({ id: 't3', dueDate: '2026-10-20', submittedAt: '2026-09-30T10:00:00+08:00', status: 'submitted' }), // filed in September
  task({ id: 't4', dueDate: '2026-10-25' }), // still open, past due
  task({ id: 't5', dueDate: '2026-11-05', submittedAt: '2026-10-28T10:00:00+08:00', status: 'submitted' }), // filed early, due in November
];
const visits = [
  visit({ id: 'v1', plannedDate: '2026-10-05', status: 'done' }),
  visit({ id: 'v2', plannedDate: '2026-10-12', status: 'in_progress' }),
  visit({ id: 'v3', plannedDate: '2026-10-14', status: 'planned' }), // never started
  visit({ id: 'v4', plannedDate: '2026-09-30', status: 'done' }),
];
const visitItems = [
  item({ id: 'i1', outcome: 'completed', outcomeAt: '2026-10-05T11:00:00+08:00' }),
  item({ id: 'i2', outcome: 'not_accepted', avoidable: true, outcomeAt: '2026-10-05T11:30:00+08:00' }),
  item({ id: 'i3', outcome: 'submitted_pending', outcomeAt: '2026-10-12T11:00:00+08:00' }),
  item({ id: 'i4', outcome: 'more_documents_requested', avoidable: false, isFirstVisitForTask: false, outcomeAt: '2026-10-12T11:30:00+08:00' }),
  item({ id: 'i5', outcome: 'completed', outcomeAt: '2026-09-30T11:00:00+08:00' }),
];
const payments = [
  payment({ id: 'p1', paidOn: '2026-10-03', amount: 150000 }),
  payment({ id: 'p2', paidOn: '2026-10-28', amount: 250050 }),
  payment({ id: 'p3', paidOn: '2026-09-30', amount: 99900 }),
  payment({ id: 'p4', paidOn: '2026-10-05', amount: 700000, deletedAt: '2026-10-06T00:00:00+08:00' }),
];
const baseline = { tripsPerMonth: 10, repeatTripsPerMonth: 4 } as Baseline;
const TODAY = '2026-10-31';

describe('U36 computeMonthlySummary', () => {
  it('counts exactly what a hand count of the month gives', () => {
    expect(computeMonthlySummary({ tasks, visits, visitItems, payments, baseline }, '2026-10', TODAY)).toEqual({
      month: '2026-10',
      filingsCount: 3, // t1, t2, t5
      onTimeFilingsCount: 2, // t1 and t5; t2 was filed five days late
      totalVisits: 2, // v1 and v2; v3 never started, v4 is September
      firstPassRate: 67, // 2 of the 3 first visits
      firstPassVisits: 3,
      avoidableRepeatTrips: 1, // i2; i4 was not avoidable
      onTimeRate: 50, // t1 and t3 on time, t2 and t4 late
      averageDaysToCollect: 4.5, // t1 took 3 days, t2 took 6
      paymentsHandled: 400050, // p1 + p2; p3 is September and p4 is deleted
      firstPassBaseline: 60,
      repeatTripsBaseline: 4,
    });
  });

  it('shows the same numbers as Insights for the same month', () => {
    const summary = computeMonthlySummary({ tasks, visits, visitItems, payments, baseline }, '2026-10', TODAY);
    const insights = computeInsights(
      { tasks, visits, visitItems, taskLines: [], followUps: [], attempts: [], clients: [], deadlineMoves: [], templates: [], pulses: [], baseline, userNames: {}, userRoles: {} } as never,
      { from: '2026-10-01', to: '2026-10-31' },
      TODAY,
    );
    const octoberTrend = insights.overview.monthlyTrends[0];
    expect(octoberTrend.filings).toBe(summary.filingsCount);
    expect(octoberTrend.firstPassRate).toBe(summary.firstPassRate);
    expect(octoberTrend.repeatTrips).toBe(summary.avoidableRepeatTrips);
    expect(insights.overview.onTimeFilingRate).toBe(summary.onTimeRate);
    expect(insights.overview.firstPassBaseline).toBe(summary.firstPassBaseline);
  });

  it('is empty, not invented, for a month with no records', () => {
    expect(computeMonthlySummary({ tasks, visits, visitItems, payments, baseline: null }, '2026-01', TODAY)).toMatchObject({
      filingsCount: 0, onTimeFilingsCount: 0, totalVisits: 0, firstPassRate: 0, firstPassVisits: 0, onTimeRate: null, paymentsHandled: 0, firstPassBaseline: null, repeatTripsBaseline: null,
    });
  });
});

describe('U36 CSV encoding', () => {
  it('starts with a byte-order mark, quotes commas, quotes and line breaks, and keeps ñ and ₱', () => {
    const csv = toCsv(['Client', 'Note'], [['Niño, Jr.', 'said "hi"\nthen left'], ['Peña', '₱1,500.00']]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe('﻿Client,Note\r\n"Niño, Jr.","said ""hi""\nthen left"\r\nPeña,"₱1,500.00"\r\n');
  });

  it('writes peso amounts as plain decimals from centavos', () => {
    expect(pesoDecimal(4500050)).toBe('45000.50');
    expect(pesoDecimal(5)).toBe('0.05');
  });

  it('has a header set for every export kind, and none that asks for a full TIN', () => {
    expect(Object.keys(EXPORT_HEADERS).sort()).toEqual(['activity', 'clients', 'follow_ups', 'lines', 'payments', 'tasks', 'visits']);
    expect(EXPORT_HEADERS.clients).toContain('Masked TIN');
    expect(Object.values(EXPORT_HEADERS).flat().filter((h) => /tin/i.test(h))).toEqual(['Masked TIN']);
  });
});
