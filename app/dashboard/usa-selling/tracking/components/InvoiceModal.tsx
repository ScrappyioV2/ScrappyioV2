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
  const [shippingAddress, setShippingAddress] = useState(
    'Company Name\nStreet Address\nCity, State, Pincode\nIndia'
  );
  const [billTo, setBillTo] = useState(
    'Customer Name\nStreet Address\nCity, State, Pincode\nIndia'
  );
  const [authorizedSignature, setAuthorizedSignature] = useState('');

  const [sellerCompany, setSellerCompany] = useState(
  'Seller Company Name\nStreet Address\nCity, State, Pincode\nIndia'
);

  // Editable Tax Fields
  const [cgst, setCgst] = useState(0);
  const [sgst, setSgst] = useState(0);

  // Editable Item Rows - FIXED MAPPING
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
  const tax = cgst + sgst;
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

      alert('Invoice uploaded successfully!');
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
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

      alert('Invoice saved successfully!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Save Error:', error);
      alert('Save failed: ' + error.message);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-auto">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-50 border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">TAX INVOICE</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        {/* Invoice Content */}
        <div className="p-6 space-y-6">
          {/* Invoice Info Row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">
                Invoice No.
              </label>
              <input
                type="text"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">
                Invoice Date
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">
                GST Number
              </label>
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                placeholder="Enter GST Number"
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          {/* Addresses */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">
                Seller Company
              </label>
              <textarea
                value={sellerCompany}
                onChange={(e) => setSellerCompany(e.target.value)}
                rows={4}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">
                Shipping Address
              </label>
              <textarea
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                rows={4}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">
                Bill To
              </label>
              <textarea
                value={billTo}
                onChange={(e) => setBillTo(e.target.value)}
                rows={4}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          {/* Invoice Items Table */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full">
              <thead className="bg-blue-600 text-white">
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
                  <tr key={index} className="border-t">
                    <td className="px-3 py-2">{item.asin}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.product_name}
                        onChange={(e) =>
                          updateItem(index, 'product_name', e.target.value)
                        }
                        className="w-full border rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={item.weight}
                        onChange={(e) =>
                          updateItem(index, 'weight', parseFloat(e.target.value) || 0)
                        }
                        className="w-20 border rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={item.qty}
                        onChange={(e) =>
                          updateItem(index, 'qty', parseFloat(e.target.value) || 0)
                        }
                        className="w-20 border rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) =>
                          updateItem(index, 'price', parseFloat(e.target.value) || 0)
                        }
                        className="w-24 border rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      ₹ {item.amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.tracking_details}
                        onChange={(e) =>
                          updateItem(index, 'tracking_details', e.target.value)
                        }
                        className="w-32 border rounded px-2 py-1"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={item.delivery_date}
                        onChange={(e) =>
                          updateItem(index, 'delivery_date', e.target.value)
                        }
                        className="w-36 border rounded px-2 py-1"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tax Calculations */}
          <div className="flex justify-end">
            <div className="w-80 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Amount:</span>
                <span className="text-lg">₹ {totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <label className="font-semibold">CGST:</label>
                <input
                  type="number"
                  value={cgst}
                  onChange={(e) => setCgst(parseFloat(e.target.value) || 0)}
                  className="w-32 border rounded px-3 py-1"
                />
              </div>
              <div className="flex justify-between items-center gap-4">
                <label className="font-semibold">SGST:</label>
                <input
                  type="number"
                  value={sgst}
                  onChange={(e) => setSgst(parseFloat(e.target.value) || 0)}
                  className="w-32 border rounded px-3 py-1"
                />
              </div>
              <div className="flex justify-between items-center pt-2 border-t-2">
                <span className="font-semibold">Tax:</span>
                <span className="text-lg">₹ {tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t-2">
                <span className="font-bold text-lg">Total:</span>
                <span className="text-xl font-bold text-green-600">
                  ₹ {grandTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Authorized Signature */}
          <div>
            <label className="block text-sm font-semibold mb-1">
              Authorized Signature
            </label>
            <input
              type="text"
              value={authorizedSignature}
              onChange={(e) => setAuthorizedSignature(e.target.value)}
              placeholder="Enter authorized signature"
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-between items-center">
          <div>
            <label className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded cursor-pointer inline-flex items-center gap-2">
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
              <span className="ml-3 text-sm text-green-600">
                ✓ {uploadedFile.name}
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border rounded hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-2 rounded font-semibold"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
