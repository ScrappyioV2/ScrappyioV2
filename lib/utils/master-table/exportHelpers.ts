import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export type ExportFormat = 'csv' | 'excel' | 'pdf';

export interface ExportData {
  [key: string]: any;
}

/**
 * Generate filename with timestamp
 */
export const generateFileName = (
  tableName: string,
  format: ExportFormat
): string => {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, -5);
  return `${tableName}-${timestamp}.${format === 'excel' ? 'xlsx' : format}`;
};

/**
 * Export data to CSV
 */
export const exportToCSV = (data: ExportData[], fileName: string): void => {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, fileName);
};

/**
 * Export data to Excel
 */
export const exportToExcel = (data: ExportData[], fileName: string): void => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, fileName);
};

/**
 * Export data to PDF
 */
export const exportToPDF = (data: ExportData[], fileName: string): void => {
  const doc = new jsPDF();
  
  // Get column headers
  const headers = Object.keys(data[0] || {});
  
  // Prepare table data
  const tableData = data.map((row) =>
    headers.map((header) => row[header] || '')
  );

  autoTable(doc, {
    head: [headers],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
  });

  doc.save(fileName);
};

/**
 * Main export function
 */
export const exportData = (
  data: ExportData[],
  tableName: string,
  format: ExportFormat
): void => {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  const fileName = generateFileName(tableName, format);

  switch (format) {
    case 'csv':
      exportToCSV(data, fileName);
      break;
    case 'excel':
      exportToExcel(data, fileName);
      break;
    case 'pdf':
      exportToPDF(data, fileName);
      break;
    default:
      console.error('Unsupported export format');
  }
};

/**
 * Helper function to download blob
 */
const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
