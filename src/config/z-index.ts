/**
 * 🎯 SAFE SPOT Z-INDEX SYSTEM
 * 
 * REGLAS INQUEBRANTABLES:
 * 1. NUNCA usar valores arbitrarios (z-[9999], z-[10001], etc.)
 * 2. SIEMPRE importar desde este archivo
 * 3. Cada capa tiene propósito definido y documentado
 * 4. Separar siempre backdrop de content
 * 
 * Estructura:
 * - Base (0-10): Contenido normal
 * - Navigation (10-20): Headers, navs, sidebars
 * - Components (20-30): Dropdowns, tooltips, popovers
 * - Modals (30-40): Ventanas modales estándar
 * - Sheets (40-50): Bottom sheets, drawers mobile
 * - System (50-60): Toasts, notificaciones
 * - Dialogs (60-70): Confirmaciones, auth required
 * - Emergency (70-80): Errores críticos, loading
 * - Max (80-90): Tour, dev tools
 */

export const Z_INDEX = {
  // Base Layer - Contenido normal (0-10)
  BASE: 0,
  CONTENT: 1,
  
  // Navigation Layer - Headers, navs, sidebars (10-20)
  HEADER: 10,
  BOTTOM_NAV: 10,
  SIDEBAR: 15,
  
  // Drawer Layer - Mobile drawers (20-30)
  DRAWER_BACKDROP: 20,
  DRAWER_CONTENT: 25,
  
  // Sheet Layer - Bottom sheets (30-40)
  SHEET_BACKDROP: 30,
  SHEET_CONTENT: 35,
  
  // Modal Layer - Ventanas modales estándar (40-50)
  MODAL_BACKDROP: 40,
  MODAL_CONTENT: 45,
  
  // System Layer - Toasts, notificaciones (50-60)
  TOAST: 50,
  NOTIFICATION: 55,
  NETWORK_STATUS: 58,
  
  // Dialog Layer - Confirmaciones, auth required (60-70)
  CONFIRMATION_BACKDROP: 60,
  CONFIRMATION_CONTENT: 65,
  AUTH_REQUIRED_BACKDROP: 60,
  AUTH_REQUIRED_CONTENT: 65,
  
  // Floating Components Layer - DROPDOWNS, tooltips, popovers (70-80)
  // 💡 CRÍTICO: Estos elementos siempre se portalean a document.body
  // y deben estar sobre TODOS los modales, drawers y sheets
  // Ver: https://github.com/radix-ui/primitives/issues/1159
  DROPDOWN: 75,
  POPOVER: 76,
  REACTION_PICKER: 77,
  TOOLTIP: 80,
  
  // Emergency Layer - Errores críticos, loading (80-90)
  EMERGENCY_BACKDROP: 80,
  EMERGENCY_CONTENT: 85,
  LOADING_OVERLAY: 88,
  
  // Max Layer - Tour, dev tools, canvas effects (90-100)
  TOUR_OVERLAY: 90,
  DEV_TOOLS: 100,
  MAX: 100,
} as const;

/**
 * Helper para generar clases de Tailwind con z-index
 * @example zIndexClass(Z_INDEX.MODAL_CONTENT) → "z-[35]"
 */
export function zIndexClass(z: number): string {
  return `z-[${z}]`;
}

/**
 * Helper para aplicar z-index en estilos inline
 * @example styleZIndex(Z_INDEX.MODAL_CONTENT) → { zIndex: 35 }
 */
export function styleZIndex(z: number): { zIndex: number } {
  return { zIndex: z };
}

/**
 * Obtiene los z-index para un overlay con backdrop y content
 * @param layer - Capa del sistema
 * @returns Objeto con backdrop y content z-index
 */
export function getOverlayZIndex(layer: 'drawer' | 'modal' | 'sheet' | 'confirmation' | 'emergency'): {
  backdrop: number;
  content: number;
} {
  const layers = {
    drawer: { backdrop: Z_INDEX.DRAWER_BACKDROP, content: Z_INDEX.DRAWER_CONTENT },
    modal: { backdrop: Z_INDEX.MODAL_BACKDROP, content: Z_INDEX.MODAL_CONTENT },
    sheet: { backdrop: Z_INDEX.SHEET_BACKDROP, content: Z_INDEX.SHEET_CONTENT },
    confirmation: { backdrop: Z_INDEX.CONFIRMATION_BACKDROP, content: Z_INDEX.CONFIRMATION_CONTENT },
    emergency: { backdrop: Z_INDEX.EMERGENCY_BACKDROP, content: Z_INDEX.EMERGENCY_CONTENT },
  };
  
  return layers[layer];
}
