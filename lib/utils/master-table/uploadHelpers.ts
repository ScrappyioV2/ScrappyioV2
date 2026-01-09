import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export interface UploadResult {
  data: any[]
  errors: string[]
}

/**
 * Parse CSV file
 */
export const parseCSV = (file: File): Promise<UploadResult> => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        resolve({
          data: results.data,
          errors: results.errors.map((e: any) => e.message),
        })
      },
      error: (error: any) => {
        resolve({
          data: [],
          errors: [error.message],
        })
      },
    })
  })
}

/**
 * Parse Excel file (.xlsx, .xls)
 */
export const parseExcel = async (file: File): Promise<UploadResult> => {
  try {
    const data = await file.arrayBuffer()
    const workbook = XLSX.read(data, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet)

    return {
      data: jsonData,
      errors: [],
    }
  } catch (error: any) {
    return {
      data: [],
      errors: [error.message || 'Failed to parse Excel file'],
    }
  }
}

/**
 * Detect file type and parse accordingly
 */
export const parseFile = async (file: File): Promise<UploadResult> => {
  const extension = file.name.split('.').pop()?.toLowerCase()

  switch (extension) {
    case 'csv':
      return parseCSV(file)
    case 'xlsx':
    case 'xls':
      return parseExcel(file)
    default:
      return {
        data: [],
        errors: [`Unsupported file type: ${extension}`],
      }
  }
}
