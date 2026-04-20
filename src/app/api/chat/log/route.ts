import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
};

export async function POST(req: Request) {
  try {
    const { sessionId, messages, lang } = await req.json();

    const cookieStore = await cookies();
    const userEmail = cookieStore.get("gp-user")?.value ?? null;

    const db = supabaseAdmin();
    if (!db) return new Response("DB not configured", { status: 503 });

    const { error } = await db.from("chat_logs").upsert(
      { session_id: sessionId, user_email: userEmail, lang, messages, updated_at: new Date().toISOString() },
      { onConflict: "session_id" }
    );

    if (error) {
      console.error("chat_logs upsert error:", error.message, error.details);
      return new Response(error.message, { status: 500 });
    }

    return new Response("ok");
  } catch (err) {
    console.error("Chat log error:", err);
    return new Response("error", { status: 500 });
  }
}
