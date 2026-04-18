export interface LineItem {
  description: string;
  amount: number;   // NOK inkl. MVA
  quantity: number;
}

export type QuoteStatus = 'new' | 'in_review' | 'offer_sent' | 'paid' | 'cancelled';

export interface QuoteRow {
  id: string;
  ticket_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_message: string | null;
  package_type: string | null;
  roof_type: string | null;
  configuration: Record<string, unknown> | null;
  added_elements: { side: string; category: string; placement: string }[];
  pricing: Record<string, unknown> | null;
  status: QuoteStatus;
  offer_line_items: LineItem[];
  offer_total: number | null;
  offer_notes: string | null;
  klarna_order_id: string | null;
  offer_sent_at: string | null;
  paid_at: string | null;
  created_at: string;
}
