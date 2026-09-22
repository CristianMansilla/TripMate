export const TRIP_ITEM_ATTACHMENTS_BUCKET='trip-item-attachments'
export const MAX_TRIP_ITEM_ATTACHMENT_SIZE=10*1024*1024

export async function attachmentPdfError(file:File){
  if(file.size<1 || file.size>MAX_TRIP_ITEM_ATTACHMENT_SIZE)return 'El PDF debe pesar entre 1 byte y 10 MB.'
  if(!file.name.toLowerCase().endsWith('.pdf'))return 'Sólo se pueden adjuntar archivos PDF.'
  const header=await file.slice(0,1024).text()
  if(!header.includes('%PDF-'))return 'El archivo seleccionado no es un PDF válido.'
  return null
}

export function tripItemAttachmentPath(tripId:string,itemId:string,attachmentId:string){
  return `${tripId}/${itemId}/${attachmentId}.pdf`
}

export function normalizeAttachmentUrl(value:string){
  try{
    const url=new URL(value.trim())
    return url.protocol==='https:'?url.toString():null
  }catch{return null}
}
