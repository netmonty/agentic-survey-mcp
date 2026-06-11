/**
 * Brand + theme for the hosting instance, from env. The author's hosted
 * deployment sets these; self-hosters set their own (or none → defaults).
 * Per-survey branding (logo/colour) comes from the survey's own config.theme.
 */
export interface Brand {
  name: string;
  logoUrl?: string;
  url?: string;
}

export function getBrand(): Brand {
  return {
    name: process.env.BRAND_NAME || 'Agentic Survey',
    logoUrl: process.env.BRAND_LOGO_URL || undefined,
    url: process.env.BRAND_URL || undefined,
  };
}

/** Built-in visual themes. Selected deployment-wide via BRAND_THEME. */
export type ThemeName = 'editorial' | 'charcoal';
export const THEMES: ThemeName[] = ['editorial', 'charcoal'];

export function getTheme(): ThemeName {
  const t = (process.env.BRAND_THEME || '').toLowerCase();
  return (THEMES as string[]).includes(t) ? (t as ThemeName) : 'editorial';
}
