/**
 * Zone Utilities
 * 
 * Helper functions to determine zone from location data
 */

import { ZONES, type Zone } from './constants'
import type { LocationData } from '@/components/LocationSelector'
import { handleErrorSilently } from './errorHandler'

/**
 * Interface for Nominatim reverse geocoding result
 */
interface NominatimReverseResult {
  address?: {
    suburb?: string
    neighbourhood?: string
    city_district?: string
    district?: string
    city?: string
    state?: string
    country?: string
    [key: string]: string | undefined
  }
  display_name?: string
}

/**
 * Determines zone from location name by searching for zone keywords
 */
function extractZoneFromName(locationName: string): Zone | null {
  const nameLower = locationName.toLowerCase()
  
  // Keywords that might indicate zones
  const zoneKeywords: Record<Zone, string[]> = {
    'Centro': ['centro', 'downtown', 'caba', 'microcentro', 'casco histórico'],
    'Norte': ['norte', 'north', 'nord', 'nordeste', 'noroeste', 'north zone'],
    'Sur': ['sur', 'south', 'sud', 'sureste', 'suroeste', 'south zone'],
    'Este': ['este', 'east', 'est', 'este zone', 'east zone'],
    'Oeste': ['oeste', 'west', 'oest', 'west zone', 'oeste zone']
  }
  
  for (const [zone, keywords] of Object.entries(zoneKeywords)) {
    if (keywords.some(keyword => nameLower.includes(keyword))) {
      return zone as Zone
    }
  }
  
  return null
}

/**
 * Determines zone from coordinates using approximate cardinal direction mapping
 * This is a fallback for when reverse geocoding doesn't provide clear zone info
 * 
 * Uses a simple approach: determines cardinal direction from a reference point
 * For a more accurate implementation, you would need actual city boundary data
 */
function determineZoneFromCoordinates(latitude: number, longitude: number): Zone {
  // Reference point (can be city center or a known central location)
  // Default: Buenos Aires city center (-34.6037, -58.3816)
  // Adjust these values based on your target city's center
  const CITY_CENTER_LAT = -34.6037
  const CITY_CENTER_LON = -58.3816
  
  // Calculate differences
  const latDiff = latitude - CITY_CENTER_LAT
  const lonDiff = longitude - CITY_CENTER_LON
  
  // Determine primary direction (N/S vs E/W)
  const absLatDiff = Math.abs(latDiff)
  const absLonDiff = Math.abs(lonDiff)
  
  // If very close to center, default to Centro
  if (absLatDiff < 0.01 && absLonDiff < 0.01) {
    return 'Centro'
  }
  
  // Determine zone based on which direction is more significant
  if (absLatDiff > absLonDiff) {
    // North-South is more significant
    return latDiff > 0 ? 'Norte' : 'Sur'
  } else {
    // East-West is more significant
    return lonDiff > 0 ? 'Este' : 'Oeste'
  }
}

/**
 * Performs reverse geocoding to get detailed address information
 */
async function reverseGeocode(latitude: number, longitude: number): Promise<NominatimReverseResult | null> {
  try {
    // CRITICAL: Restrict to Argentina (countrycodes=ar)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&countrycodes=ar`,
      {
        headers: {
          'User-Agent': 'SafeSpot App'
        }
      }
    )
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    
    // Extra validation: ensure result is from Argentina
    if (data.address?.country && !data.address.country.toLowerCase().includes('argentina')) {
      console.debug('Reverse geocode result not from Argentina, ignoring')
      return null
    }
    
    return data as NominatimReverseResult
  } catch (error) {
    // Non-critical error, log but don't show to user
    handleErrorSilently(error, 'zone-utils.reverseGeocode')
    return null
  }
}

/**
 * Determines zone from location data
 * 
 * Strategy:
 * 1. Try to extract zone from location name
 * 2. If coordinates available, try reverse geocoding
 * 3. If reverse geocoding fails, use coordinate-based mapping
 * 4. Validate that result is a valid zone
 * 
 * @param location - Location data with name and optional coordinates
 * @returns Zone or null if cannot be determined
 */
export async function determineZone(location: LocationData): Promise<Zone | null> {
  // First, try to extract from location name
  if (location.location_name) {
    const zoneFromName = extractZoneFromName(location.location_name)
    if (zoneFromName && ZONES.includes(zoneFromName)) {
      return zoneFromName
    }
  }
  
  // If we have coordinates, try reverse geocoding
  if (location.latitude !== undefined && location.longitude !== undefined) {
    const reverseResult = await reverseGeocode(location.latitude, location.longitude)
    
    if (reverseResult?.address) {
      const address = reverseResult.address
      
      // Try to extract zone from address fields
      const addressText = [
        address.suburb,
        address.neighbourhood,
        address.city_district,
        address.district,
        address.city,
        reverseResult.display_name
      ].filter(Boolean).join(' ').toLowerCase()
      
      const zoneFromAddress = extractZoneFromName(addressText)
      if (zoneFromAddress && ZONES.includes(zoneFromAddress)) {
        return zoneFromAddress
      }
    }
    
    // Fallback: use coordinate-based mapping
    return determineZoneFromCoordinates(location.latitude, location.longitude)
  }
  
  // If no coordinates and name doesn't contain zone info, return null
  return null
}

/**
 * Validates that a zone string is a valid zone
 */
export function isValidZone(zone: string | null | undefined): zone is Zone {
  if (!zone || typeof zone !== 'string') {
    return false
  }
  return ZONES.includes(zone as Zone)
}

