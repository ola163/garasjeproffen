export interface LineItem {
  description: string;
  amount: number;   // NOK inkl. MVA, per enhet
  quantity: number;
  varenr?: string;
  dimensjon?: string;
  enhet?: string;
}

export interface OfferSection {
  category: string;
  line_items: LineItem[];
  notes: string;
}

export type QuoteStatus = 'new' | 'in_review' | 'pending_approval' | 'offer_sent' | 'paid' | 'cancelled';

export interface QuoteRow {
  id: string;
  ticket_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_message: string | null;
  category: string | null;
  building_type: string | null;
  package_type: string | null;
  roof_type: string | null;
  configuration: Record<string, unknown> | null;
  added_elements: { side: string; category: string; placement: string }[];
  pricing: Record<string, unknown> | null;
  status: QuoteStatus;
  created_manually: boolean | null;
  attachments: string[] | null;
  assigned_to: string | null;
  approval_requested_from: string | null;
  approval_requested_at: string | null;
  offer_sections: OfferSection[] | null;
  offer_line_items: LineItem[];
  offer_total: number | null;
  offer_notes: string | null;
  klarna_order_id: string | null;
  offer_sent_at: string | null;
  paid_at: string | null;
  created_at: string;
}
