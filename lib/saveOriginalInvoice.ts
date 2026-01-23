import { supabase } from '@/lib/supabaseClient'

export async function saveOriginalInvoice(
  invoiceNumber: string,
  invoiceDate: string,
  fileUrl: string,
  fileName: string
) {
  const { error } = await supabase
    .from('usa_company_invoice')
    .upsert(
      {
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        original_invoice_url: fileUrl,
        original_invoice_name: fileName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'invoice_number'
      }
    )

  if (error) throw error
}
