import express from 'express';
import { queryWithRLS } from '../utils/rls.js';
import { DB } from '../utils/db.js';
import { logError } from '../utils/logger.js';

const router = express.Router();

const BASE_URL = 'https://safespot.tuweb-ai.com';

/**
 * GET /api/sitemap.xml
 * Generate dynamic sitemap with all public reports
 */
router.get('/sitemap.xml', async (req, res) => {
  try {
    // Get all public reports (not hidden)
    const result = await queryWithRLS('', `
      SELECT id, updated_at 
      FROM reports 
      WHERE is_hidden = false 
      ORDER BY updated_at DESC 
      LIMIT 5000
    `, []);

    const reports = result.rows;

    // Get unique zones for programmatic SEO pages
    const db = DB.public();
    const zonesResult = await db.query(`
      SELECT DISTINCT zone 
      FROM reports 
      WHERE is_hidden = false AND zone IS NOT NULL AND zone != ''
    `);

    const slugify = (text) => text.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');

    const zones = zonesResult.rows.map(z => ({
      name: z.zone,
      slug: slugify(z.zone)
    }));

    // Generate XML sitemap
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Static pages -->
  <url>
    <loc>${BASE_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${BASE_URL}/reportes</loc>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${BASE_URL}/explorar</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${BASE_URL}/terminos</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>${BASE_URL}/privacidad</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  
  <!-- Dynamic reports -->
  ${reports.map(report => `
  <url>
    <loc>${BASE_URL}/reporte/${report.id}</loc>
    <lastmod>${new Date(report.updated_at).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('')}

  <!-- Programmatic Zone Pages -->
  ${zones.map(zone => `
  <url>
    <loc>${BASE_URL}/alertas/${zone.slug}</loc>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`).join('')}
</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    logError(error, { context: 'sitemap.xml generation' });
    res.status(500).send('<?xml version="1.0" encoding="UTF-8"?><error>Sitemap generation failed</error>');
  }
});

export default router;
