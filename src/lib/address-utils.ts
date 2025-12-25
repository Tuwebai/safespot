/**
 * Address Utilities
 * 
 * Helper functions to normalize and format addresses for Argentina
 */

interface NominatimAddress {
  road?: string
  house_number?: string
  suburb?: string
  neighbourhood?: string
  city_district?: string
  city?: string
  state?: string
  province?: string
  country?: string
  [key: string]: string | undefined
}

interface NominatimReverseResult {
  address?: NominatimAddress
  display_name?: string
}

/**
 * Normalizes an address from Nominatim to a short, human-readable format
 * Returns: "Calle + número, Barrio, Ciudad, Provincia"
 * Removes: country, administrative divisions, postal codes, etc.
 */
export function normalizeAddress(result: NominatimReverseResult | { display_name: string; address?: NominatimAddress }): string {
  if (!result.address && result.display_name) {
    // If we only have display_name, try to clean it up
    return cleanDisplayName(result.display_name)
  }

  if (!result.address) {
    return ''
  }

  const addr = result.address
  const parts: string[] = []

  // 1. Street + number (if available)
  if (addr.road) {
    const streetPart = addr.house_number 
      ? `${addr.road} ${addr.house_number}`
      : addr.road
    parts.push(streetPart)
  }

  // 2. Neighborhood/Suburb (if available and not already in street)
  const neighborhood = addr.neighbourhood || addr.suburb || addr.city_district
  if (neighborhood && !parts.some(p => p.toLowerCase().includes(neighborhood.toLowerCase()))) {
    parts.push(neighborhood)
  }

  // 3. City (required)
  const city = addr.city || addr.town || addr.village
  if (city) {
    parts.push(city)
  }

  // 4. Province/State (if available and different from city)
  const province = addr.state || addr.province
  if (province && city && province.toLowerCase() !== city.toLowerCase()) {
    // Only add if it's different from city (e.g., "Buenos Aires" city vs "Buenos Aires" province)
    // For CABA, we might have both "Ciudad Autónoma de Buenos Aires" and "Buenos Aires"
    if (!city.toLowerCase().includes('buenos aires') || !province.toLowerCase().includes('buenos aires')) {
      parts.push(province)
    }
  }

  // Join parts with commas
  const normalized = parts.join(', ')

  // If we got something, return it; otherwise try to clean display_name
  if (normalized.length > 0) {
    return normalized
  }

  // Fallback: clean display_name
  if (result.display_name) {
    return cleanDisplayName(result.display_name)
  }

  return ''
}

/**
 * Cleans a display_name string to remove unnecessary parts
 */
function cleanDisplayName(displayName: string): string {
  if (!displayName) return ''

  // Remove country (always Argentina)
  let cleaned = displayName.replace(/,?\s*Argentina\s*,?/gi, '').trim()
  
  // Remove postal codes (numbers at the end)
  cleaned = cleaned.replace(/,\s*\d{4,8}\s*$/g, '').trim()
  
  // Remove administrative divisions that are redundant
  // Remove "Departamento", "Pedanía", "Región", etc.
  cleaned = cleaned.replace(/,\s*(Departamento|Pedanía|Región|Distrito|Partido)\s+[^,]+/gi, '').trim()
  
  // Remove trailing commas
  cleaned = cleaned.replace(/,\s*$/, '').trim()
  
  return cleaned
}

/**
 * Normalizes a search result from Nominatim autocomplete
 * Similar to normalizeAddress but for search results
 */
export function normalizeSearchResult(displayName: string): string {
  return cleanDisplayName(displayName)
}

