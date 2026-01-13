export interface Purchase {
  id: string;
  asin: string;
  product_link: string | null;
  product_name: string | null;
  target_price: number | null;
  target_quantity: number | null;
  funnel_quantity: number | null;
  funnel_seller: string | null;
  buying_price: number | null;
  buying_quantity: number | null;
  seller_link: string | null;
  seller_phone: string | null;
  payment_method: string | null;
  tracking_details: string | null;
  delivery_date: string | null;
  origin_india: boolean;
  origin_china: boolean;
  status: 'draft' | 'sent_to_admin' | 'admin_confirmed' | 'completed';
  user_id: string | null;
  sent_to_admin_at: string | null;
  admin_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminValidation {
  id: string;
  purchase_id: string | null;
  asin: string;
  product_link: string | null;
  product_name: string | null;
  target_price: number | null;
  target_quantity: number | null;
  funnel_quantity: number | null;
  funnel_seller: string | null;
  buying_price: number | null;
  buying_quantity: number | null;
  seller_link: string | null;
  seller_phone: string | null;
  payment_method: string | null;
  origin_india: boolean;
  origin_china: boolean;
  admin_status: 'pending' | 'confirmed' | 'rejected';
  admin_notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  rejected_at: string | null;
  updated_at: string;
}

export interface PassFileProduct {
  id: string;
  asin: string;
  product_name: string | null;
  brand: string | null;
  seller_tag: string | null;
  funnel: string | null;
  no_of_seller: number | null;
  usa_link: string | null;
  india_price: number | null;
  product_weight: number | null;
  judgement: string | null;
  usd_price: number | null;
  inr_sold: number | null;
  inr_purchase: number | null;
  origin_india: boolean;
  origin_china: boolean;
  sent_to_admin: boolean;
  checklist_completed: boolean;
  created_at: string;
}
