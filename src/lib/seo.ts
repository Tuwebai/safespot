/**
 * Centralized SEO utility for SafeSpot
 * Generates consistent metadata across all pages
 */

export interface SEOConfig {
    title: string
    description: string
    canonical?: string
    image?: string
    imageAlt?: string
    type?: 'website' | 'article'
    publishedTime?: string
    modifiedTime?: string
    author?: string
    section?: string
    tags?: string[]
}

export interface SEOTags {
    // Basic
    title: string
    description: string
    canonical: string

    // Open Graph
    ogType: string
    ogUrl: string
    ogTitle: string
    ogDescription: string
    ogImage: string
    ogImageWidth: string
    ogImageHeight: string
    ogImageAlt: string
    ogSiteName: string
    ogLocale: string

    // Twitter
    twitterCard: string
    twitterTitle: string
    twitterDescription: string
    twitterImage: string
    twitterImageAlt: string

    // Article-specific (optional)
    articlePublishedTime?: string
    articleModifiedTime?: string
    articleAuthor?: string
    articleSection?: string
    articleTags?: string[]
}

const BASE_URL = 'https://safespot.netlify.app'
const DEFAULT_IMAGE = `${BASE_URL}/og-default.png`
const SITE_NAME = 'SafeSpot'
const LOCALE = 'es_AR'

export function generateSEOTags(config: SEOConfig): SEOTags {
    const canonical = config.canonical || (typeof window !== 'undefined' ? window.location.href : BASE_URL)
    const image = config.image || DEFAULT_IMAGE
    const imageAlt = config.imageAlt || config.title

    const tags: SEOTags = {
        // Basic
        title: config.title,
        description: config.description,
        canonical,

        // Open Graph
        ogType: config.type || 'website',
        ogUrl: canonical,
        ogTitle: config.title,
        ogDescription: config.description,
        ogImage: image,
        ogImageWidth: '1200',
        ogImageHeight: '630',
        ogImageAlt: imageAlt,
        ogSiteName: SITE_NAME,
        ogLocale: LOCALE,

        // Twitter
        twitterCard: 'summary_large_image',
        twitterTitle: config.title,
        twitterDescription: config.description,
        twitterImage: image,
        twitterImageAlt: imageAlt,
    }

    // Add article-specific tags if type is article
    if (config.type === 'article') {
        if (config.publishedTime) tags.articlePublishedTime = config.publishedTime
        if (config.modifiedTime) tags.articleModifiedTime = config.modifiedTime
        if (config.author) tags.articleAuthor = config.author
        if (config.section) tags.articleSection = config.section
        if (config.tags) tags.articleTags = config.tags
    }

    return tags
}

/**
 * Generate JSON-LD structured data for a report
 */
export function generateReportStructuredData(report: {
    id: string
    title: string
    description: string
    category: string
    created_at: string
    updated_at: string
    image_urls?: string[]
    latitude?: number
    longitude?: number
    locality?: string
    zone?: string
    province?: string
}) {
    return {
        "@context": "https://schema.org",
        "@type": "Report",
        "headline": report.title,
        "description": report.description,
        "datePublished": report.created_at,
        "dateModified": report.updated_at,
        "author": {
            "@type": "Organization",
            "name": "SafeSpot Community"
        },
        "publisher": {
            "@type": "Organization",
            "name": SITE_NAME,
            "logo": {
                "@type": "ImageObject",
                "url": `${BASE_URL}/logo.png`
            }
        },
        "image": report.image_urls?.[0] || DEFAULT_IMAGE,
        "locationCreated": {
            "@type": "Place",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": report.locality || report.zone,
                "addressRegion": report.province || "Argentina"
            },
            ...(report.latitude && report.longitude && {
                "geo": {
                    "@type": "GeoCoordinates",
                    "latitude": report.latitude,
                    "longitude": report.longitude
                }
            })
        },
        "about": {
            "@type": "Thing",
            "name": report.category
        }
    }
}

/**
 * Truncate text to fit within SEO limits
 */
export function truncateForSEO(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength - 3) + '...'
}

/**
 * Generate SEO-friendly title (max 60 chars)
 */
export function generateTitle(title: string, suffix = '– SafeSpot'): string {
    const maxLength = 60
    const suffixLength = suffix.length + 1 // +1 for space
    const maxTitleLength = maxLength - suffixLength

    if (title.length + suffixLength <= maxLength) {
        return `${title} ${suffix}`
    }

    return `${truncateForSEO(title, maxTitleLength)} ${suffix}`
}

/**
 * Generate SEO-friendly description (max 160 chars)
 */
export function generateDescription(description: string): string {
    return truncateForSEO(description, 160)
}
