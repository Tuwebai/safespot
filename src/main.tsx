import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import App from './App.tsx'
import './index.css'
import { initializeIdentity } from './lib/identity'

import { HelmetProvider } from 'react-helmet-async'

const init = () => {
  try {
    // Non-blocking identity initialization
    initializeIdentity().catch(console.error);

    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <HelmetProvider>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </HelmetProvider>
      </React.StrictMode>
    );
  } catch (error) {
    console.error('Failed to initialize application:', error);
    // Fallback UI rendering if needed, though less likely to reach here with non-blocking init
  }
};

init();

