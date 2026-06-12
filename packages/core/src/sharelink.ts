/**
 * Pure share-link construction. `core` stays free of endpoint/key config by
 * taking it as an argument. The publishable key is client-safe (RLS-fenced)
 * and travels with the link — see docs/trust-model.md.
 */
export interface LinkConfig {
  /** Page-service base URL, e.g. https://pages.example.com */
  pageEndpoint: string;
  /** The user's Supabase project ref. */
  projectRef: string;
  /** The user's client-safe publishable key (sb_publishable_…). */
  publishableKey: string;
}

export function buildShareUrl(link: LinkConfig, surveyId: string, title?: string): string {
  const base = link.pageEndpoint.replace(/\/+$/, '');
  const key = encodeURIComponent(link.publishableKey);
  // The survey title rides in the query string (server-visible, unlike the
  // fragment) so link-preview crawlers can render it as the card title without
  // ever needing the key. Capped to keep URLs sane; previews truncate anyway.
  const t = title?.trim() ? `?t=${encodeURIComponent(title.trim().slice(0, 150))}` : '';
  return `${base}/s/${link.projectRef}/${surveyId}${t}#k=${key}`;
}
