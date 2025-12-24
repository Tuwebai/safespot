import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeIdentity } from './lib/identity'

// Initialize anonymous identity BEFORE rendering app
try {
  initializeIdentity();
  
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
} catch (error) {
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
            Por favor, verifica que localStorage esté habilitado en tu navegador.
          </p>
        </div>
      </div>
    `;
  }
}

