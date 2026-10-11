import { NextResponse } from "next/server";
import { getOwner } from "@/lib/auth/owner";
import { parseBackupPayload } from "@/lib/backup";

export const dynamic = "force-dynamic";
const MAX_BYTES = 3_000_000;
const headers = { "Cache-Control": "private, no-store" };
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });

export async function GET(request: Request) {
  const owner = await getOwner();
  if (!owner) return reply({ error: "Host login required." }, 401);
  const id = new URL(request.url).searchParams.get("id");
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) return reply({ error: "Invalid quiz ID." }, 400);
  if (id) {
    const { data, error } = await owner.supabase.from("quiz_snapshots")
      .select("payload").eq("owner_id", owner.userId).eq("id", id).maybeSingle();
    if (error) return reply({ error: "Could not read the private archive. Check the database setup." }, 503);
    if (!data) return reply({ error: "Quiz not found." }, 404);
    return reply(data.payload);
  }
  const { data, error } = await owner.supabase.from("quiz_snapshots")
    .select("id,title,created_at").eq("owner_id", owner.userId)
    .order("created_at", { ascending: false }).limit(100);
  if (error) return reply({ error: "Could not read the private archive. Check the database setup." }, 503);
  return reply({ quizzes: data });
}

function isSameOrigin(request: Request) {
  // Next may reconstruct request.url using its internal hostname. Compare the
  // browser-controlled Origin to the incoming Host, also behind Vercel's proxy.
  let sameOrigin = false;
  try {
    const origin = new URL(request.headers.get("origin") || "");
    const host = request.headers.get("host") || new URL(request.url).host;
    sameOrigin = /^https?:$/.test(origin.protocol) && origin.host === host;
  } catch { /* Missing or invalid origins are rejected. */ }
  return sameOrigin;
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return reply({ error: "Invalid request origin." }, 403);
  }
  const owner = await getOwner();
  if (!owner) return reply({ error: "Host login required." }, 401);
  let payload;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Missing quiz." }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        return reply({ error: "This quiz exceeds the 3 MB cloud limit. Use a local JSON backup instead." }, 413);
      }
      chunks.push(value);
    }
    payload = parseBackupPayload(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return reply({ error: "Invalid quiz backup." }, 400);
  }
  const title = typeof payload.settings.quizTitle === "string"
    ? payload.settings.quizTitle.trim().slice(0, 120) || "Untitled quiz" : "Untitled quiz";
  const { error } = await owner.supabase.from("quiz_snapshots").insert({ owner_id: owner.userId, title, payload });
  if (error) return reply({ error: "Could not save the quiz. Check the database setup." }, 503);
  return reply({ saved: true }, 201);
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return reply({ error: "Invalid request origin." }, 403);
  const owner = await getOwner();
  if (!owner) return reply({ error: "Host login required." }, 401);
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return reply({ error: "Invalid quiz ID." }, 400);
  }
  const { data, error } = await owner.supabase.from("quiz_snapshots")
    .delete().eq("owner_id", owner.userId).eq("id", id).select("id").maybeSingle();
  if (error) return reply({ error: "Could not delete the quiz. Check the database setup and try again." }, 503);
  if (!data) return reply({ error: "Quiz not found or no longer accessible." }, 404);
  return reply({ deleted: true });
}
