import { supabase } from './supabase'

const defaultNumberingSettings = {
  workOrderPrefix: string
  workOrderFormat: string
  workOrderNext: string
  estimatePrefix: string
  estimateFormat: string
  estimateNext: string
  invoicePrefix: string
  invoiceFormat: string
  invoiceNext: string
  projectPrefix: string
  projectFormat: string
  projectNext: string
  purchaseOrderPrefix: string
  purchaseOrderFormat: string
  purchaseOrderNext: string
}

interface NumberingSettings {
  workOrderPrefix: string
  workOrderFormat: string
  workOrderNext: string
  estimatePrefix: string
  estimateFormat: string
  estimateNext: string
  invoicePrefix: string
  invoiceFormat: string
  invoiceNext: string
  projectPrefix: string
  projectFormat: string
  projectNext: string
  purchaseOrderPrefix: string
  purchaseOrderFormat: string
  purchaseOrderNext: string
}

// Get the highest existing number for a document type
async function getHighestExistingNumber(documentType: 'work_order' | 'estimate' | 'invoice' | 'project' | 'purchase_order'): Promise<number> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile) throw new Error('Profile not found')

    let tableName: string
    let numberColumn: string

    switch (documentType) {
      case 'work_order':
        tableName = 'work_orders'
        numberColumn = 'wo_number'
        break
      case 'estimate':
        tableName = 'estimates'
        numberColumn = 'estimate_number'
        break
      case 'invoice':
        tableName = 'invoices'
        numberColumn = 'invoice_number'
        break
      case 'project':
        tableName = 'projects'
        numberColumn = 'project_number'
        break
      case 'purchase_order':
        tableName = 'purchase_orders'
        numberColumn = 'po_number'
        break
      default:
        throw new Error('Invalid document type')
    }

    const { data: documents } = await supabase
      .from(tableName)
      .select(numberColumn)
      .eq('company_id', profile.company_id)
      .order('created_at', { ascending: false })

    if (!documents || documents.length === 0) {
      return 0
    }

    // Extract numbers from document numbers and find the highest
    let highestNumber = 0
    for (const doc of documents) {
      const numberStr = doc[numberColumn]
      // Extract the numeric part from various formats
      // Handle formats like WO-250014, WO-2024-0001, WO-0001, etc.
      const matches = numberStr.match(/(\d+)(?!.*\d)/)
      if (matches) {
        const num = parseInt(matches[1], 10)
        if (num > highestNumber) {
          highestNumber = num
        }
      }
    }

    return highestNumber
  } catch (error) {
    console.error('Error getting highest existing number:', error)
    return 0
  }
}

// Generate the next document number
export async function getNextNumber(documentType: 'work_order' | 'estimate' | 'invoice' | 'project' | 'purchase_order'): Promise<{ formattedNumber: string; nextSequence: number }> {
  try {
    // Get company settings
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile) throw new Error('Profile not found')

    const { data: company } = await supabase
      .from('companies')
      .select('settings')
      .eq('id', profile.company_id)
      .single()

    // Ensure all numbering settings are properly merged with defaults
    const existingNumbering = company?.settings?.numbering || {}
    const numbering: NumberingSettings = {
      ...defaultNumberingSettings,
      ...existingNumbering
    }

    // Check if there are existing documents with higher numbers
    const highestExisting = await getHighestExistingNumber(documentType)
    const nextNumber = highestExisting + 1

    // Get the format for the document type
    let format: string
    switch (documentType) {
      case 'work_order':
        format = numbering.workOrderFormat
        break
      case 'estimate':
        format = numbering.estimateFormat
        break
      case 'invoice':
        format = numbering.invoiceFormat
        break
      case 'project':
        format = numbering.projectFormat
        break
      case 'purchase_order':
        format = numbering.purchaseOrderFormat
        break
      default:
        format = getFormatForDocumentType(documentType)
    }
    
    // Generate the formatted number
    let generatedNumber = format
    
    // Replace year placeholders
    if (format.includes('{YYYY}')) {
      const currentYear = new Date().getFullYear()
      generatedNumber = generatedNumber.replace('{YYYY}', currentYear.toString())
    } else if (format.includes('{YY}')) {
      const currentYear = new Date().getFullYear().toString().slice(-2)
      generatedNumber = generatedNumber.replace('{YY}', currentYear)
    }
    
    // Replace number placeholders
    if (format.includes('{####}')) {
      // For formats like WO-{YY}{####}, use a smaller sequential number
      const sequentialNumber = nextNumber > 9999 ? nextNumber % 10000 : nextNumber
      const paddedNumber = sequentialNumber.toString().padStart(4, '0')
      generatedNumber = generatedNumber.replace('{####}', paddedNumber)
    } else if (format.includes('{###}')) {
      const sequentialNumber = nextNumber > 999 ? nextNumber % 1000 : nextNumber
      const paddedNumber = sequentialNumber.toString().padStart(3, '0')
      generatedNumber = generatedNumber.replace('{###}', paddedNumber)
    } else if (format.includes('{##}')) {
      const sequentialNumber = nextNumber > 99 ? nextNumber % 100 : nextNumber
      const paddedNumber = sequentialNumber.toString().padStart(2, '0')
      generatedNumber = generatedNumber.replace('{##}', paddedNumber)
    } else {
      // If no number placeholders found, append the number
      generatedNumber = format + '-' + nextNumber.toString()
    }

    return { formattedNumber: generatedNumber, nextSequence: nextNumber }
  } catch (error) {
    console.error('Error generating next number:', error)
    throw error
  }
}

// Update the next number in settings after a document is created
export async function updateNextNumber(documentType: 'work_order' | 'estimate' | 'invoice' | 'project' | 'purchase_order', nextNumber: number): Promise<void> {
  try {
    // Get company settings
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('User not authenticated')

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile) throw new Error('Profile not found')

    const { data: company } = await supabase
      .from('companies')
      .select('settings')
      .eq('id', profile.company_id)
      .single()

    // Ensure all numbering settings are properly merged with defaults
    const existingNumbering = company?.settings?.numbering || {}
    let numbering = {
      ...defaultNumberingSettings,
      ...existingNumbering
    }

    // Update the next number in settings
    const updatedNumbering = { ...numbering }
    switch (documentType) {
      case 'work_order':
        updatedNumbering.workOrderNext = String(nextNumber + 1)
        break
      case 'estimate':
        updatedNumbering.estimateNext = String(nextNumber + 1)
        break
      case 'invoice':
        updatedNumbering.invoiceNext = String(nextNumber + 1)
        break
      case 'project':
        updatedNumbering.projectNext = String(nextNumber + 1)
        break
      case 'purchase_order':
        updatedNumbering.purchaseOrderNext = String(nextNumber + 1)
        break
    }

    const updatedSettings = {
      ...JSON.parse(JSON.stringify(company?.settings || {})),
      numbering: updatedNumbering
    }

    await supabase
      .from('companies')
      .update({ settings: updatedSettings })
      .eq('id', profile.company_id)
  } catch (error) {
    console.error('Error updating next number in settings:', error)
  }
}

// Get the format string for a document type
function getFormatForDocumentType(documentType: 'work_order' | 'estimate' | 'invoice' | 'project' | 'purchase_order'): string {
  switch (documentType) {
    case 'work_order':
      return 'WO-{YYYY}-{####}'
    case 'estimate':
      return 'EST-{YYYY}-{####}'
    case 'invoice':
      return 'INV-{YYYY}-{####}'
    case 'project':
      return 'PROJ-{YYYY}-{####}'
    case 'purchase_order':
      return 'PO-{YYYY}-{####}'
    default:
      throw new Error('Invalid document type')
  }
}