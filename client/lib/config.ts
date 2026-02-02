/**
 * App and API URLs for the Tax Reports portal.
 * - Frontend: https://tax-reports-web.onrender.com
 * - Backend:  https://tax-reports-api.onrender.com
 */

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://tax-reports-web.onrender.com";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://tax-reports-api.onrender.com";

/** Base URL for API requests (no trailing slash) */
export function apiBase(): string {
  return API_URL.replace(/\/$/, "");
}

/** Full URL for an API path, e.g. apiPath('/auth/otp') */
export function apiPath(path: string): string {
  const base = apiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
