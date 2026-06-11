import type { Metadata } from 'next';
import { Fraunces, Hanken_Grotesk, Sora, JetBrains_Mono } from 'next/font/google';
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
const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sora',
  display: 'swap',
});
const jbMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jbmono',
  display: 'swap',
});

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
      className={`${fraunces.variable} ${hanken.variable} ${sora.variable} ${jbMono.variable}`}
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
