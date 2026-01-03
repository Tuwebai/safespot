import sharp from 'sharp';

/**
 * Generates a dynamic social card image for a report using Sharp
 * @param {Object} report - Report data (title, category, zone, images)
 * @returns {Promise<Buffer>} - Image buffer
 */
export async function generateReportSocialCard(report) {
    const width = 1200;
    const height = 630;

    // 1. Determine card colors based on category/status
    const isFound = report.category === 'Objetos Perdidos' || report.status === 'resuelto';
    const primaryColor = isFound ? '#22c55e' : '#f43f5e'; // Green for found/solved, Red for danger
    const accentColor = '#00ff88'; // SafeSpot Neon Green

    // 2. Prepare background
    // If no image, use a dark gradient. If image exists, blur it as background.
    let background;
    const mainImage = (report.image_urls && report.image_urls.length > 0) ? report.image_urls[0] : null;

    if (mainImage && mainImage.startsWith('http')) {
        try {
            const resp = await fetch(mainImage);
            if (resp.ok) {
                const imageBuffer = await resp.arrayBuffer();
                background = sharp(Buffer.from(imageBuffer))
                    .resize(width, height, { fit: 'cover' })
                    .blur(20) // Blur it heavily for background
                    .composite([{
                        input: Buffer.from(`<svg><rect x="0" y="0" width="${width}" height="${height}" fill="rgba(2, 6, 23, 0.85)"/></svg>`),
                        blend: 'over'
                    }]);
            } else {
                background = createGradientBackground(width, height);
            }
        } catch (e) {
            background = createGradientBackground(width, height);
        }
    } else {
        background = createGradientBackground(width, height);
    }

    // 3. Create SVG Overlay for Text and Branding
    const escapedTitle = escapeXml(report.title || 'Alerta de Seguridad');
    const escapedZone = escapeXml(report.zone || 'Ubicación Desconocida');
    const escapedCategory = escapeXml(report.category || 'Incidente');
    const badgeText = isFound ? 'VISTO / ENCONTRADO' : 'REPORTE DE INCIDENTE';

    const svgOverlay = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" style="stop-color:${primaryColor};stop-opacity:1" />
          <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Bottom Banner Area -->
      <rect x="0" y="${height - 180}" width="${width}" height="180" fill="rgba(15, 23, 42, 0.9)" />
      
      <!-- Top Left Badge -->
      <rect x="40" y="40" width="300" height="40" rx="20" fill="${primaryColor}" />
      <text x="190" y="67" font-family="sans-serif" font-size="20" font-weight="bold" fill="white" text-anchor="middle">${badgeText}</text>

      <!-- Main Title -->
      <text x="40" y="${height - 110}" font-family="sans-serif" font-size="54" font-weight="900" fill="white">${truncate(escapedTitle, 40)}</text>
      
      <!-- Metadata (Zone) -->
      <text x="40" y="${height - 50}" font-family="sans-serif" font-size="32" font-weight="500" fill="${accentColor}">📍 ${escapedZone}</text>

      <!-- Category Tag (Bottom Right) -->
      <text x="${width - 40}" y="${height - 50}" font-family="sans-serif" font-size="28" font-weight="bold" fill="rgba(255,255,255,0.6)" text-anchor="end">${escapedCategory}</text>

      <!-- Branding -->
      <text x="${width - 40}" y="70" font-family="sans-serif" font-size="42" font-weight="900" fill="${accentColor}" text-anchor="end">SafeSpot</text>
      <text x="${width - 40}" y="105" font-family="sans-serif" font-size="18" font-weight="bold" fill="white" text-anchor="end" opacity="0.7">SÉ PARTE DE LA SOLUCIÓN</text>
    </svg>
  `;

    // 4. Composite everything
    // If we have a main image, we also show it in a rounded box
    const compositions = [{ input: Buffer.from(svgOverlay), top: 0, left: 0 }];

    if (mainImage) {
        try {
            const imageBuffer = await fetch(mainImage).then(res => res.arrayBuffer());
            const thumbnail = await sharp(Buffer.from(imageBuffer))
                .resize(500, 300, { fit: 'cover' })
                .composite([{
                    input: Buffer.from(`<svg><rect x="0" y="0" width="500" height="300" rx="20" ry="20" /></svg>`),
                    blend: 'dest-in'
                }])
                .toBuffer();

            compositions.push({
                input: thumbnail,
                top: 100,
                left: 40
            });
        } catch (e) {
            console.error('Error fetching/processing main image for preview:', e);
        }
    }

    return await background
        .composite(compositions)
        .png()
        .toBuffer();
}

function createGradientBackground(width, height) {
    // Simple dark noise-like background or deep blue
    return sharp({
        create: {
            width,
            height,
            channels: 4,
            background: { r: 2, g: 6, b: 23, alpha: 1 }
        }
    });
}

function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

function truncate(str, n) {
    return (str.length > n) ? str.slice(0, n - 1) + '...' : str;
}
