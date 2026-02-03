import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { AdminApp } from './AdminApp'
import '../index.css'

// ✅ ENTERPRISE: Sentry (Production Only)
import { initSentry } from '../lib/sentry'
initSentry()

import { AppVersion } from '../lib/version'


console.info(
    `%cSafeSpot ADMIN v${AppVersion.appVersion}%c\nSecure Session Initialized`,
    'background: #ef4444; color: #fff; padding: 4px; font-weight: bold; border-radius: 4px;',
    'color: #94a3b8; margin-left: 5px;'
);

ReactDOM.createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <AdminApp />
    </StrictMode>,
)
