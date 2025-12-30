import { DB } from '../utils/db.js';
import { logError } from '../utils/logger.js';

// Helper to escape HTML special characters in meta tags
const escapeHtml = (text) => {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

/**
 * Generate a static map URL for reports without images
 * Uses Yandex Static Maps as a reliable fallback
 */
const getStaticMapUrl = (lat, lng) => {
    // Using Yandex Static Maps 1.x (Free, no key required for basic usage)
    // l=map (schema), z=15 (zoom), size=600,400, pt=lng,lat,pm2rdm (red pushpin)
    // lang=es_ES for Spanish labels
    return `https://static-maps.yandex.ru/1.x/?lang=es_ES&ll=${lng},${lat}&z=15&l=map&size=600,400&pt=${lng},${lat},pm2rdm`;
};

/**
 * Serve HTML with Open Graph tags for a specific report
 * This endpoint is designed to be shared on social media.
 * It returns static HTML with metadata and then redirects to the SPA.
 */
export const getReportPreview = async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch report data (public access)
        // We only need specific fields for the preview
        const db = DB.public();
        const result = await db.query(`
      SELECT title, description, category, zone, address, latitude, longitude, created_at, image_urls, status
      FROM reports 
      WHERE id = $1
    `, [id]);

        if (result.rows.length === 0) {
            // If report not found, perform a client-side redirect to home or 404 page
            return res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta http-equiv="refresh" content="0;url=https://safespot.netlify.app/" />
          </head>
          <body>Redirigiendo...</body>
        </html>
      `);
        }

        const report = result.rows[0];

        // normalize image_urls
        let images = [];
        if (report.image_urls) {
            if (Array.isArray(report.image_urls)) images = report.image_urls;
            else if (typeof report.image_urls === 'string') {
                try { images = JSON.parse(report.image_urls); } catch (e) { }
            }
        }

        // A) LOGIC FOR OG:IMAGE
        let ogImage = '';
        if (images.length > 0) {
            // Rule A: Report WITH images -> Use first image
            ogImage = images[0];
        } else {
            // Rule B: Report WITHOUT images -> Generate static map
            if (report.latitude && report.longitude) {
                ogImage = getStaticMapUrl(report.latitude, report.longitude);
            } else {
                // Fallback if no location (shouldn't happen given validation, but safety first)
                // Use a generic app social image
                ogImage = 'https://safespot.netlify.app/og-default.png';
            }
        }

        // Format Date
        const date = new Date(report.created_at).toLocaleDateString('es-AR', {
            day: 'numeric', month: 'long', year: 'numeric'
        });

        // Construct Title and Description
        // "Bicicleta Robada en Nueva Córdoba"
        const ogTitle = escapeHtml(`${report.category} - ${report.zone || report.address || 'Ubicación desconocida'}`);

        // "Ayudanos a encontrarlo. Publicado el 20 de Octubre. SafeSpot."
        const ogDescription = escapeHtml(`${report.description ? report.description.substring(0, 100) + '...' : 'Ayudanos a recuperarlo.'} 📍 ${report.zone}. Publicado el ${date}.`);

        // Target URL (The actual SPA page)
        const targetUrl = `https://safespot.netlify.app/reporte/${id}`;

        // Generate HTML response
        const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>${ogTitle} | SafeSpot</title>
        
        <!-- Open Graph / Facebook -->
        <meta property="og:type" content="website">
        <meta property="og:url" content="${targetUrl}">
        <meta property="og:title" content="${ogTitle}">
        <meta property="og:description" content="${ogDescription}">
        <meta property="og:image" content="${ogImage}">
        <meta property="og:site_name" content="SafeSpot">
        <meta property="og:locale" content="es_AR">

        <!-- Twitter -->
        <meta property="twitter:card" content="summary_large_image">
        <meta property="twitter:url" content="${targetUrl}">
        <meta property="twitter:title" content="${ogTitle}">
        <meta property="twitter:description" content="${ogDescription}">
        <meta property="twitter:image" content="${ogImage}">

        <!-- WhatsApp / General -->
        <meta itemprop="name" content="${ogTitle}">
        <meta itemprop="description" content="${ogDescription}">
        <meta itemprop="image" content="${ogImage}">

        <!-- Redirect to actual app -->
        <meta http-equiv="refresh" content="0;url=${targetUrl}" />
        
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; background: #121212; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .loader { text-align: center; }
        </style>
      </head>
      <body>
        <div class="loader">
          <p>Redirigiendo a SafeSpot...</p>
          <script>
            window.location.href = "${targetUrl}";
          </script>
        </div>
      </body>
      </html>
    `;

        res.send(html);

    } catch (error) {
        logError(error, req);
        // Fallback redirect
        res.redirect('https://safespot.netlify.app/');
    }
};
