import { z } from 'zod';
import { VALIDATION } from '../config/constants.js';

/**
 * Common regex and constants
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Report Validation Schema
 */
export const reportSchema = z.object({
    id: z.string().regex(UUID_REGEX, 'ID no válido (UUID)').optional(), // ✅ Client-Generated ID Support
    title: z.string()
        .min(3, 'El título es muy corto (mínimo 3 caracteres)')
        .max(100, 'El título es muy largo (máximo 100 caracteres)')
        .trim(),
    description: z.string()
        .min(10, 'La descripción debe tener al menos 10 caracteres')
        .max(VALIDATION.MAX_DESCRIPTION_LENGTH, 'La descripción es muy larga')
        .trim(),
    category: z.enum(['Celulares', 'Bicicletas', 'Motos', 'Autos', 'Laptops', 'Carteras'], {
        errorMap: () => ({ message: 'Categoría no válida' })
    }),
    latitude: z.number()
        .min(-90, 'Latitud fuera de rango (-90 a 90)')
        .max(90, 'Latitud fuera de rango (-90 a 90)'),
    longitude: z.number()
        .min(-180, 'Longitud fuera de rango (-180 a 180)')
        .max(180, 'Longitud fuera de rango (-180 a 180)'),
    address: z.string().optional().nullable(),
    zone: z.string().optional().nullable(),
    incident_date: z.string().datetime({ message: 'Fecha de incidente inválida (ISO 8601)' }).optional(),
    status: z.enum(['abierto', 'en_progreso', 'resuelto', 'verificado', 'rechazado', 'archivado']).default('abierto'),
    image_urls: z.array(z.string().url('URL de imagen no válida')).optional().default([])
});

/**
 * Comment Validation Schema
 */
export const commentSchema = z.object({
    id: z.string().regex(UUID_REGEX, 'ID no válido (UUID)').optional(), // ✅ Client-Generated ID Support
    content: z.string()
        .min(1, 'El comentario no puede estar vacío')
        .max(5000, 'El comentario es muy largo (máximo 5000 caracteres)')
        .trim(),
    report_id: z.string().regex(UUID_REGEX, 'ID de reporte no válido (UUID)'),
    parent_id: z.string().regex(UUID_REGEX, 'ID de padre no válido (UUID)').optional().nullable(),
    is_thread: z.boolean().optional().default(false)
});

/**
 * Comment Update Validation Schema
 */
export const commentUpdateSchema = z.object({
    content: z.string()
        .min(1, 'El comentario no puede estar vacío')
        .max(5000, 'El comentario es muy largo (máximo 5000 caracteres)')
        .trim()
});

/**
 * Geographic Query Schema
 */
export const geoQuerySchema = z.object({
    lat: z.coerce.number()
        .min(-90, 'Latitud inválida')
        .max(90, 'Latitud inválida'),
    lng: z.coerce.number()
        .min(-180, 'Longitud inválida')
        .max(180, 'Longitud inválida'),
    radius_meters: z.coerce.number()
        .min(50, 'El radio mínimo es 50m')
        .max(10000, 'El radio máximo es 10km')
        .default(1000)
});

/**
 * User Zone Schema
 */
export const userZoneSchema = z.object({
    type: z.string().min(1, 'El tipo es requerido').max(20).trim(),
    lat: z.coerce.number().min(-90, 'Latitud inválida').max(90, 'Latitud inválida'),
    lng: z.coerce.number().min(-180, 'Longitud inválida').max(180, 'Longitud inválida'),
    radius_meters: z.coerce.number().min(100, 'El radio mínimo es 100m').max(10000, 'El radio máximo es 10km').default(500),
    label: z.string().max(50, 'Etiqueta muy larga').trim().optional().nullable()
});

/**
 * Geocode Search Schema
 */
export const geocodeSearchSchema = z.object({
    q: z.string().min(1, 'La búsqueda no puede estar vacía').max(200).trim(),
    limit: z.coerce.number().min(1).max(10).default(5),
    countrycodes: z.string().optional().default('ar')
});

/**
 * Reverse Geocode Schema
 */
export const reverseGeocodeSchema = z.object({
    lat: z.coerce.number().min(-90, 'Latitud inválida').max(90, 'Latitud inválida'),
    lon: z.coerce.number().min(-180, 'Longitud inválida').max(180, 'Longitud inválida')
});

/**
 * Vote Validation Schema
 */
export const voteSchema = z.object({
    report_id: z.string().regex(UUID_REGEX, 'ID de reporte no válido').optional().nullable(),
    comment_id: z.string().regex(UUID_REGEX, 'ID de comentario no válido').optional().nullable()
}).refine(data => (!!data.report_id || !!data.comment_id) && !(!!data.report_id && !!data.comment_id), {
    message: 'Debe proporcionar report_id o comment_id, pero no ambos'
});
