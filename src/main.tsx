import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import App from './App.tsx'
import './index.css'
import { initializeIdentity } from './lib/identity'

import { HelmetProvider } from 'react-helmet-async'

const init = async () => {
  try {
    // BLOCKING identity initialization: 
    // This ensures FIRST requests use the CANONICAL ID from persistence
    await initializeIdentity();

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
  }
};

init();

