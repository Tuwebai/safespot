import axios from 'axios';

/**
 * n8nClient
 * Cliente centralizado para comunicaciones externas vía n8n.
 * Implementa resiliencia con reintentos exponenciales y seguridad por entorno.
 */

const N8N_SECRET = process.env.N8N_SECRET;
const IS_PROD = process.env.NODE_ENV === 'production';

const n8nClient = axios.create({
    timeout: 5000,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Interceptor de Seguridad y Trazabilidad
n8nClient.interceptors.request.use((config) => {
    // Seguridad: Solo inyectar secreto en producción si está configurado
    if (IS_PROD && N8N_SECRET) {
        config.headers['X-N8N-Secret'] = N8N_SECRET;
    }

    // Logging de Request (para auditoría)
    console.log(`[n8nClient] Request ${config.method.toUpperCase()} -> ${config.url}`);

    return config;
}, (error) => {
    return Promise.reject(error);
});

// Interceptor de Resiliencia (Retries con Backoff Exponencial)
n8nClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const config = error.config;

        // Si no hay configuración o no se habilitaron retries, tirar el error
        if (!config || !config.retryCount) {
            config.retryCount = 0;
        }

        const MAX_RETRIES = 3;

        if (config.retryCount < MAX_RETRIES) {
            config.retryCount += 1;

            // Determinar si es un error reintentable (Network error o 5xx)
            const isRetryable = !error.response || (error.response.status >= 500 && error.response.status <= 599);

            if (isRetryable) {
                const backoffDelay = Math.pow(2, config.retryCount) * 1000; // 2s, 4s, 8s
                console.warn(`[n8nClient] Error detectado. Reintentando (${config.retryCount}/${MAX_RETRIES}) en ${backoffDelay}ms...`);

                await new Promise(resolve => setTimeout(resolve, backoffDelay));
                return n8nClient(config);
            }
        }

        // Logging detallado de fallos finales
        if (error.code === 'ECONNABORTED') {
            console.error(`[n8nClient] TIMEOUT agotado tras ${MAX_RETRIES} reintentos.`);
        } else {
            console.error(`[n8nClient] HTTP Error: ${error.response?.status || 'Network Error'} - ${error.message}`);
        }

        return Promise.reject(error);
    }
);

export default n8nClient;
