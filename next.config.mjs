/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build stamp, inlined into the client bundle at build time so the running
  // page can say which commit it was built from. Vercel sets the GIT_COMMIT
  // vars on every deployment; locally they're absent, hence "dev".
  env: {
    NEXT_PUBLIC_BUILD_SHA: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || "dev",
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_BUILD_REPO: process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
      ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
      : "",
  },
};

export default nextConfig;
