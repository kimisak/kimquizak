import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Local quiz pages must stay usable even when Supabase is unreachable.
  matcher: ["/login/:path*", "/account/:path*", "/auth/:path*", "/api/quizzes/:path*", "/api/maps/config"],
};
