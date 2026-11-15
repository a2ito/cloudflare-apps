import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 画像アップロード（クライアント側で縮小済み）を許容する
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
