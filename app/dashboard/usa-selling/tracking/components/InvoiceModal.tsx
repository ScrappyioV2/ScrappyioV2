'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { X, Upload } from 'lucide-react';

type InvoiceItem = {
  asin: string;
  product_name: string | null;
  buying_price: number | null;
  buying_quantity: number | null;
  tracking_details: string | null;
  delivery_date: string | null;
  product_weight?: number | null;
};

interface InvoiceModalProps {
  open: boolean;
  onClose: () => void;
  items: InvoiceItem[];
  onSuccess: () => void;
}

export default function InvoiceModal({
  open,
  onClose,
  items,
  onSuccess,
}: InvoiceModalProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{
    url: string;
    name: string;
  } | null>(null);

  // Editable Header Fields
  const [invoiceNo, setInvoiceNo] = useState(`INV-${Date.now()}`);
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [gstNumber, setGstNumber] = useState('');
  const [sellerCompany, setSellerCompany] = useState(
    'Seller Company Name :\nStreet Address :\nCity :\nState :\nPincode :\nIndia'
  );

  const [shippingAddress, setShippingAddress] = useState(
    'Company Name :\nStreet Address :\nCity :\nState :\nPincode :\nIndia'
  );

  const [billTo, setBillTo] = useState(
    'Company Name :\nStreet Address :\nCity :\nState :\nPincode :\nIndia'
  );


  const [authorizedSignature, setAuthorizedSignature] = useState('');

  // Editable Tax Fields
  const [cgst, setCgst] = useState<number | ''>('');
  const [sgst, setSgst] = useState<number | ''>('');

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Editable Item Rows - Use useEffect to update when items prop changes
  const [editableItems, setEditableItems] = useState<any[]>([]);

  // Update editableItems whenever items prop changes
  useEffect(() => {
    console.log('📦 Items received in modal:', items);

    if (items && items.length > 0) {
      const mapped = items.map((item) => {
        console.log('🔍 Mapping item:', item);
        return {
          asin: item.asin,
          product_name: item.product_name || '',
          weight: item.product_weight || 0,
          qty: item.buying_quantity || 0,
          price: item.buying_price || 0,
          amount: (item.buying_quantity || 0) * (item.buying_price || 0),
          tracking_details: item.tracking_details || '',
          delivery_date: item.delivery_date || '',
        };
      });

      console.log('📊 Mapped editable items:', mapped);
      setEditableItems(mapped);
    } else {
      setEditableItems([]);
    }
  }, [items]); // Run whenever items prop changes

  // Update item field
  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...editableItems];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-calculate amount
    if (field === 'qty' || field === 'price') {
      updated[index].amount = updated[index].qty * updated[index].price;
    }

    setEditableItems(updated);
  };

  // Calculations
  const totalAmount = editableItems.reduce((sum, item) => sum + item.amount, 0);
  const tax = (Number(cgst) || 0) + (Number(sgst) || 0);
  const grandTotal = totalAmount + tax;

  // Handle Upload Invoice
  const handleUploadInvoice = async (file: File) => {
    try {
      setUploading(true);
      const filePath = `uploaded/${invoiceNo}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('usa-company-invoices')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('usa-company-invoices')
        .getPublicUrl(filePath);

      setUploadedFile({
        url: data.publicUrl,
        name: file.name,
      });

      setToast({
        message: 'Invoice uploaded successfully!',
        type: 'success'
      });

      // Auto-hide toast after 2 seconds
      setTimeout(() => setToast(null), 2000);
    } catch (err: any) {
      setToast({
        message: 'Upload failed: ' + err.message,
        type: 'error'
      });
    }
    finally {
      setUploading(false);
    }
  };

  // Handle Save Button
  const handleSave = async () => {
    if (!uploadedFile) {
      alert('Please upload an invoice first!');
      return;
    }

    try {
      // 1. Save to MASTER table (usa_company_invoice)
      const { error: masterError } = await supabase
        .from('usa_company_invoice')
        .upsert(
          {
            invoice_number: invoiceNo,
            invoice_date: invoiceDate,
            uploaded_invoice_url: uploadedFile.url,
            uploaded_invoice_name: uploadedFile.name,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'invoice_number' }
        );

      if (masterError) throw masterError;

      // 2. Prepare payload for DETAIL table (usa_tracking_company_invoice)
      const payload = editableItems.map((item) => ({
        invoice_number: invoiceNo,
        invoice_date: invoiceDate,
        asin: item.asin,
        product_name: item.product_name,
        product_weight: item.weight,
        buying_quantity: item.qty,
        buying_price: item.price,
        amount: item.amount,
        tracking_details: item.tracking_details,
        delivery_date: item.delivery_date || null,
        gst_number: gstNumber,
        cgst: cgst,
        sgst: sgst,
        tax_amount: tax,
        total_amount: grandTotal,
        authorized_signature: authorizedSignature,
        seller_company: sellerCompany,
        uploaded_invoice_url: uploadedFile.url, // Same URL for all ASINs
        uploaded_invoice_name: uploadedFile.name, // Same name for all ASINs
      }));

      // 3. Insert into detail table
      const { error: insertError } = await supabase
        .from('usa_tracking_company_invoice')
        .insert(payload);

      if (insertError) throw insertError;

      // 4. Delete ASINs from usa_traking (Main File)
      const asinsToDelete = editableItems.map(item => item.asin);
      const { error: deleteError } = await supabase
        .from('usa_traking')
        .delete()
        .in('asin', asinsToDelete);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        // Don't throw - invoice is already saved, just log the error
      }

      setToast({
        message: 'Invoice saved successfully!',
        type: 'success'
      });

      // Close modal and refresh after short delay
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);

    } catch (error: any) {
      console.error('Save Error:', error);
      setToast({
        message: 'Save failed: ' + error.message,
        type: 'error'
      });
    }

  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 overflow-auto">
      <div className="bg-slate-900 rounded-xl shadow-2xl border border-slate-700 w-full max-w-7xl max-h-[95vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-950 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">TAX INVOICE</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Invoice Content */}
        <div className="p-6 space-y-6">
          {/* Invoice Info Row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-300">
                Invoice No.
              </label>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-300">
                Invoice Date
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-300">
                GST Number
              </label>
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                placeholder="Enter GST Number"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Addresses */}
          <div className="grid grid-cols-2 gap-4">
            {/* Seller Company */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-300">
                Seller Company
              </label>
              <textarea
                value={sellerCompany}
                onChange={(e) => setSellerCompany(e.target.value)}
                rows={5}
                placeholder="Seller Company Name&#10;Street Address&#10;City&#10;State&#10;Pincode&#10;India"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Shipping Address */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-300">
                Shipping Address
              </label>
              <textarea
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                rows={5}
                placeholder="Company Name&#10;Street Address&#10;City&#10;State&#10;Pincode&#10;India"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Bill To */}
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-300">
                Bill To
              </label>
              <textarea
                value={billTo}
                onChange={(e) => setBillTo(e.target.value)}
                rows={5}
                placeholder="Company Name&#10;Street Address&#10;City&#10;State&#10;Pincode&#10;India"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>


          {/* Invoice Items Table */}
          <div className="overflow-x-auto border border-slate-700 rounded-lg">
            <table className="w-full">
              <thead className="bg-indigo-600 text-white">
                <tr>
                  <th className="px-3 py-2 text-left">ASIN</th>
                  <th className="px-3 py-2 text-left">Product Name</th>
                  <th className="px-3 py-2 text-left">Weight</th>
                  <th className="px-3 py-2 text-left">Qty</th>
                  <th className="px-3 py-2 text-left">Price</th>
                  <th className="px-3 py-2 text-left">Amount</th>
                  <th className="px-3 py-2 text-left">Tracking Details</th>
                  <th className="px-3 py-2 text-left">Delivery Date</th>
                </tr>
              </thead>
              <tbody>
                {editableItems.map((item, index) => (
                  <tr key={index} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-300">{item.asin}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.product_name}
                        onChange={(e) =>
                          updateItem(index, 'product_name', e.target.value)
                        }
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={item.weight}
                        onChange={(e) =>
                          updateItem(index, 'weight', parseFloat(e.target.value) || 0)
                        }
                        className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) =>
                          updateItem(index, 'qty', parseFloat(e.target.value) || 0)
                        }
                        className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) =>
                          updateItem(index, 'price', parseFloat(e.target.value) || 0)
                        }
                        className="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-200">
                      ₹ {item.amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.tracking_details}
                        onChange={(e) =>
                          updateItem(index, 'tracking_details', e.target.value)
                        }
                        className="w-32 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={item.delivery_date}
                        onChange={(e) =>
                          updateItem(index, 'delivery_date', e.target.value)
                        }
                        className="w-36 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tax Calculations */}
          <div className="flex justify-end">
            <div className="w-80 space-y-2 bg-slate-800 border border-slate-700 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-300">Amount:</span>
                <span className="text-lg text-slate-200">₹ {totalAmount.toFixed(2)}</span>
              </div>
              <input
                type="number"
                value={cgst}
                onChange={(e) => setCgst(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                placeholder="Enter CGST"
                className="w-32 bg-slate-900 border border-slate-700 rounded px-3 py-1 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />

              <input
                type="number"
                value={sgst}
                onChange={(e) => setSgst(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                placeholder="Enter SGST"
                className="w-32 bg-slate-900 border border-slate-700 rounded px-3 py-1 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />

              <div className="flex justify-between items-center pt-2 border-t-2 border-slate-700">
                <span className="font-semibold text-slate-300">Tax:</span>
                <span className="text-lg text-slate-200">₹ {tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t-2 border-slate-700">
                <span className="font-bold text-lg text-slate-200">Total:</span>
                <span className="text-xl font-bold text-green-400">
                  ₹ {grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Authorized Signature */}
          <div>
            <label className="block text-sm font-semibold mb-1 text-slate-300">
              Authorized Signature
            </label>
            <input
              type="text"
              value={authorizedSignature}
              onChange={(e) => setAuthorizedSignature(e.target.value)}
              placeholder="Enter authorized signature"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="sticky bottom-0 bg-slate-950 border-t border-slate-800 px-6 py-4 flex justify-between items-center">
          <div>
            <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg cursor-pointer inline-flex items-center gap-2 font-semibold transition-colors">
              <Upload size={18} />
              {uploading ? 'Uploading...' : 'Upload Invoice'}
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadInvoice(file);
                }}
                className="hidden"
                disabled={uploading}
              />
            </label>
            {uploadedFile && (
              <span className="ml-3 text-sm text-green-400">
                ✓ {uploadedFile.name}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-500 text-white px-8 py-2 rounded-lg font-semibold transition-colors shadow-lg"
            >
              Save
            </button>
          </div>
        </div>
      </div>
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] animate-slide-in">
          <div
            className={`px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 min-w-[300px] ${toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
              }`}
          >
            <span className="text-2xl">
              {toast.type === 'success' ? '✅' : '❌'}
            </span>
            <span className="font-semibold">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-auto text-white hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
