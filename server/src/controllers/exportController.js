import PDFDocument from 'pdfkit';
import { DB } from '../utils/db.js';
import { logError } from '../utils/logger.js';
import https from 'https';

/**
 * Brand Constants
 */
const COLORS = {
    PRIMARY: '#00ff88', // Neon Green
    DARK: '#020617',    // Deep Navy
    TEXT: '#1e293b',    // Slate Text
    MUTED: '#64748b',   // Muted Slate
    BORDER: '#e2e8f0'   // Light Border
};

/**
 * Fetch an image from a URL and return it as a Buffer
 */
const fetchImageBuffer = (url) => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Failed to fetch image: ${res.statusCode}`));
                return;
            }
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
};

/**
 * Draws the SafeSpot Logo using PDFKit primitives
 */
const drawLogo = (doc, x, y, size = 30) => {
    doc.save();

    // Draw rounded background
    doc.roundedRect(x, y, size, size, 8)
        .fillAndStroke(COLORS.PRIMARY, COLORS.PRIMARY);

    // Draw MapPin icon (Lucide-like)
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    const pinColor = COLORS.DARK;

    doc.translate(centerX, centerY);
    doc.scale(size / 32, size / 32);

    // Path for MapPin
    doc.path('M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z')
        .fillAndStroke(pinColor, pinColor);

    // Center circle
    doc.circle(12, 10, 3)
        .fillAndStroke(pinColor, pinColor);

    doc.restore();
};

/**
 * GET /api/reports/:id/export/pdf
 */
export const exportReportPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const db = DB.public();

        const result = await db.query('SELECT * FROM reports WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Reporte no encontrado' });
        }

        const report = result.rows[0];
        let imageUrls = [];
        try {
            imageUrls = Array.isArray(report.image_urls) ? report.image_urls : JSON.parse(report.image_urls || '[]');
        } catch (e) { imageUrls = []; }

        const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
        const filename = `Reporte_Oficial_${id.substring(0, 8)}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);

        // --- INSTITUTIONAL HEADER ---
        drawLogo(doc, 50, 45, 40);
        doc.fillColor(COLORS.DARK)
            .fontSize(22)
            .text('SafeSpot', 100, 50, { characterSpacing: 1 });

        doc.fontSize(10)
            .fillColor(COLORS.MUTED)
            .text('PLATAFORMA DE SEGURIDAD CIUDADANA', 100, 75);

        doc.fillColor(COLORS.DARK)
            .fontSize(14)
            .text('REPORTE OFICIAL DE INCIDENTE', 300, 55, { align: 'right' });

        doc.fontSize(9)
            .fillColor(COLORS.MUTED)
            .text(`Documento ID: ${id.toUpperCase()}`, 300, 75, { align: 'right' });

        doc.moveTo(50, 100).lineTo(545, 100).strokeColor(COLORS.BORDER).lineWidth(1).stroke();

        // --- DATA SECTION ---
        doc.moveDown(2);
        doc.fontSize(12).fillColor(COLORS.DARK).text('Información del Reporte', { underline: true });
        doc.moveDown(0.5);

        const addRow = (label, value) => {
            const currentY = doc.y;
            doc.fontSize(10).fillColor(COLORS.MUTED).text(label, 50, currentY, { width: 120 });
            doc.fontSize(10).fillColor(COLORS.DARK).text(value || 'N/A', 180, currentY, { width: 360, bold: true });
            doc.moveDown(0.8);
        };

        addRow('Estado Actual', (report.status || 'Activo').toUpperCase());
        addRow('Categoría', report.category);
        addRow('Ubicación Precise', report.address || report.zone || 'No disponible');
        addRow('Fecha del Suceso', report.incident_date ? new Date(report.incident_date).toLocaleString('es-AR') : 'No especificada');
        addRow('Fecha de Creación', new Date(report.created_at).toLocaleString('es-AR'));

        // --- DESCRIPTION BLOCK ---
        doc.moveDown(1);
        doc.rect(50, doc.y, 495, 20).fill(COLORS.BORDER);
        doc.fillColor(COLORS.DARK).fontSize(10).text('DESCRIPCIÓN DE LOS HECHOS', 60, doc.y - 14, { bold: true });

        doc.moveDown(1.5);
        doc.fillColor(COLORS.TEXT).fontSize(11).text(report.description || 'Sin descripción adicional.', { align: 'justify', lineGap: 3 });

        // --- IMAGE EVIDENCE GRID (New Page if needed) ---
        if (imageUrls.length > 0) {
            doc.addPage();
            doc.fontSize(12).fillColor(COLORS.DARK).text('Evidencia Fotográfica Adjunta', { underline: true });
            doc.moveDown(1.5);

            const gridPadding = 15;
            const imgWidth = (495 - gridPadding) / 2;
            const imgHeight = 180;
            let currentX = 50;
            let currentY = doc.y;

            for (let i = 0; i < imageUrls.length; i++) {
                try {
                    const imgBuffer = await fetchImageBuffer(imageUrls[i]);

                    // Draw image container border
                    doc.roundedRect(currentX, currentY, imgWidth, imgHeight, 5).strokeColor(COLORS.BORDER).stroke();

                    doc.image(imgBuffer, currentX + 5, currentY + 5, {
                        fit: [imgWidth - 10, imgHeight - 10],
                        align: 'center',
                        valign: 'center'
                    });

                    // Update grid positions
                    if ((i + 1) % 2 === 0) {
                        currentX = 50;
                        currentY += imgHeight + gridPadding;
                    } else {
                        currentX += imgWidth + gridPadding;
                    }

                    // Page break if grid exceeds page height
                    if (currentY + imgHeight > 750) {
                        doc.addPage();
                        currentY = 50;
                    }
                } catch (err) {
                    doc.fontSize(9).fillColor('red').text(`[Error imagen ${i + 1}]`, currentX, currentY);
                }
            }
        }

        // --- LEGAL FOOTER ---
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
            doc.switchToPage(i);
            const bottom = doc.page.height - 60;

            doc.moveTo(50, bottom).lineTo(545, bottom).strokeColor(COLORS.BORDER).stroke();

            doc.fontSize(8).fillColor(COLORS.MUTED)
                .text('Este documento fue generado automáticamente por la plataforma SafeSpot y constituye una constancia digital de reporte.', 50, bottom + 10, { align: 'center' })
                .text(`Verificación pública disponible en: https://safespot.tuweb-ai.com/reporte/${report.id}`, { align: 'center', color: COLORS.PRIMARY });

            doc.text(`Página ${i + 1} de ${pages.count}`, 50, bottom + 35, { align: 'right' });
        }

        doc.end();

    } catch (error) {
        logError(error, req);
        res.status(500).json({ error: 'Fallo al generar el reporte oficial' });
    }
};
