import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/pricing",           // Pricing page
  "/terms",
  "/privacy",
  "/refund",
  "/impressum",         // Legal requirement (Germany)
  "/guide",             // Getting started guide
  "/guides",            // Tips & guides page
  "/agents",            // Sub-agents explainer
  "/api/webhooks/(.*)",
  "/api/polar/(.*)",    // Polar checkout/webhooks
  "/api/proxy/(.*)",    // Proxy endpoints use their own auth (X-BlitzClaw-Instance header)
  "/api/internal/(.*)", // Internal callbacks from instances (auth via X-Instance-Secret)
  "/api/browser-relay", // Browser relay token validation (extension uses this)
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
