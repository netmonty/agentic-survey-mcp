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

export function buildShareUrl(link: LinkConfig, surveyId: string): string {
  const base = link.pageEndpoint.replace(/\/+$/, '');
  const key = encodeURIComponent(link.publishableKey);
  return `${base}/s/${link.projectRef}/${surveyId}#k=${key}`;
}
