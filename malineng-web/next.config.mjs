/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export -> "out/" folder, deployed to Firebase Hosting (free Spark plan).
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
