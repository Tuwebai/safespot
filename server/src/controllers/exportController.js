import PDFDocument from 'pdfkit';
import { DB } from '../utils/db.js';
import { logError } from '../utils/logger.js';
import https from 'https';

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
 * GET /api/reports/:id/export/pdf
 * Generates an official PDF report for a given report ID
 */
export const exportReportPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const db = DB.public();

        // 1. Fetch report data
        const result = await db.query(`
      SELECT * FROM reports WHERE id = $1
    `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Reporte no encontrado' });
        }

        const report = result.rows[0];

        // 2. Prepare images
        let imageUrls = [];
        if (report.image_urls) {
            if (Array.isArray(report.image_urls)) imageUrls = report.image_urls;
            else if (typeof report.image_urls === 'string') {
                try { imageUrls = JSON.parse(report.image_urls); } catch (e) { }
            }
        }

        // 3. Create PDF
        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        // Set headers for download
        const filename = `Reporte_SafeSpot_${report.category.replace(/\s+/g, '_')}_${id.substring(0, 8)}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        doc.pipe(res);

        // --- Header ---
        doc.fontSize(20).text('Reporte Oficial – SafeSpot', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`Generado el: ${new Date().toLocaleString('es-AR')}`, { align: 'right' });
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
        doc.moveDown();

        // --- Report Data ---
        doc.fontSize(14).fillColor('#2c3e50').text('Datos del Reporte', { underline: true });
        doc.moveDown(0.5);

        const fieldStyle = { label: { width: 150, bold: true }, value: { width: 350 } };

        const addField = (label, value) => {
            doc.fontSize(11).fillColor('#7f8c8d').text(label, { continued: true, width: fieldStyle.label.width });
            doc.fillColor('#2c3e50').text(`: ${value || 'No especificado'}`, { width: fieldStyle.value.width });
            doc.moveDown(0.5);
        };

        addField('ID del Reporte', report.id);
        addField('Categoría', report.category);
        addField('Ubicación', report.address || report.zone || 'Ubicación desconocida');
        addField('Fecha del Evento', report.incident_date ? new Date(report.incident_date).toLocaleString('es-AR') : 'No especificada');
        addField('Fecha de Reporte', new Date(report.created_at).toLocaleString('es-AR'));

        doc.moveDown();
        doc.fontSize(12).fillColor('#2c3e50').text('Descripción:', { bold: true });
        doc.fontSize(11).fillColor('#34495e').text(report.description || 'Sin descripción.', { align: 'justify' });
        doc.moveDown();

        // --- Images ---
        doc.addPage();
        doc.fontSize(14).fillColor('#2c3e50').text('Evidencia Fotográfica', { underline: true });
        doc.moveDown();

        if (imageUrls.length > 0) {
            for (const url of imageUrls) {
                try {
                    const imgBuffer = await fetchImageBuffer(url);
                    // Scale image to fit page width (roughly 495 units)
                    doc.image(imgBuffer, {
                        fit: [495, 300],
                        align: 'center',
                        valign: 'center'
                    });
                    doc.moveDown();
                } catch (imgError) {
                    doc.fontSize(10).fillColor('red').text(`[Error cargando imagen: ${url.substring(0, 30)}...]`);
                    doc.moveDown();
                }
            }
        } else {
            doc.fontSize(11).fillColor('#7f8c8d').text('El reporte no contiene imágenes adjuntas.');
        }

        // --- Footer ---
        const bottom = doc.page.height - 70;
        doc.fontSize(9).fillColor('#95a5a6')
            .text('Este documento fue generado automáticamente por SafeSpot como constancia del reporte ciudadano.', 50, bottom, { align: 'center' })
            .text(`URL del reporte: https://safespot.tuweb-ai.com/reporte/${report.id}`, { align: 'center', link: `https://safespot.tuweb-ai.com/reporte/${report.id}` });

        doc.end();

    } catch (error) {
        logError(error, req);
        res.status(500).json({ error: 'Error interno al generar el PDF' });
    }
};
