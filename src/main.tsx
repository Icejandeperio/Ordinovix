import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast, Toaster } from 'sonner';
import { ThemeProvider } from '@/app/theme';
import { router } from '@/app/router';

// Styles
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/print.css';
import { classifyError } from '@/domain/errors';

const queryClient = new QueryClient({
  // A write that fails validation and has no inline error handling of its own still tells the operator why
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
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

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
        {/* Host for every toast.* call in the app: without it saves, errors and undo prompts are invisible */}
        <Toaster position="top-center" closeButton />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
