/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Serve the static marketing landing at the domain root; surveys live at /s/...
    return {
      beforeFiles: [{ source: '/', destination: '/landing.html' }],
    };
  },
};

export default nextConfig;
