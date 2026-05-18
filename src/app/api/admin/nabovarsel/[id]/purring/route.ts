import { NextResponse } from "next/server";

// Purring is just a send with isPurring=true — delegate to send route
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const url = new URL(request.url);
  const sendUrl = `${url.origin}/api/admin/nabovarsel/${id}/send`;

  const res = await fetch(sendUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: request.headers.get("cookie") ?? "",
    },
    body: JSON.stringify({ ...body, isPurring: true }),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
