export const RESERVATION_DOCUMENTS_BUCKET='reservation-documents'
export const MAX_RESERVATION_DOCUMENT_SIZE=10*1024*1024

export async function reservationPdfError(file:File){
  if(file.size<1 || file.size>MAX_RESERVATION_DOCUMENT_SIZE)return 'El PDF debe pesar entre 1 byte y 10 MB.'
  if(!file.name.toLowerCase().endsWith('.pdf'))return 'Sólo se pueden adjuntar archivos PDF.'
  const header=await file.slice(0,1024).text()
  if(!header.includes('%PDF-'))return 'El archivo seleccionado no es un PDF válido.'
  return null
}

export function reservationDocumentPath(tripId:string,reservationId:string,documentId:string){
  return `${tripId}/${reservationId}/${documentId}.pdf`
}
