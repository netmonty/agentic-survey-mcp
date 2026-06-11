/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The shared data lib uses NodeNext-style `.js` import specifiers; let webpack
  // resolve them to the `.ts` sources.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
    };
    return config;
  },
};

export default nextConfig;
