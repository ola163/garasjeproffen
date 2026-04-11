import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ONSHAPE_ACCESS_KEY: process.env.ONSHAPE_ACCESS_KEY ? "set" : "MISSING",
    ONSHAPE_SECRET_KEY: process.env.ONSHAPE_SECRET_KEY ? "set" : "MISSING",
    ONSHAPE_DOCUMENT_ID: process.env.ONSHAPE_DOCUMENT_ID ? "set" : "MISSING",
    ONSHAPE_WORKSPACE_ID: process.env.ONSHAPE_WORKSPACE_ID ? "set" : "MISSING",
    ONSHAPE_VARIABLE_STUDIO_ID: process.env.ONSHAPE_VARIABLE_STUDIO_ID ? "set" : "MISSING",
  });
}
