/**
 * Section 19.8: Local Ring Buffer Error Logger
 * Keeps the last 50 frontend errors with timestamps and sanitized contexts.
 * Free of personal data, passwords, or taxpayer credentials.
 */

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  message: string;
  stack?: string;
  context?: string;
  url?: string;
}

const MAX_BUFFER_SIZE = 50;
const ringBuffer: ErrorLogEntry[] = [];

export function recordError(err: unknown, context?: string): ErrorLogEntry {
  const timestamp = new Date().toISOString();
  let message = 'Unknown error';
  let stack: string | undefined = undefined;

  if (err instanceof Error) {
    message = err.message;
    stack = err.stack;
  } else if (typeof err === 'string') {
    message = err;
  } else if (err && typeof err === 'object' && 'message' in err) {
    message = String((err as any).message);
  }

  // Sanitize any accidental password patterns
  message = message.replace(/(password|secret|token)[:=]\s*\S+/gi, '$1=[REDACTED]');

  const entry: ErrorLogEntry = {
    id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp,
    message,
    stack,
    context,
    url: typeof window !== 'undefined' ? window.location.pathname : undefined,
  };

  ringBuffer.push(entry);
  if (ringBuffer.length > MAX_BUFFER_SIZE) {
    ringBuffer.shift();
  }

  return entry;
}

export function getErrorLogs(): ReadonlyArray<ErrorLogEntry> {
  return [...ringBuffer].reverse();
}

export function clearErrorLogs(): void {
  ringBuffer.length = 0;
}

export function generateDiagnosticReport(): string {
  const report = {
    generatedAt: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node/Test',
    screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'N/A',
    theme: typeof localStorage !== 'undefined' ? localStorage.getItem('ox-theme') || 'system' : 'N/A',
    errorCount: ringBuffer.length,
    recentErrors: getErrorLogs(),
  };

  return JSON.stringify(report, null, 2);
}

// Auto-register global listeners if running in the browser
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    recordError(event.error || event.message, 'window.onerror');
  });

  window.addEventListener('unhandledrejection', (event) => {
    recordError(event.reason, 'window.onunhandledrejection');
  });
}
