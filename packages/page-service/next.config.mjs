// Strict policy for the survey app. Scripts/styles are self + inline (Next
// hydration), fonts are self-hosted via next/font, the only outbound data goes
// to the respondent's Supabase project, and Turnstile (if enabled) needs its
// script + frame. frame-ancestors 'none' blocks the page being iframed.
//
// 'unsafe-eval' is added in DEVELOPMENT only: React's dev build uses eval() for
// debugging features (callstack reconstruction). Production never uses eval(),
// so the prod CSP stays strict.
const isDev = process.env.NODE_ENV !== 'production';
const scriptSrc =
  "script-src 'self' 'unsafe-inline'" +
  (isDev ? " 'unsafe-eval'" : '') +
  ' https://challenges.cloudflare.com';
const SURVEY_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  scriptSrc,
  "frame-src https://challenges.cloudflare.com",
  "connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com",
].join('; ');

// Applied to every route regardless of content.
const BASELINE_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Serve the static marketing landing at the domain root; surveys live at /s/...
    return {
      beforeFiles: [{ source: '/', destination: '/landing.html' }],
    };
  },
  async headers() {
    return [
      { source: '/:path*', headers: BASELINE_HEADERS },
      {
        // Survey pages render author-supplied content, so lock them down and
        // keep them out of search indexes (they shouldn't be discoverable here).
        source: '/s/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: SURVEY_CSP },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
