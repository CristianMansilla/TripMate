import { describe,expect,it } from 'vitest'
import { reservationDocumentPath, reservationPdfError } from './reservation-documents'

describe('reservation documents',()=>{
  it('accepts a PDF with a valid signature',async()=>{
    const file=new File(['%PDF-1.7\ncontent'],'pasaje.pdf',{type:'application/pdf'})
    await expect(reservationPdfError(file)).resolves.toBeNull()
  })

  it('rejects a renamed non-PDF file',async()=>{
    const file=new File(['not a pdf'],'pasaje.pdf',{type:'application/pdf'})
    await expect(reservationPdfError(file)).resolves.toBe('El archivo seleccionado no es un PDF válido.')
  })

  it('builds a path scoped by trip and reservation',()=>{
    expect(reservationDocumentPath('trip-1','reservation-1','document-1')).toBe('trip-1/reservation-1/document-1.pdf')
  })
})
