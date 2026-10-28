import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast, Toaster } from 'sonner';
import { LazyMotion } from 'motion/react';
import { ThemeProvider } from '@/app/theme';
import { router } from '@/app/router';
import { offlineQueue } from '@/data';

// Styles
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/print.css';
import { classifyError } from '@/domain/errors';

const queryClient = new QueryClient({
  // A write that fails validation and has no inline error handling of its own still tells the operator why
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Someone else saved first (VERSION_CONFLICT): say so, then reload so every screen shows the latest record
      if (classifyError(error) === 'conflict') {
        toast.error((error as Error).message);
        void queryClient.invalidateQueries();
        return;
      }
      if (mutation.options.onError) return;
      if (classifyError(error) === 'validation') toast.error((error as Error).message);
    },
  }),
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      // A 403 or 404 will not change on a second try; anything else gets one retry
      retry: (failureCount, error) => failureCount < 1 && !['forbidden', 'not_found'].includes(classifyError(error)),
      staleTime: 30 * 1000,
    },
  },
});

// When queued writes have been sent, every screen shows the saved result
let queued = 0;
offlineQueue.subscribe(() => {
  const now = offlineQueue.getSnapshot().items.length;
  if (now < queued) void queryClient.invalidateQueries();
  queued = now;
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={() => import('@/lib/motion-features').then((mod) => mod.default)}>
        <ThemeProvider>
          <RouterProvider router={router} />
          {/* Host for every toast.* call in the app: without it saves, errors and undo prompts are invisible */}
          <Toaster position="top-center" closeButton />
        </ThemeProvider>
      </LazyMotion>
    </QueryClientProvider>
  </React.StrictMode>
);
