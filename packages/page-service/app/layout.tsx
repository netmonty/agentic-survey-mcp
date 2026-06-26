import type { Metadata } from 'next';
import {
  Fraunces,
  Hanken_Grotesk,
  Space_Grotesk,
  Outfit,
  JetBrains_Mono,
  IBM_Plex_Mono,
  Quicksand,
  Nunito,
  Playfair_Display,
  Jost,
} from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { getBrand, getTheme } from '@/lib/branding';

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});
const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-hanken',
  display: 'swap',
});

// Optional theme fonts (one theme is active per deployment, so don't eagerly
// preload these — they download only when the active theme actually uses them).
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space',
  display: 'swap',
  preload: false,
});
const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-outfit',
  display: 'swap',
  preload: false,
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetmono',
  display: 'swap',
  preload: false,
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-mono',
  display: 'swap',
  preload: false,
});
const quicksand = Quicksand({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-quicksand',
  display: 'swap',
  preload: false,
});
const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-nunito',
  display: 'swap',
  preload: false,
});
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
  preload: false,
});
const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-jost',
  display: 'swap',
  preload: false,
});

const themeFontVars = [
  spaceGrotesk.variable,
  outfit.variable,
  jetbrainsMono.variable,
  plexMono.variable,
  quicksand.variable,
  nunito.variable,
  playfair.variable,
  jost.variable,
].join(' ');

export const metadata: Metadata = {
  title: 'Survey',
  description: 'Complete this survey.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const brand = getBrand();
  const theme = getTheme();
  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${fraunces.variable} ${hanken.variable} ${GeistSans.variable} ${GeistMono.variable} ${themeFontVars}`}
    >
      <body className="relative min-h-dvh">
        {theme === 'editorial' && (
          <div aria-hidden className="grain pointer-events-none fixed inset-0 -z-10 opacity-[0.035]" />
        )}
        <main className="container flex min-h-dvh flex-col justify-center py-10 sm:py-16">
          {children}
        </main>
        <footer className="container pb-10 text-center text-xs tracking-wide text-muted-foreground">
          {brand.url ? (
            <a href={brand.url} className="underline-offset-4 transition-colors hover:text-foreground hover:underline">
              Powered by {brand.name}
            </a>
          ) : (
            <span>Powered by {brand.name}</span>
          )}
        </footer>
      </body>
    </html>
  );
}
