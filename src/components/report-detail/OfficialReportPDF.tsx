import { Document, Page, Text, View, StyleSheet, Image, Svg, Path, Circle, Link } from '@react-pdf/renderer';
import type { Report } from '@/lib/api';

// Register a clean sans-serif font if possible, or use standard ones
// pdf-renderer defaults to Helvetica/Courier/Times
const COLORS = {
    PRIMARY: '#00ff88',
    DARK: '#020617',
    TEXT: '#1e293b',
    MUTED: '#64748b',
    BORDER: '#e2e8f0',
    WHITE: '#ffffff',
    BG_SECTION: '#f8fafc'
};

const styles = StyleSheet.create({
    page: {
        padding: 50,
        backgroundColor: COLORS.WHITE,
        fontFamily: 'Helvetica',
        fontSize: 10,
        color: COLORS.TEXT,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.BORDER,
        paddingBottom: 20,
    },
    logoSection: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoBox: {
        width: 36,
        height: 36,
        backgroundColor: COLORS.PRIMARY,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    brandName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.DARK,
        letterSpacing: 1,
    },
    headerLabels: {
        alignItems: 'flex-end',
    },
    officialTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.DARK,
        marginBottom: 4,
    },
    officialSubtitle: {
        fontSize: 8,
        color: COLORS.MUTED,
        letterSpacing: 0.5,
    },
    section: {
        marginBottom: 25,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: COLORS.DARK,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.BORDER,
        paddingBottom: 5,
        marginBottom: 10,
        textTransform: 'uppercase',
    },
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        backgroundColor: COLORS.BG_SECTION,
        padding: 15,
        borderRadius: 8,
    },
    infoItem: {
        width: '50%',
        marginBottom: 12,
    },
    label: {
        fontSize: 8,
        color: COLORS.MUTED,
        marginBottom: 2,
        textTransform: 'uppercase',
    },
    value: {
        fontSize: 10,
        fontWeight: 'bold',
        color: COLORS.DARK,
    },
    descriptionBox: {
        padding: 15,
        lineHeight: 1.5,
        textAlign: 'justify',
    },
    imageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 15,
    },
    imageContainer: {
        width: '47%',
        height: 180,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.BORDER,
        overflow: 'hidden',
        marginBottom: 15,
    },
    image: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    emptyState: {
        textAlign: 'center',
        color: COLORS.MUTED,
        padding: 20,
        fontStyle: 'italic',
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 50,
        right: 50,
        borderTopWidth: 1,
        borderTopColor: COLORS.BORDER,
        paddingTop: 15,
        textAlign: 'center',
    },
    footerText: {
        fontSize: 7,
        color: COLORS.MUTED,
        marginBottom: 4,
        lineHeight: 1.4,
    },
    verificationLink: {
        fontSize: 7,
        color: COLORS.PRIMARY,
        marginTop: 5,
    },
    pageNumber: {
        position: 'absolute',
        bottom: 20,
        right: 50,
        fontSize: 8,
        color: COLORS.MUTED,
    }
});

// Logo SVG Component
const SafeSpotLogo = () => (
    <Svg width="20" height="20" viewBox="0 0 24 24">
        {/* MapPin silhouette */}
        <Path
            d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"
            fill={COLORS.DARK}
        />
        <Circle cx="12" cy="10" r="3" fill={COLORS.PRIMARY} />
    </Svg>
);

interface OfficialReportPDFProps {
    report: Report;
}

export const OfficialReportPDF = ({ report }: OfficialReportPDFProps) => {
    const generationDate = new Date().toLocaleString('es-AR');
    const incidentDate = report.incident_date
        ? new Date(report.incident_date).toLocaleString('es-AR')
        : 'No especificada';

    return (
        <Document title={`Reporte SafeSpot - ${report.id}`}>
            <Page size="A4" style={styles.page}>
                {/* HEADER */}
                <View style={styles.header}>
                    <View style={styles.logoSection}>
                        <View style={styles.logoBox}>
                            <SafeSpotLogo />
                        </View>
                        <Text style={styles.brandName}>SafeSpot</Text>
                    </View>
                    <View style={styles.headerLabels}>
                        <Text style={styles.officialTitle}>Reporte Oficial de Incidente</Text>
                        <Text style={styles.officialSubtitle}>DOCUMENTO GENERADO AUTOMÁTICAMENTE</Text>
                    </View>
                </View>

                {/* INFO SECTION */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Datos del Reporte</Text>
                    <View style={styles.infoGrid}>
                        <View style={styles.infoItem}>
                            <Text style={styles.label}>ID del Reporte</Text>
                            <Text style={styles.value}>{report.id.toUpperCase()}</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.label}>Categoría</Text>
                            <Text style={styles.value}>{report.category}</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.label}>Estado Actual</Text>
                            <Text style={styles.value}>{(report.status || 'Activo').toUpperCase()}</Text>
                        </View>
                        <View style={styles.infoItem}>
                            <Text style={styles.label}>Fecha del Suceso</Text>
                            <Text style={styles.value}>{incidentDate}</Text>
                        </View>
                        <View style={[styles.infoItem, { width: '100%' }]}>
                            <Text style={styles.label}>Ubicación</Text>
                            <Text style={styles.value}>{report.address || report.zone || 'Ubicación no especificada'}</Text>
                        </View>
                    </View>
                </View>

                {/* DESCRIPTION SECTION */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Descripción de los Hechos</Text>
                    <View style={styles.descriptionBox}>
                        <Text>{report.description || 'El informante no ha brindado una descripción detallada en este reporte.'}</Text>
                    </View>
                </View>

                {/* IMAGES SECTION */}
                <View style={styles.section} break={false}>
                    <Text style={styles.sectionTitle}>Evidencia Fotográfica</Text>
                    {report.image_urls && report.image_urls.length > 0 ? (
                        <View style={styles.imageGrid}>
                            {report.image_urls.map((url, index) => (
                                <View key={index} style={styles.imageContainer}>
                                    <Image src={url} style={styles.image} />
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.emptyState}>El reporte no contiene imágenes adjuntas.</Text>
                    )}
                </View>

                {/* MAP SECTION (Optional but recommended) */}
                {report.latitude && report.longitude && (
                    <View style={styles.section} break={false}>
                        <Text style={styles.sectionTitle}>Ubicación Geográfica</Text>
                        <View style={[styles.imageContainer, { width: '100%', height: 200 }]}>
                            <Image
                                src={`https://static-maps.yandex.ru/1.x/?l=map&ll=${report.longitude},${report.latitude}&z=16&size=600,300&pt=${report.longitude},${report.latitude},pm2gnm`}
                                style={styles.image}
                            />
                        </View>
                    </View>
                )}

                {/* FOOTER */}
                <View style={styles.footer} fixed>
                    <Text style={styles.footerText}>
                        Este documento fue generado automáticamente por la plataforma SafeSpot el {generationDate}.
                        No contiene datos personales en cumplimiento con la política de anonimato de la plataforma.
                        Este documento es válido para ser presentado ante autoridades policiales o compañías de seguros.
                    </Text>
                    <Link
                        src={`https://safespot.tuweb-ai.com/reporte/${report.id}`}
                        style={styles.verificationLink}
                    >
                        Verificar reporte original: https://safespot.tuweb-ai.com/reporte/{report.id}
                    </Link>
                </View>

                <Text
                    style={styles.pageNumber}
                    render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
                    fixed
                />
            </Page>
        </Document>
    );
};
