import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title?: string;
    description?: string;
    keywords?: string[];
    image?: string;
    url?: string;
    type?: 'website' | 'article' | 'profile';
    author?: string;
    structuredData?: Record<string, any>;
}

export const SEO = ({
    title,
    description,
    keywords,
    image,
    url,
    type = 'website',
    author,
    structuredData
}: SEOProps) => {
    const siteTitle = 'SafeSpot';
    const fullTitle = title ? `${title} | ${siteTitle}` : `${siteTitle} - Red de Seguridad Ciudadana`;

    const defaultDescription = 'La red comunitaria de seguridad ciudadana más grande. Reporta robos, visualiza alertas de incidentes en tu zona y cuidá a tu barrio con información en tiempo real.';
    const metaDescription = description || defaultDescription;

    const siteUrl = 'https://safespot.app'; // Replace with actual production URL
    const currentUrl = url || siteUrl;
    const defaultImage = '/og-image.png'; // Make sure this exists in public/
    const metaImage = image || `${siteUrl}${defaultImage}`;

    const defaultKeywords = ['seguridad', 'vecinos', 'alertas', 'robos', 'mapa del delito', 'argentina', 'safespot', 'seguridad ciudadana'];
    const metaKeywords = keywords ? [...defaultKeywords, ...keywords].join(', ') : defaultKeywords.join(', ');

    return (
        <Helmet>
            {/* Basic Meta Tags */}
            <title>{fullTitle}</title>
            <meta name="description" content={metaDescription} />
            <meta name="keywords" content={metaKeywords} />
            {author && <meta name="author" content={author} />}

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={type} />
            <meta property="og:url" content={currentUrl} />
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={metaDescription} />
            <meta property="og:image" content={metaImage} />
            <meta property="og:site_name" content={siteTitle} />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:url" content={currentUrl} />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={metaDescription} />
            <meta name="twitter:image" content={metaImage} />

            {/* Canonical */}
            <link rel="canonical" href={currentUrl} />

            {/* JSON-LD Structured Data */}
            {structuredData && (
                <script type="application/ld+json">
                    {JSON.stringify(structuredData)}
                </script>
            )}
        </Helmet>
    );
};
