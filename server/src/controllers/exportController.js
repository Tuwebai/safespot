import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { DB } from '../utils/db.js';
import { logError } from '../utils/logger.js';
import https from 'https';
import http from 'http';

/**
 * Brand Constants (Aligned with App Style)
 */
const COLORS = {
    PRIMARY: '#00ff88',  // SafeSpot Green
    DARK: '#020617',     // App Deep Navy
    TEXT: '#1e293b',     // Main text
    MUTED: '#64748b',    // Subtitles/Labels
    BORDER: '#e2e8f0',   // Dividers
    WHITE: '#ffffff'
};

/**
 * Process Image: Fetch from URL and convert to PNG (buffer) using Sharp
 * Fixes the issue with .webp and Supabase URLs in PDFKit
 */
const processImage = async (url) => {
    return new Promise((resolve) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            if (res.statusCode !== 200) {
                resolve(null);
                return;
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', async () => {
                try {
                    const buffer = Buffer.concat(chunks);
                    // Convert to PNG via Sharp to ensure PDFKit compatibility
                    const processed = await sharp(buffer)
                        .png()
                        .toBuffer();
                    resolve(processed);
                } catch (err) {
                    console.error('Error processing image with Sharp:', err.message);
                    resolve(null);
                }
            });
            res.on('error', () => resolve(null));
        }).on('error', () => resolve(null));
    });
};

/**
 * Draws the SafeSpot Logo (Identical to Frontend)
 */
const drawLogo = (doc, x, y, size = 32) => {
    doc.save();
    doc.roundedRect(x, y, size, size, 8).fill(COLORS.PRIMARY);

    // MapPin Silhouette
    const iconSize = size * 0.6;
    const offset = (size - iconSize) / 2;
    doc.translate(x + offset, y + offset);
    doc.scale(iconSize / 24, iconSize / 24);
    doc.path('M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z').fill(COLORS.DARK);
    doc.circle(12, 10, 3).fill(COLORS.DARK);
    doc.restore();
};

/**
 * Main PDF Export Controller
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

        // 2. Setup Document (A4, Professional Margins)
        const doc = new PDFDocument({
            margin: 50,
            size: 'A4',
            bufferPages: true
        });

        const safeTitle = (report.category || 'General').replace(/\s+/g, '_');
        const filename = `Reporte_SafeSpot_${safeTitle}_${id.substring(0, 8)}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);

        // --- HEADER ---
        drawLogo(doc, 50, 50, 36);
        doc.fillColor(COLORS.DARK).font('Helvetica-Bold').fontSize(22).text('SafeSpot', 95, 52);
        doc.fillColor(COLORS.MUTED).font('Helvetica').fontSize(10).text('REPORTE OFICIAL CIUDADANO', 95, 76);

        doc.moveTo(50, 100).lineTo(545, 100).strokeColor(COLORS.BORDER).lineWidth(1).stroke();

        let currentY = 130;

        // --- REPORT TITLE & CATEGORY ---
        doc.fillColor(COLORS.DARK).font('Helvetica-Bold').fontSize(18).text(report.title, 50, currentY);
        currentY += 25;

        doc.fillColor(COLORS.PRIMARY).fontSize(11).text(report.category.toUpperCase(), 50, currentY);
        currentY += 30;

        // --- INFO GRID (Layout clean like frontend) ---
        const drawMetadata = (label, value) => {
            doc.fillColor(COLORS.MUTED).font('Helvetica').fontSize(9).text(label.toUpperCase(), 50, currentY);
            doc.fillColor(COLORS.DARK).font('Helvetica-Bold').fontSize(11).text(value || 'No especificado', 50, currentY + 12);
            currentY += 40;
        };

        const fechaIncidente = report.incident_date ? new Date(report.incident_date).toLocaleString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : 'No disponible';

        drawMetadata('Fecha y Hora del Incidente', fechaIncidente);
        drawMetadata('Ubicación del Hecho', report.address || report.zone || 'Ubicación aproximada');
        drawMetadata('ID Único del Reporte', report.id);

        // --- DESCRIPTION ---
        doc.fillColor(COLORS.MUTED).font('Helvetica').fontSize(9).text('DESCRIPCIÓN DE LOS HECHOS', 50, currentY);
        currentY += 15;

        doc.fillColor(COLORS.TEXT).font('Helvetica').fontSize(11).text(report.description || 'Sin descripción detallada.', 50, currentY, {
            width: 495,
            align: 'justify',
            lineGap: 4
        });

        currentY = doc.y + 40;

        // --- IMAGES SECTION ---
        if (imageUrls.length > 0) {
            // Check if we need a new page
            if (currentY > 700) {
                doc.addPage();
                currentY = 50;
            }

            doc.fillColor(COLORS.MUTED).font('Helvetica').fontSize(9).text('EVIDENCIA FOTOGRÁFICA', 50, currentY);
            currentY += 20;

            const imgWidth = 495;
            const imgHeight = 300;

            for (const imgUrl of imageUrls) {
                const buffer = await processImage(imgUrl);
                if (buffer) {
                    // Check for page overflow
                    if (currentY + imgHeight > 750) {
                        doc.addPage();
                        currentY = 50;
                    }

                    try {
                        doc.image(buffer, 50, currentY, {
                            fit: [imgWidth, imgHeight],
                            align: 'center'
                        });
                        currentY += imgHeight + 20;
                    } catch (e) {
                        console.error('PDFKit Image Insert Error:', e.message);
                    }
                }
            }
        } else {
            doc.fillColor(COLORS.MUTED).font('Helvetica-Oblique').fontSize(10).text('Este reporte no contiene imágenes adjuntas.', 50, currentY);
        }

        // --- FOOTER (All pages) ---
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);

            const footerY = 790;
            doc.moveTo(50, footerY - 10).lineTo(545, footerY - 10).strokeColor(COLORS.BORDER).lineWidth(0.5).stroke();

            doc.fillColor(COLORS.MUTED).fontSize(8)
                .text('Documento generado automáticamente por SafeSpot.', 50, footerY, { align: 'left' })
                .text(`Página ${i + 1} de ${range.count}`, 50, footerY, { align: 'right' });

            doc.text(`Validar en: https://safespot.tuweb-ai.com/reporte/${report.id}`, 50, footerY + 12);
            doc.font('Helvetica-Bold').text('Este documento no reemplaza una denuncia policial formal.', 50, footerY + 24, { align: 'center' });
        }

        doc.end();

    } catch (error) {
        logError(error, req);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error al generar el PDF oficial del reporte' });
        }
    }
};
