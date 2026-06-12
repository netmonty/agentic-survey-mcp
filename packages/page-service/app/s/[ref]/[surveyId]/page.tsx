import type { Metadata } from 'next';
import { getBrand } from '@/lib/branding';
import { SurveyClient } from './survey-client';

// This service's own origin, so the /og image resolves to an absolute URL in
// the OpenGraph/Twitter tags. On Vercel these env vars are populated
// automatically; locally we fall back to the dev server.
function metadataBase(): URL {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return new URL(host ? `https://${host}` : 'http://localhost:3000');
}

// Server-rendered so link-preview crawlers (which don't run JS and never see
// the #k= fragment) get a real title + image. The survey name arrives in the
// ?t= query param, set by the share-link builder — no key, no data fetch.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}): Promise<Metadata> {
  const { t } = await searchParams;
  const brand = getBrand();
  const title = t?.trim() || 'Survey';
  const description = `You're invited to complete this survey — powered by ${brand.name}.`;
  const image = `/og?title=${encodeURIComponent(title)}`;
  return {
    metadataBase: metadataBase(),
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}

export default function SurveyPage({ params }: { params: Promise<{ ref: string; surveyId: string }> }) {
  return <SurveyClient params={params} />;
}
