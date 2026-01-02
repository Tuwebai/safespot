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
 * Convert a string to a URL-friendly slug
 */
const slugify = (text) => {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // Remove accents
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
};


/**
 * Format date in a human-friendly way: "Hoy 12:40", "Ayer 15:00", or "20 de Oct 10:30"
 */
const formatHumanDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  if (diffDays === 0 && date.getDate() === now.getDate()) {
    return `Hoy ${timeStr}`;
  } else if (diffDays === 1 || (diffDays === 0 && date.getDate() !== now.getDate())) {
    return `Ayer ${timeStr}`;
  } else {
    const dayMonth = date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    return `${dayMonth} ${timeStr}`;
  }
};

/**
 * Serve HTML with Open Graph tags for a specific report
 * This is consumed ONLY by social bots via Netlify redirection.
 */
/**
 * Serve HTML with Open Graph tags for a specific report.
 * Consumed by social bots to show rich previews.
 */
export const getReportPreview = async (req, res) => {
  try {
    const { id } = req.params;
    const frontendUrl = 'https://safespot.tuweb-ai.com';

    // Fetch report data
    const db = DB.public();
    const result = await db.query(`
      SELECT category, zone, address, created_at, image_urls
      FROM reports 
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).send('SEO: Reporte No Encontrado [DB]');
    }

    const report = result.rows[0];

    // Normalize images (parsed from JSON array)
    let images = [];
    if (report.image_urls) {
      if (Array.isArray(report.image_urls)) images = report.image_urls;
      else if (typeof report.image_urls === 'string') {
        try { images = JSON.parse(report.image_urls); } catch (e) { }
      }
    }

    // Image logic: First report image or professional fallback
    const ogImage = images.length > 0 ? images[0] : `${frontendUrl}/og-default.png`;

    const humanDate = formatHumanDate(report.created_at);
    const location = report.zone || report.address || 'Ubicación desconocida';

    // Data for Meta Tags
    const ogTitle = escapeHtml(`Robo de ${report.category}`);
    const ogDescription = escapeHtml(`${location} · ${humanDate} · Ayudá compartiendo`);
    const targetUrl = `${frontendUrl}/reporte/${id}`;

    // Detect if request is from a browser (not a bot)
    const userAgent = req.headers['user-agent'] || '';
    const isBrowser = !userAgent.match(/(bot|crawler|spider|facebook|twitter|whatsapp|telegram)/i);

    // If it's a real browser, redirect immediately (no HTML)
    if (isBrowser) {
      return res.redirect(302, targetUrl);
    }

    // For bots: serve HTML with Open Graph tags
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${ogTitle}</title>

  <!-- Canonical and Dynamic Meta -->
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="SafeSpot" />
  <meta property="og:url" content="${targetUrl}" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDescription}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${ogDescription}" />
  <meta name="twitter:image" content="${ogImage}" />
</head>
<body>
  <h1>${ogTitle}</h1>
  <p>${ogDescription}</p>
</body>
</html>`;

    res.status(200).set('Content-Type', 'text/html').send(html);

  } catch (error) {
    logError(error, req);
    res.status(500).send('Error interno');
  }
};

/**
 * Serve HTML for the general /alertas landing page
 */
export const getGeneralAlertsPreview = async (req, res) => {
  try {
    const frontendUrl = 'https://safespot.tuweb-ai.com';
    const ogTitle = escapeHtml('Alertas de Seguridad Ciudadana en Tiempo Real | SafeSpot');
    const ogDescription = escapeHtml('Mapa interactivo de incidentes, robos y alertas ciudadanas. Colaborá con tu comunidad de forma anónima para construir un entorno más seguro.');

    const targetUrl = `${frontendUrl}/reportes`;
    const ogImage = `${frontendUrl}/og-default.png`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${ogTitle}</title>
  <meta name="description" content="${ogDescription}" />
  <link rel="canonical" href="${frontendUrl}/alertas" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="SafeSpot" />
  <meta property="og:url" content="${targetUrl}" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDescription}" />
  <meta property="og:image" content="${ogImage}" />

  <!-- Structured Data -->
  <script type="application/ld+json">
    ${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": ogTitle,
      "description": ogDescription,
      "publisher": {
        "@type": "Organization",
        "name": "SafeSpot",
        "logo": {
          "@type": "ImageObject",
          "url": `${frontendUrl}/logo.png`
        }
      }
    })}
  </script>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px 20px;">
  <header>
    <h1 style="color: #1a1a1a; font-size: 2.5rem; margin-bottom: 20px;">${ogTitle}</h1>
  </header>
  <main>
    <section>
      <h2 style="color: #2c3e50; margin-top: 30px;">¿Qué es SafeSpot?</h2>
      <p>SafeSpot es una plataforma de <strong>seguridad comunitaria</strong> diseñada para que los ciudadanos puedan reportar y visualizar incidentes en tiempo real de forma totalmente anónima. Nuestra misión es democratizar la información de seguridad para que cada vecino sepa qué está pasando en su calle.</p>
      
      <h2 style="color: #2c3e50; margin-top: 30px;">¿Cómo funcionan las alertas?</h2>
      <p>Cada vez que un usuario reporta un incidente (un robo, una actividad sospechosa o una emergencia), el sistema procesa la ubicación y genera una alerta en el mapa. Los vecinos suscritos a esa zona reciben notificaciones inmediatas, permitiendo una prevención ciudadana efectiva basada en datos reales.</p>

      <h2 style="color: #2c3e50; margin-top: 30px;">Impacto de la Participación Ciudadana</h2>
      <p>La seguridad no depende solo de las autoridades, sino de la red que construimos entre todos. Al reportar, no solo registrás un hecho, sino que protegés al próximo vecino que camine por esa misma esquina. SafeSpot transforma el reporte individual en prevención colectiva.</p>
    </section>
    <footer style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666;">
      <p>Accedé a la aplicación completa en <a href="${frontendUrl}" style="color: #1a73e8; text-decoration: none; font-weight: bold;">safespot.tuweb-ai.com</a></p>
    </footer>
  </main>
</body>
</html>`;

    res.status(200).set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (error) {
    logError(error, req);
    res.status(500).send('Error interno');
  }
};

/**
 * Get all active zones from the reports table for programmatic SEO
 */
export const getZones = async (req, res) => {
  try {
    const db = DB.public();

    // Aggregate unique zones and localities
    // We prioritize 'zone' but fallback to 'address' components if needed.
    // However, the schema has a 'zone' column which is populated during report creation.
    const result = await db.query(`
      SELECT 
        zone as name,
        COUNT(*) as report_count,
        MAX(updated_at) as last_updated
      FROM reports 
      WHERE is_hidden = false AND zone IS NOT NULL AND zone != ''
      GROUP BY zone
      HAVING COUNT(*) > 0
      ORDER BY report_count DESC
    `);

    const zones = result.rows.map(z => ({
      name: z.name,
      slug: slugify(z.name),
      report_count: parseInt(z.report_count, 10),
      last_updated: z.last_updated
    }));

    res.json({ success: true, data: zones });

  } catch (error) {
    logError(error, req);
    res.status(500).json({ error: 'Error al obtener las zonas' });
  }
};
/**
 * Serve HTML with Open Graph tags for a specific zone/neighborhood
 * This is consumed ONLY by social bots via Netlify redirection.
 */
export const getZonePreview = async (req, res) => {
  try {
    const { slug } = req.params;
    const frontendUrl = 'https://safespot.tuweb-ai.com';

    const db = DB.public();
    const zoneResult = await db.query(`
      SELECT zone as name, COUNT(*) as report_count
      FROM reports 
      WHERE is_hidden = false AND zone IS NOT NULL AND zone != ''
      GROUP BY zone
    `);

    const zones = zoneResult.rows;
    const currentZone = zones.find(z => slugify(z.name) === slug);

    // Recovery zone name from slug if not found
    const zoneName = currentZone ? currentZone.name : slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const reportCount = currentZone ? parseInt(currentZone.report_count, 10) : 0;

    const ogTitle = escapeHtml(`Alertas de seguridad en ${zoneName} | SafeSpot`);
    const rawDesc = `Alertas de seguridad en ${zoneName}: ${reportCount > 0 ? reportCount + ' incidentes y ' : ''}reportes ciudadanos en tiempo real. Colaborá con tu barrio para estar más seguro en SafeSpot.`;
    const ogDescription = escapeHtml(rawDesc.substring(0, 160));

    const targetUrl = `${frontendUrl}/alertas/${slug}`;
    const ogImage = `${frontendUrl}/og-default.png`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${ogTitle}</title>
  <meta name="description" content="${ogDescription}" />
  <link rel="canonical" href="${targetUrl}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="SafeSpot" />
  <meta property="og:url" content="${targetUrl}" />
  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDescription}" />
  <meta property="og:image" content="${ogImage}" />

  <!-- Structured Data -->
  <script type="application/ld+json">
    ${JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Inicio", "item": frontendUrl },
            { "@type": "ListItem", "position": 2, "name": "Alertas", "item": `${frontendUrl}/alertas` },
            { "@type": "ListItem", "position": 3, "name": zoneName, "item": targetUrl }
          ]
        },
        {
          "@type": "Place",
          "name": zoneName,
          "address": {
            "@type": "PostalAddress",
            "addressLocality": zoneName,
            "addressRegion": "Argentina"
          }
        }
      ]
    })}
  </script>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 40px 20px;">
  <header>
    <h1 style="color: #1a1a1a; font-size: 2.2rem; margin-bottom: 20px;">${ogTitle}</h1>
  </header>
  <main>
    <section>
      <h2 style="color: #2c3e50; margin-top: 30px;">Estado actual de la seguridad en ${zoneName}</h2>
      <p>La seguridad en <strong>${zoneName}</strong> es una preocupación constante para quienes transitan y viven en el barrio. En SafeSpot, entendemos que la prevención comienza con la información compartida. Al monitorear en tiempo real las alertas de robos e incidentes en esta zona, nuestra comunidad identifica patrones críticos que de otro modo pasarían desapercibidos.</p>
      
      <p>Nuestra plataforma se nutre exclusivamente de <strong>reportes de ciudadanos reales</strong> de ${zoneName}. Esto significa que cada alerta es un testimonio directo de un vecino que busca proteger a los demás. Ya sea un robo de bicicleta, un incidente en la vía pública o el hallazgo de objetos perdidos, la transparencia comunitaria es nuestra herramienta principal contra la inseguridad local.</p>
      
      <h3 style="color: #2c3e50; margin-top: 30px;">¿Por qué es importante reportar en SafeSpot?</h3>
      <p>Muchas veces, los incidentes menores en barrios como ${zoneName} no llegan a las noticias locales o no son denunciados formalmente. Sin embargo, para un vecino que camina por las mismas calles todos los días, saber que hubo un aumento de arrebatos en una esquina específica puede ser la diferencia entre evitar un mal momento o no.</p>

      <div style="background: #f8f9fa; border-left: 4px solid #1a73e8; padding: 20px; margin: 30px 0;">
        <p style="margin: 0; font-weight: bold;">Actualmente se han registrado ${reportCount} incidentes reportados por la comunidad en ${zoneName}.</p>
      </div>

      <h3 style="color: #2c3e50; margin-top: 30px;">Participación Ciudadana en ${zoneName}</h3>
      <p>Al unirte a SafeSpot desde ${zoneName}, no solo visualizas datos, sino que te conviertes en un nodo activo de prevención. Reportar de forma anónima protege tu identidad mientras fortaleces la red de seguridad de tus vecinos.</p>
    </section>
    <footer style="margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666;">
      <p>Accedé al mapa interactivo de ${zoneName} en <a href="${targetUrl}" style="color: #1a73e8; text-decoration: none; font-weight: bold;">SafeSpot App</a></p>
    </footer>
  </main>
</body>
</html>`;

    res.status(200).set('Content-Type', 'text/html; charset=utf-8').send(html);
  } catch (error) {
    logError(error, req);
    res.status(500).send('Error interno');
  }
};
