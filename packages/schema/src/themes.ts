/**
 * Built-in visual themes for the public survey page (the page-service).
 *
 * Important: the page-service ships the CSS for every theme. A survey only ever
 * stores the theme *name* (in `surveys.config.themeName`); whichever page-service
 * renders the share link — hosted or self-hosted — maps that name to its built-in
 * `[data-theme]` styles. No CSS travels through the MCP server or the database.
 *
 * This file is the shared source of truth for the valid names + the agent-facing
 * catalog. The page-service keeps its own copy of the names (it builds as a
 * standalone app and must not import this package) — keep the two in sync.
 */

export const THEME_NAMES = [
  'editorial',
  'charcoal',
  'aurora',
  'phosphor',
  'dreamcloud',
  'noir',
] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

/**
 * Applied when a survey sets no `themeName` AND the deployment sets no
 * `BRAND_THEME`. Per-survey `themeName` takes precedence over the deployment's
 * `BRAND_THEME`, which in turn takes precedence over this.
 */
export const DEFAULT_THEME: ThemeName = 'editorial';

export interface ThemeInfo {
  name: ThemeName;
  /** Human title for UIs. */
  title: string;
  /** What it feels like + when to reach for it — written to help an agent choose. */
  description: string;
}

/** Agent-facing catalog: the look of each theme and what it suits. */
export const THEME_CATALOG: ThemeInfo[] = [
  {
    name: 'editorial',
    title: 'Editorial',
    description:
      'Warm paper, burnt-clay accent, a literary serif. Calm, considered, trustworthy. The default — a safe choice for most surveys, and good for thoughtful or long-form ones.',
  },
  {
    name: 'charcoal',
    title: 'Charcoal',
    description:
      'Monochrome charcoal on a faint technical grid; compact and modern. Neutral and understated — good for developer, product, or technical audiences.',
  },
  {
    name: 'aurora',
    title: 'Aurora',
    description:
      'Luminous violet-to-cyan glassmorphism with a frosted card. Futuristic, premium, energetic — good for product launches, tech, and creative work.',
  },
  {
    name: 'phosphor',
    title: 'Phosphor',
    description:
      'A black CRT terminal in phosphor green: all-monospace, hard edges, scanlines, a blinking cursor. Retro-hacker and playful — good for developer tools, games, and hackathons.',
  },
  {
    name: 'dreamcloud',
    title: 'Dreamcloud',
    description:
      'Soft pastel lavender and blush, very rounded and airy. Gentle, friendly, delightful — good for community, wellness, education, and lighthearted surveys.',
  },
  {
    name: 'noir',
    title: 'Noir Luxe',
    description:
      'Champagne gold on emerald-black with an elegant serif. Refined, hushed, expensive — good for events, hospitality, luxury, and RSVPs.',
  },
];

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && (THEME_NAMES as readonly string[]).includes(value);
}
