import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      {
        pathname: "/api/media/file/**",
      },
    ],
  },
  reactStrictMode: true,
};

export default withPayload(nextConfig, { devBundleServerPackages: false });
