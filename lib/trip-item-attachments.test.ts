import { describe,expect,it } from 'vitest'
import { attachmentPdfError, normalizeAttachmentUrl, tripItemAttachmentPath } from './trip-item-attachments'

describe('trip item attachments',()=>{
  it('accepts a PDF with a valid signature',async()=>{
    const file=new File(['%PDF-1.7\ncontent'],'pasaje.pdf',{type:'application/pdf'})
    await expect(attachmentPdfError(file)).resolves.toBeNull()
  })

  it('rejects a renamed non-PDF file',async()=>{
    const file=new File(['not a pdf'],'pasaje.pdf',{type:'application/pdf'})
    await expect(attachmentPdfError(file)).resolves.toBe('El archivo seleccionado no es un PDF válido.')
  })

  it('builds a path scoped by trip and item',()=>{
    expect(tripItemAttachmentPath('trip-1','item-1','attachment-1')).toBe('trip-1/item-1/attachment-1.pdf')
  })

  it('accepts only secure attachment links',()=>{
    expect(normalizeAttachmentUrl('https://example.com/ticket')).toBe('https://example.com/ticket')
    expect(normalizeAttachmentUrl('http://example.com/ticket')).toBeNull()
  })
})
