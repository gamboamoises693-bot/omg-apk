/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export -> "out/" folder, deployed to Firebase Hosting (free Spark plan).
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  // Written into the build as an empty text unless scripts/guides sets it, so the emulator code is removed from the real site.
  env: { NEXT_PUBLIC_USE_EMULATORS: process.env.NEXT_PUBLIC_USE_EMULATORS ?? "" },
};

export default nextConfig;
