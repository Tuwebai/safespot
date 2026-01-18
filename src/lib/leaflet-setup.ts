import L from 'leaflet';

import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

/**
 * CRITICAL: Global Leaflet Icon Maintenance
 * This ensures that valid default icons are always present.
 * Prevents "iconUrl not set in Icon options" crashes.
 */
export const initializeLeafletIcons = () => {
    if (typeof window === 'undefined') return;

    // Remove the internal getter that causes issues with bundlers
    // @ts-expect-error - Leaflet internals
    delete L.Icon.Default.prototype._getIconUrl;

    // Set reliable default options using imported assets (handled by Vite/Webpack)
    L.Icon.Default.mergeOptions({
        iconRetinaUrl,
        iconUrl,
        shadowUrl,
    });
};
