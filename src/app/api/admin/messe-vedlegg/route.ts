import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const BUCKET = "messe-vedlegg";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("gp-admin")?.value !== "1") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  if (!db) return Response.json({ error: "DB ikke konfigurert" }, { status: 503 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return Response.json({ error: "Ingen fil valgt" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Filen er for stor (maks 10 MB)" }, { status: 400 });
  }

  // Ensure bucket exists (no-op if already created)
  await db.storage.createBucket(BUCKET, { public: true }).catch(() => {});

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext ? `.${ext}` : ""}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { data, error } = await db.storage.from(BUCKET).upload(path, buf, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(data.path);

  return Response.json({ url: publicUrl, name: safeName });
}
