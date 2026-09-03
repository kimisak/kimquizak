import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Run webpack directly to avoid the build worker TCP binding that fails in restricted sandboxes.
    webpackBuildWorker: false,
    // Next 16.3's CLI checker uses a detached child process, which is truncated in restricted shells.
    // The compiler API performs the same check without that process boundary.
    useTypeScriptCli: false,
    workerThreads: true,
  },
};

export default nextConfig;
