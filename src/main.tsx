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
    // Show fallback UI
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: #020617;
          color: #F8FAFC;
          font-family: Inter, sans-serif;
          padding: 2rem;
          text-align: center;
        ">
          <div>
            <h1 style="color: #00ff88; margin-bottom: 1rem;">Error de Inicialización</h1>
            <p style="color: #94A3B8; margin-bottom: 1rem;">
              No se pudo inicializar la identidad anónima.
            </p>
            <p style="color: #EF4444; font-size: 0.875rem;">
              ${error instanceof Error ? error.message : 'Error desconocido'}
            </p>
            <p style="color: #94A3B8; font-size: 0.75rem; margin-top: 2rem;">
              Por favor, verifica que las cookies y el almacenamiento local estén habilitados.
            </p>
            <button onclick="window.location.reload()" style="
              margin-top: 1.5rem;
              padding: 0.5rem 1rem;
              background: #00ff88;
              color: #020617;
              border: none;
              border-radius: 0.375rem;
              cursor: pointer;
              font-weight: 600;
            ">Reintentar</button>
          </div>
        </div>
      `;
    }
  }
};

init();

