import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["onnxruntime-web"],
};

export default nextConfig;
