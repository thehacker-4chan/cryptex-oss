/**
 * Google Analytics 4 — consent-gated, env-gated, SPA-aware.
 *
 *   1. Build-time env: PUBLIC_GA_ID must be set (e.g. "G-XXXXXXXX"). Self-
 *      hosted deploys with it unset never load any tracker, never call gtag.
 *   2. Runtime consent: consent.accepted must be true. Otherwise the script
 *      tag is removed and no events fire.
 *   3. Manual page-view tracking (SvelteKit is an SPA). We disable GA4's
 *      automatic send_page_view and call config -> page_view ourselves on
 *      every navigation so the URL/title actually update per route.
 *
 * The shape mirrors $lib/ads/adsense.svelte.ts on purpose — same consent
 * gate, same idempotent ensure() function.
 */

import { browser } from '$app/environment';
import { consent } from '$lib/stores/consent.svelte';

const SCRIPT_ID = 'cryptex-ga-script';

/** True when this build was compiled with a GA measurement ID. */
export function isGaConfigured(): boolean {
  if (typeof import.meta.env === 'undefined') return false;
  return !!import.meta.env.PUBLIC_GA_ID;
}

/** Measurement ID, or empty string. */
export function getGaId(): string {
  return import.meta.env.PUBLIC_GA_ID ?? '';
}

function scriptElement(): HTMLScriptElement | null {
  if (!browser) return null;
  return document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
}

interface GtagWindow extends Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dataLayer?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gtag?: (...args: any[]) => void;
}

function loadScript(): void {
  if (!browser) return;
  if (scriptElement()) return;

  const id = getGaId();
  if (!id) return;

  const w = window as GtagWindow;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  w.dataLayer = w.dataLayer || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  w.gtag = function gtag(..._args: any[]) {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments);
  };
  w.gtag('js', new Date());
  w.gtag('config', id, {
    // SPA: we'll fire page_view manually per navigation.
    send_page_view: false,
    // GDPR-friendly defaults — anonymize IP, do not pass click IDs to ads.
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  // Optional Subresource Integrity. GA's gtag.js body rotates regularly,
  // so we don't bundle a static hash — operators set
  // `PUBLIC_GA_SRI=sha384-<base64>` at build time after fetching the live
  // body and computing the hash. When unset (default), no integrity attr
  // is set and the script loads normally.
  const sri = import.meta.env.PUBLIC_GA_SRI;
  if (typeof sri === 'string' && sri.startsWith('sha')) {
    script.integrity = sri;
    script.crossOrigin = 'anonymous';
  }
  document.head.appendChild(script);
}

function unloadScript(): void {
  if (!browser) return;
  const el = scriptElement();
  if (el) el.remove();
  const w = window as GtagWindow;
  // Wipe the queue so no further events accumulate.
  w.dataLayer = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  w.gtag = function gtag(..._args: any[]) { /* noop after unload */ };
}

/**
 * Reconcile the DOM script tag with the current consent + env state.
 * Idempotent — safe to call from layout mount + every consent flip.
 */
export function ensureGaState(): void {
  if (!isGaConfigured()) {
    unloadScript();
    return;
  }
  if (consent.accepted) loadScript();
  else unloadScript();
}

/**
 * Fire a page_view event for the given URL. Safe to call regardless of
 * consent — does nothing if gtag isn't loaded.
 */
export function trackPageView(url: string, title?: string): void {
  if (!browser) return;
  if (!isGaConfigured() || !consent.accepted) return;
  const w = window as GtagWindow;
  if (typeof w.gtag !== 'function') return;
  w.gtag('event', 'page_view', {
    page_location: url,
    page_title: title ?? document.title,
    page_path: new URL(url, window.location.origin).pathname
  });
}
