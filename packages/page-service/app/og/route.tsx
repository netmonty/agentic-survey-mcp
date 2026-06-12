import { ImageResponse } from 'next/og';

// Social link-preview image, rendered to a 1200×630 PNG on request.
// Two modes:
//   • no params  → the landing-page card (public/landing.html references this)
//   • ?title=…   → a per-survey card showing the survey's name (used by the
//                  /s/… share links' og:image / twitter:image tags)
// No external fonts — uses the default sans.
export const contentType = 'image/png';

const ACCENT = '#c98a5b';
const BG = '#101113';
const TEXT = '#e9e8e4';
const MUTED = '#8c8d92';

export function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('title')?.trim();
  const title = raw ? raw.slice(0, 150) : '';
  // Scale the headline down as the title gets longer so it stays on-canvas.
  const headline = title || 'Agentic Surveys';
  const headlineSize = title ? (title.length > 60 ? 60 : title.length > 30 ? 80 : 104) : 116;
  const subtitle = title ? 'Survey invitation' : 'made by Monty';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: BG,
          backgroundImage: `radial-gradient(900px 500px at 50% 22%, rgba(201,138,91,0.18), rgba(16,17,19,0) 70%)`,
          fontFamily: 'sans-serif',
        }}
      >
        {/* brand mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: ACCENT }} />
          <div
            style={{
              fontSize: 26,
              letterSpacing: 4,
              color: MUTED,
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Agentic Survey MCP
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            maxWidth: 1000,
            textAlign: 'center',
            fontSize: headlineSize,
            fontWeight: 800,
            color: TEXT,
            letterSpacing: -3,
            lineHeight: 1.05,
          }}
        >
          {headline}
        </div>

        <div style={{ fontSize: 44, color: ACCENT, marginTop: 28, fontWeight: 600 }}>{subtitle}</div>

        <div style={{ position: 'absolute', bottom: 48, fontSize: 24, color: MUTED, letterSpacing: 1 }}>
          mcpsurveys.com
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
