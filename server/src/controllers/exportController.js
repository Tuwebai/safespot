import PDFDocument from 'pdfkit';
import { DB } from '../utils/db.js';
import { logError } from '../utils/logger.js';
import https from 'https';
import http from 'http';

/**
 * Brand Constants
 */
const COLORS = {
    PRIMARY: '#00ff88', // Green SafeSpot
    DARK: '#020617',    // Deep Navy
    TEXT: '#1e293b',    // Slate Text
    MUTED: '#64748b',   // Muted Slate
    BORDER: '#e2e8f0',  // Light Border
    WHITE: '#ffffff',
    BG_SECTION: '#f8fafc'
};

/**
 * Fetch an image from a URL and return it as a Buffer
 */
const fetchImageBuffer = (url) => {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            if (res.statusCode !== 200) {
                // Return null if fetch fails instead of crashing
                resolve(null);
                return;
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', () => resolve(null));
        }).on('error', () => resolve(null));
    });
};

/**
 * Draws the SafeSpot Logo using PDFKit primitives (Vector)
 */
const drawLogo = (doc, x, y, size = 30) => {
    doc.save();

    // Draw rounded background (SafeSpot Green)
    doc.roundedRect(x, y, size, size, 8)
        .fill(COLORS.PRIMARY);

    // Draw MapPin icon silhouette (Centered)
    const iconSize = size * 0.65;
    const offset = (size - iconSize) / 2;

    doc.translate(x + offset, y + offset);
    doc.scale(iconSize / 24, iconSize / 24);

    // Path for MapPin
    doc.path('M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z')
        .fill(COLORS.DARK);

    // Center circle
    doc.circle(12, 10, 3)
        .fill(COLORS.DARK);

    doc.restore();
};

/**
 * Main Controller for PDF Generation (Institutional Standard)
 */
export const exportReportPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const db = DB.public();

        // 1. Fetch Report Data
        const result = await db.query('SELECT * FROM reports WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Reporte no encontrado' });
        }

        const report = result.rows[0];
        let imageUrls = [];
        try {
            imageUrls = Array.isArray(report.image_urls) ? report.image_urls : JSON.parse(report.image_urls || '[]');
        } catch (e) { imageUrls = []; }

        // 2. Setup Document
        const doc = new PDFDocument({
            margin: 50,
            size: 'A4',
            bufferPages: true,
            info: {
                Title: `Reporte SafeSpot - ${report.title}`,
                Author: 'SafeSpot Platform',
                Subject: 'Reporte Oficial de Incidente'
            }
        });

        const safeTitle = (report.category || 'General').replace(/\s+/g, '_');
        const filename = `Reporte_SafeSpot_${safeTitle}_${id.substring(0, 8)}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);

        // --- 1. HEADER ---
        drawLogo(doc, 50, 45, 36);
        doc.fillColor(COLORS.DARK)
            .font('Helvetica-Bold')
            .fontSize(20)
            .text('SafeSpot', 100, 48);

        doc.font('Helvetica')
            .fontSize(12)
            .fillColor(COLORS.MUTED)
            .text('Reporte Oficial de Incidente', 100, 70);

        doc.moveTo(50, 95).lineTo(545, 95).strokeColor(COLORS.BORDER).lineWidth(1).stroke();

        // --- 2. REPORT INFO TABLE ---
        doc.moveDown(2);
        doc.fillColor(COLORS.DARK).font('Helvetica-Bold').fontSize(14).text('INFORMACIÓN GENERAL', 50);
        doc.moveDown(0.5);

        const tableTop = doc.y;
        const rowHeight = 25;
        const colWidth = 140;

        const drawRow = (label, value, y) => {
            doc.rect(50, y, 495, rowHeight).fill(y % 50 === 0 ? COLORS.BG_SECTION : COLORS.WHITE);
            doc.fillColor(COLORS.MUTED).font('Helvetica-Bold').fontSize(9).text(label.toUpperCase(), 60, y + 8, { width: colWidth });
            doc.fillColor(COLORS.DARK).font('Helvetica').fontSize(10).text(value || 'N/A', 170, y + 8);
            doc.moveTo(50, y + rowHeight).lineTo(545, y + rowHeight).strokeColor(COLORS.BORDER).lineWidth(0.5).stroke();
            return y + rowHeight;
        };

        let currentY = tableTop;
        currentY = drawRow('Título', report.title, currentY);
        currentY = drawRow('Categoría', report.category, currentY);
        currentY = drawRow('Estado', (report.status || 'Pendiente').toUpperCase(), currentY);
        currentY = drawRow('Fecha/Hora', report.incident_date ? new Date(report.incident_date).toLocaleString('es-AR') : 'No especificada', currentY);
        currentY = drawRow('Ubicación', report.address || report.zone || 'No disponible', currentY);
        currentY = drawRow('ID Reporte', report.id, currentY);

        // --- 3. DESCRIPTION ---
        doc.moveDown(2);
        doc.fillColor(COLORS.DARK).font('Helvetica-Bold').fontSize(14).text('DESCRIPCIÓN DE LOS HECHOS', 50);
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(11).fillColor(COLORS.DARK).text(report.description || 'Sin descripción detallada.', {
            width: 495,
            align: 'justify',
            lineGap: 4
        });

        // --- 4. STATIC MAP ---
        if (report.latitude && report.longitude) {
            // Check if we need a new page for the map
            if (doc.y + 300 > 750) doc.addPage();
            else doc.moveDown(2);

            doc.fillColor(COLORS.DARK).font('Helvetica-Bold').fontSize(14).text('UBICACIÓN GEOGRÁFICA', 50);
            doc.moveDown(1);

            // Using a reliable static map provider
            const mapUrl = `https://static-maps.yandex.ru/1.x/?l=map&ll=${report.longitude},${report.latitude}&z=16&size=600,350&pt=${report.longitude},${report.latitude},pm2gnm`;
            const mapBuffer = await fetchImageBuffer(mapUrl);

            if (mapBuffer) {
                try {
                    doc.image(mapBuffer, 50, doc.y, { width: 495, height: 250 });
                    doc.rect(50, doc.y - 250, 495, 250).strokeColor(COLORS.BORDER).stroke();
                } catch (e) {
                    doc.fillColor(COLORS.MUTED).fontSize(10).text('Visualización de mapa no disponible.', 50, doc.y);
                }
            } else {
                doc.fillColor(COLORS.MUTED).fontSize(10).text('Visualización de mapa no disponible en este momento.', 50, doc.y);
            }
        }

        // --- 5. IMAGES EVIDENCE ---
        if (imageUrls.length > 0) {
            doc.addPage();
            doc.fillColor(COLORS.DARK).font('Helvetica-Bold').fontSize(14).text('EVIDENCIA FOTOGRÁFICA', 50);
            doc.moveDown(1);

            let imgX = 50;
            let imgY = doc.y;
            const imgWidth = 240;
            const imgHeight = 180;
            const gap = 15;

            for (let i = 0; i < imageUrls.length; i++) {
                if (imgY + imgHeight > 750) {
                    doc.addPage();
                    imgY = 50;
                    doc.fillColor(COLORS.DARK).font('Helvetica-Bold').fontSize(14).text('EVIDENCIA FOTOGRÁFICA (CONT.)', 50);
                    doc.moveDown(1);
                    imgY = doc.y;
                }

                const buf = await fetchImageBuffer(imageUrls[i]);
                if (buf) {
                    try {
                        doc.image(buf, imgX, imgY, {
                            fit: [imgWidth, imgHeight],
                            align: 'center',
                            valign: 'center'
                        });
                        // Border around image
                        doc.rect(imgX, imgY, imgWidth, imgHeight).strokeColor(COLORS.BORDER).stroke();
                    } catch (err) {
                        doc.fontSize(8).text('Error al cargar imagen', imgX, imgY + 10);
                    }
                } else {
                    doc.fontSize(8).text('Imagen no disponible', imgX, imgY + 10);
                }

                // Grid Logic: 2 per row
                if ((i + 1) % 2 === 0) {
                    imgX = 50;
                    imgY += imgHeight + gap;
                } else {
                    imgX += imgWidth + gap;
                }
            }
        } else {
            doc.moveDown(2);
            doc.fillColor(COLORS.MUTED).font('Helvetica-Oblique').fontSize(11).text('Este reporte no contiene imágenes adjuntas.', 50);
        }

        // --- 6. FOOTER ---
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);

            const footerY = 780;
            doc.moveTo(50, footerY - 10).lineTo(545, footerY - 10).strokeColor(COLORS.BORDER).lineWidth(0.5).stroke();

            doc.fillColor(COLORS.MUTED).fontSize(8)
                .text('Documento generado automáticamente por la plataforma SafeSpot.', 50, footerY, { align: 'center' })
                .text(`Fecha de generación: ${new Date().toLocaleString('es-AR')} | ID: ${report.id}`, { align: 'center' })
                .moveDown(0.2)
                .fillColor(COLORS.PRIMARY).text(`https://safespot.tuweb-ai.com/reporte/${report.id}`, { link: `https://safespot.tuweb-ai.com/reporte/${report.id}`, align: 'center' })
                .moveDown(0.2)
                .fillColor(COLORS.MUTED).font('Helvetica-Bold').text('Este documento no reemplaza una denuncia policial formal.', { align: 'center' });

            doc.fontSize(8).text(`Página ${i + 1} de ${range.count}`, 500, footerY + 10);
        }

        doc.end();

    } catch (error) {
        logError(error, req);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error interno al generar el PDF oficial' });
        }
    }
};
