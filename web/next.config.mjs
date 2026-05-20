/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  /**
   * The dynamic OG route at /q-shield/compare/opengraph-image runs as a
   * Vercel serverless function. It reads data/results/*.json at request
   * time via the loader. Next.js's automatic file tracing misses this
   * (the readFileSync call lives in a separate module from the route
   * handler), so we declare the dependency explicitly.
   *
   * Without this, dynamic OG image requests fail with ENOENT for
   * /var/task/web/data/results.
   */
  experimental: {
    outputFileTracingIncludes: {
      "/q-shield/compare/opengraph-image": ["./data/results/**/*"],
    },
  },
};

export default nextConfig;
