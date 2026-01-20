/// <reference types="vite/client" />


interface ImportMetaEnv {
    readonly PACKAGE_VERSION: string;
    readonly APP_VERSION: string;
    readonly APP_BUILD_HASH: string;
    readonly APP_BUILD_TIME: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

/**
 * Injected by Vite at build time
 * Format: "2.4.0-pro_1705432100000"
 */
declare const __SW_VERSION__: string;
