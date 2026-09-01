/** Build-time app version from package.json (`vite.config.ts`). */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION;

/** True only when built with VITE_CHANNEL=beta. Live production leaves this unset. */
export const IS_BETA: boolean = import.meta.env.VITE_CHANNEL === "beta";
