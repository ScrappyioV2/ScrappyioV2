import { supabase } from '@/lib/supabaseClient'

export async function uploadOriginalInvoice(
  invoiceNumber: string,
  pdfBlob: Blob
) {
  const fileName = `${invoiceNumber}.pdf`

  const { error: uploadError } = await supabase.storage
    .from('usa-company-invoices')
    .upload(`original/${fileName}`, pdfBlob, {
      upsert: true,
      contentType: 'application/pdf',
    })

  if (uploadError) throw uploadError

  const { data } = supabase.storage
    .from('usa-company-invoices')
    .getPublicUrl(`original/${fileName}`)

  return {
    url: data.publicUrl,
    name: fileName,
  }
}
