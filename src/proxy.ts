import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Page/API requests only: audio, images, and Next.js assets need no auth refresh.
  matcher: ["/", "/game/:path*", "/config/:path*", "/login/:path*", "/account/:path*", "/auth/:path*", "/api/:path*"],
};
