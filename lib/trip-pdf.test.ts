import { describe,expect,it } from 'vitest'
import { assertValidPdfBlob,generateTripPdf,tripPdfFilename } from './trip-pdf'
import type { Trip } from './types'

const trip:Trip={
  id:'trip-1',name:'Córdoba · Noviembre 2026',destination:'Córdoba',country:'Argentina',
  startDate:'2026-11-09',endDate:'2026-11-15',currency:'ARS',status:'planning',travelerCount:2,memberNames:[],role:'owner',
}

describe('trip PDF',()=>{
  it('creates a non-empty PDF with a safe filename',async()=>{
    const blob=await generateTripPdf({trip,activities:[],expenses:[],reservations:[],places:[]})
    await expect(assertValidPdfBlob(blob)).resolves.toBeUndefined()
    expect(blob.size).toBeGreaterThan(1024)
    expect(tripPdfFilename(trip.name)).toBe('tripmate-cordoba-noviembre-2026.pdf')
  })

  it('rejects empty files before download',async()=>{
    await expect(assertValidPdfBlob(new Blob())).rejects.toThrow('vacío o incompleto')
  })
})
