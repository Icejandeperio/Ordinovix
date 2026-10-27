import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/app/theme';
import { router } from '@/app/router';

// Styles
import '@/styles/tokens.css';
import '@/styles/base.css';
import '@/styles/print.css';
import { classifyError } from '@/domain/errors';

const queryClient = new QueryClient({
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
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
