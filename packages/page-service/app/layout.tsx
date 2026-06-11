import type { Metadata } from 'next';
import './globals.css';
import { getBrand } from '@/lib/branding';

export const metadata: Metadata = {
  title: 'Survey',
  description: 'Complete this survey.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const brand = getBrand();
  return (
    <html lang="en">
      <body className="min-h-dvh bg-secondary/30">
        <main className="container py-8 sm:py-14">{children}</main>
        <footer className="container pb-10 pt-2 text-center text-xs text-muted-foreground">
          {brand.url ? (
            <a href={brand.url} className="hover:underline">
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
