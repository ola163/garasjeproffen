import { NextResponse } from "next/server";
import type { QuoteRequest, QuoteResponse } from "@/types/quote";
import { GARAGE_PARAMETERS } from "@/lib/parameters";
import { calculatePrice } from "@/lib/pricing";

export async function POST(request: Request) {
  try {
    const body: QuoteRequest = await request.json();

    // Validate customer info
    if (!body.customer?.name || !body.customer?.email) {
      return NextResponse.json<QuoteResponse>(
        { success: false, error: "Name and email are required." },
        { status: 400 }
      );
    }

    // Validate parameters are within bounds
    for (const param of GARAGE_PARAMETERS) {
      const value = body.configuration?.parameters?.[param.id];
      if (value !== undefined && (value < param.min || value > param.max)) {
        return NextResponse.json<QuoteResponse>(
          {
            success: false,
            error: `${param.label} must be between ${param.min} and ${param.max}.`,
          },
          { status: 400 }
        );
      }
    }

    // Recalculate price server-side (never trust client-side price)
    const serverPricing = calculatePrice(body.configuration);

    // Generate a quote ID
    const quoteId = `Q-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    // Log the quote (replace with database/email in production)
    console.log("=== NEW QUOTE REQUEST ===");
    console.log("Quote ID:", quoteId);
    console.log("Customer:", body.customer);
    console.log("Parameters:", body.configuration.parameters);
    console.log("Server Price:", serverPricing);
    console.log("========================");

    return NextResponse.json<QuoteResponse>({
      success: true,
      quoteId,
    });
  } catch {
    return NextResponse.json<QuoteResponse>(
      { success: false, error: "Invalid request." },
      { status: 400 }
    );
  }
}
