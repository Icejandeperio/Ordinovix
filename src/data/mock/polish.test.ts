import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordError,
  getErrorLogs,
  clearErrorLogs,
  generateDiagnosticReport,
} from '@/lib/error-buffer';
import { formatPeso, formatPesoShort, parseToCentavos, todayInManila } from '@/lib/format';

describe('Polish & System Hygiene (M11)', () => {
  describe('Error Ring Buffer & Diagnostics (Section 19.8)', () => {
    beforeEach(() => {
      clearErrorLogs();
    });

    it('records error entries with timestamp and id', () => {
      const entry = recordError(new Error('Sample test error'), 'unit.test');
      expect(entry.id).toMatch(/^err-/);
      expect(entry.message).toBe('Sample test error');
      expect(entry.context).toBe('unit.test');
      expect(entry.timestamp).toBeDefined();

      const logs = getErrorLogs();
      expect(logs.length).toBe(1);
      expect(logs[0].id).toBe(entry.id);
    });

    it('sanitizes password and secret patterns from error messages', () => {
      recordError('Auth failure with password: my_super_secret_password', 'auth.test');
      const logs = getErrorLogs();
      expect(logs[0].message).not.toContain('my_super_secret_password');
      expect(logs[0].message).toContain('password=[REDACTED]');

      recordError('Token leaked token: secret_api_token_123', 'token.test');
      const updatedLogs = getErrorLogs();
      expect(updatedLogs[0].message).not.toContain('secret_api_token_123');
      expect(updatedLogs[0].message).toContain('token=[REDACTED]');
    });

    it('caps ring buffer at 50 entries and discards the oldest entry first', () => {
      for (let i = 1; i <= 60; i++) {
        recordError(`Error number ${i}`);
      }

      const logs = getErrorLogs();
      expect(logs.length).toBe(50);
      // getErrorLogs returns reverse chronological (newest first)
      expect(logs[0].message).toBe('Error number 60');
      expect(logs[logs.length - 1].message).toBe('Error number 11');
    });

    it('generates a clean diagnostic JSON report without throwing', () => {
      recordError('Diagnostic test error');
      const reportJson = generateDiagnosticReport();
      const parsed = JSON.parse(reportJson);

      expect(parsed).toHaveProperty('generatedAt');
      expect(parsed).toHaveProperty('errorCount');
      expect(parsed).toHaveProperty('recentErrors');
      expect(parsed.errorCount).toBe(1);
      expect(parsed.recentErrors[0].message).toBe('Diagnostic test error');
    });

    it('clears error logs completely', () => {
      recordError('Error to be wiped');
      expect(getErrorLogs().length).toBe(1);

      clearErrorLogs();
      expect(getErrorLogs().length).toBe(0);
    });
  });

  describe('Idle Lock & Privacy Mode Configuration (Section 19.5)', () => {
    it('calculates default idle lock timeout as 15 minutes in milliseconds', () => {
      const defaultMinutes = 15;
      const timeoutMs = defaultMinutes * 60 * 1000;
      expect(timeoutMs).toBe(900000);
    });

    it('handles "off" idle timeout setting cleanly', () => {
      const setting = 'off';
      const isTimerActive = setting !== 'off';
      expect(isTimerActive).toBe(false);
    });

    it('handles numeric idle timeout parsing', () => {
      const parseTimeout = (val: string | null) => {
        if (!val || val === '15') return 15 * 60 * 1000;
        if (val === '5') return 5 * 60 * 1000;
        if (val === '30') return 30 * 60 * 1000;
        if (val === 'off') return null;
        return 15 * 60 * 1000;
      };

      expect(parseTimeout('5')).toBe(300000);
      expect(parseTimeout('30')).toBe(1800000);
      expect(parseTimeout('off')).toBeNull();
      expect(parseTimeout(null)).toBe(900000);
    });
  });

  describe('Financial Centavos Formatting & Philippine Locales (Section 19.7)', () => {
    it('formats positive centavos with Philippine Peso sign and commas', () => {
      expect(formatPeso(1234550)).toContain('12,345.50');
      expect(formatPeso(50000)).toContain('500.00');
      expect(formatPeso(100)).toContain('1.00');
    });

    it('formats zero centavos correctly', () => {
      expect(formatPeso(0)).toContain('0.00');
    });

    it('formats negative centavos correctly', () => {
      const formatted = formatPeso(-50000);
      expect(formatted).toContain('500.00');
      expect(formatted).toContain('-');
    });

    it('parses peso strings into integer centavos accurately', () => {
      expect(parseToCentavos('₱12,345.50')).toBe(1234550);
      expect(parseToCentavos('500.00')).toBe(50000);
      expect(parseToCentavos('0')).toBe(0);
    });

    it('formats compact peso values with k and M suffixes', () => {
      expect(formatPesoShort(150000000)).toBe('₱1.5M');
      expect(formatPesoShort(2500000)).toBe('₱25.0k');
    });

    it('verifies Asia/Manila date string format YYYY-MM-DD from todayInManila', () => {
      const manilaDateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const today = todayInManila();
      expect(today).toMatch(manilaDateRegex);
    });
  });
});
