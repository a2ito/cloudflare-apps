import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 写真アップロード（クライアント側で縮小済み）を複数枚許容する
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
