import { jsPDF } from 'jspdf'
import { occurrenceEndDate } from './activity-dates'
import { money } from './money'
import { canonicalItemCategory, expenseGroupTotal, sortReservationsForDisplay } from './trip-item-rules'
import type { Activity, Expense, Reservation, Trip } from './types'

export type TripPdfInput={
  trip:Trip
  activities:Activity[]
  expenses:Expense[]
  reservations:Reservation[]
}

const activityStatuses:Record<Activity['status'],string>={
  idea:'Idea',planned:'Planificado',reserved:'Reservado',paid:'Pagado',done:'Realizado',
}
const expenseStatuses:Record<Expense['status'],string>={
  estimated:'Estimado',confirmed:'Confirmado',paid:'Pagado',
}
const reservationStatuses:Record<Reservation['status'],string>={
  pending:'Pendiente',watching:'En seguimiento',reserved:'Reservada',paid:'Pagada',
}

function dateLabel(value:string,weekday=false){
  return new Intl.DateTimeFormat('es-AR',{
    day:'numeric',month:'long',year:'numeric',weekday:weekday?'long':undefined,timeZone:'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function activityTime(activity:Activity){
  if(!activity.startTime)return 'Sin hora'
  return activity.endTime?`${activity.startTime} a ${activity.endTime}`:activity.startTime
}

function pdfText(value:string){
  return value
    .replace(/\u00a0/g,' ')
    .replace(/[·•]/g,' - ')
    .replace(/[→➜]/g,' a ')
    .replace(/[“”]/g,'"')
    .replace(/[‘’]/g,"'")
    .replace(/\s+-\s+-\s+/g,' - ')
}

export function tripPdfFilename(name:string){
  const clean=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-+|-+$/g,'').toLowerCase()
  return `tripmate-${clean || 'viaje'}.pdf`
}

export async function assertValidPdfBlob(blob:Blob){
  if(blob.size<1024)throw new Error('El PDF generado está vacío o incompleto.')
  const signature=await blob.slice(0,5).text()
  if(signature!=='%PDF-')throw new Error('El archivo generado no es un PDF válido.')
}

export async function generateTripPdf({trip,activities,expenses,reservations}:TripPdfInput){
  const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true})
  const pageWidth=doc.internal.pageSize.getWidth()
  const pageHeight=doc.internal.pageSize.getHeight()
  const margin=16
  const contentWidth=pageWidth-margin*2
  const bottom=pageHeight-16
  let y=18

  const ensure=(height:number)=>{
    if(y+height<=bottom)return
    doc.addPage()
    y=18
  }
  const lines=(value:string,width=contentWidth)=>doc.splitTextToSize(pdfText(value),width) as string[]
  const write=(value:string,x=margin,width=contentWidth,size=10,style:'normal'|'bold'='normal',color:[number,number,number]=[55,65,81])=>{
    const wrapped=lines(value,width)
    const lineHeight=size*.43
    doc.setFont('helvetica',style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    for(const line of wrapped){
      ensure(lineHeight)
      doc.text(line,x,y)
      y+=lineHeight
    }
    y+=1
  }
  const section=(title:string)=>{
    ensure(15)
    y+=4
    doc.setFillColor(91,76,240)
    doc.rect(margin,y-4,3,9,'F')
    write(title,margin+6,contentWidth-6,15,'bold',[20,28,48])
    doc.setDrawColor(220,224,233)
    doc.line(margin,y,pageWidth-margin,y)
    y+=4
  }
  const dayHeading=(title:string)=>{
    ensure(14)
    doc.setFillColor(244,242,255)
    doc.roundedRect(margin,y,contentWidth,10,2,2,'F')
    doc.setFillColor(91,76,240)
    doc.rect(margin,y,3,10,'F')
    doc.setFont('helvetica','bold')
    doc.setFontSize(11)
    doc.setTextColor(20,28,48)
    doc.text(pdfText(title),margin+7,y+6.5)
    y+=15
  }

  const travelers=Math.max(1,trip.travelerCount || 1)
  const sortedActivities=[...activities].sort((a,b)=>
    a.date.localeCompare(b.date) || (a.startTime || '99:99').localeCompare(b.startTime || '99:99') ||
    (a.position ?? 0)-(b.position ?? 0) || a.title.localeCompare(b.title,'es')
  )
  const dates=[...new Set(sortedActivities.map(activity=>activity.date))]
  const expenseTotal=(expense:Expense)=>{
    const linkedCount=activities.filter(activity=>activity.expenseId===expense.id || activity.id===expense.activityId).length
    return expenseGroupTotal(expense,travelers,linkedCount)
  }
  const groupBudget=expenses.filter(expense=>expense.included!==false).reduce((sum,expense)=>sum+expenseTotal(expense),0)

  doc.setFillColor(34,30,92)
  doc.rect(0,0,pageWidth,48,'F')
  doc.setTextColor(255,255,255)
  doc.setFont('helvetica','bold')
  doc.setFontSize(10)
  doc.text('TRIPMATE - PLAN DE VIAJE',margin,14)
  doc.setFontSize(22)
  doc.text(lines(trip.name,contentWidth).slice(0,2),margin,25)
  doc.setFont('helvetica','normal')
  doc.setFontSize(10)
  doc.text(pdfText([trip.destination,trip.country].filter(Boolean).join(' - ')),margin,42)
  y=58

  write(`Fechas: ${dateLabel(trip.startDate)} al ${dateLabel(trip.endDate)}`,margin,contentWidth,10,'bold',[20,28,48])
  write(`Viajeros: ${travelers}    Total grupo: ${money(groupBudget,trip.currency)}    Por persona: ${money(groupBudget/travelers,trip.currency)}`,margin,contentWidth,10,'normal')

  section('Itinerario')
  if(!dates.length)write('No hay actividades cargadas.')
  for(const date of dates){
    dayHeading(dateLabel(date,true))
    for(const activity of sortedActivities.filter(item=>item.date===date)){
      const textWidth=contentWidth-34
      const title=`${activity.title}${activity.optional?' - Opcional':''}`
      const metadata=[
        occurrenceEndDate(activity)!==activity.date?`Finaliza ${dateLabel(occurrenceEndDate(activity))}`:'',
        activity.place,activityStatuses[activity.status],canonicalItemCategory(activity.category),
      ].filter(Boolean).join(' - ')
      const estimated=8+lines(title,textWidth).length*4.7+lines(metadata,textWidth).length*4.1+(activity.notes?lines(activity.notes,textWidth).length*4.1:0)+(activity.steps?.length || 0)*8
      ensure(Math.min(estimated,bottom-18))
      doc.setDrawColor(226,229,236)
      doc.line(margin,y,pageWidth-margin,y)
      y+=5
      doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(55,65,81)
      doc.text(pdfText(activityTime(activity)),margin,y)
      const startY=y
      write(title,margin+34,textWidth,11,'bold',[20,28,48])
      if(metadata)write(metadata,margin+34,textWidth,9,'normal')
      if(activity.notes)write(activity.notes,margin+34,textWidth,9,'normal')
      for(const step of activity.steps || []){
        const stepText=[step.startTime,step.title,step.place,step.notes].filter(Boolean).join(' - ')
        write(`- ${stepText}`,margin+38,textWidth-4,8,'normal')
      }
      y=Math.max(y,startY+7)
      y+=2
    }
    y+=2
  }

  section('Presupuesto')
  if(!expenses.length)write('No hay gastos cargados.')
  for(const expense of expenses){
    const total=money(expenseTotal(expense),trip.currency)
    const detail=[canonicalItemCategory(expense.category),expenseStatuses[expense.status],expense.included===false?'Fuera del total':''].filter(Boolean).join(' - ')
    const amountWidth=38
    const titleWidth=contentWidth-amountWidth-4
    const rowHeight=Math.max(10,(lines(expense.title,titleWidth).length+lines(detail,titleWidth).length)*4.2+2)
    ensure(rowHeight)
    doc.setDrawColor(226,229,236);doc.line(margin,y,pageWidth-margin,y)
    y+=5
    const rowY=y
    write(expense.title,margin,titleWidth,10,'bold',[20,28,48])
    write(detail,margin,titleWidth,8,'normal')
    doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(20,28,48)
    doc.text(pdfText(total),pageWidth-margin,rowY,{align:'right'})
    y=Math.max(y,rowY+rowHeight)
  }
  ensure(10)
  doc.setDrawColor(91,76,240);doc.line(margin,y,pageWidth-margin,y)
  y+=5
  write(`Total incluido: ${money(groupBudget,trip.currency)}`,margin,contentWidth,11,'bold',[20,28,48])

  section('Reservas')
  const sortedReservations=[...reservations].sort(sortReservationsForDisplay)
  if(!sortedReservations.length)write('No hay reservas cargadas.')
  for(const reservation of sortedReservations){
    const detail=[reservationStatuses[reservation.status],reservation.dueDate?`Fecha límite: ${dateLabel(reservation.dueDate)}`:''].filter(Boolean).join(' - ')
    ensure(14)
    write(reservation.title,margin,contentWidth,10,'bold',[20,28,48])
    if(detail)write(detail,margin,contentWidth,9,'normal')
    if(reservation.notes)write(reservation.notes,margin,contentWidth,9,'normal')
    y+=2
  }

  const pageCount=doc.getNumberOfPages()
  for(let page=1;page<=pageCount;page++){
    doc.setPage(page)
    doc.setDrawColor(220,224,233)
    doc.line(margin,pageHeight-11,pageWidth-margin,pageHeight-11)
    doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(105,114,132)
    doc.text('La valija personal y los accesos de integrantes no se incluyen.',margin,pageHeight-6)
    doc.text(`${page} / ${pageCount}`,pageWidth-margin,pageHeight-6,{align:'right'})
  }

  return doc.output('blob')
}
