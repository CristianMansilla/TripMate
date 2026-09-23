import type { ExpenseOccurrence } from './types'

export function occurrenceEndDate(occurrence:Pick<ExpenseOccurrence,'date'|'endDate'>){
  return occurrence.endDate || occurrence.date
}

export function isMultiDayOccurrence(occurrence:Pick<ExpenseOccurrence,'date'|'endDate'>){
  return Boolean(occurrence.date && occurrenceEndDate(occurrence)!==occurrence.date)
}

function dateFromValue(value:string){
  const [year,month,day]=value.split('-').map(Number)
  return new Date(Date.UTC(year,month-1,day))
}

function dateValue(date:Date){
  return date.toISOString().slice(0,10)
}

export function moveOccurrenceToDate(
  occurrence:Pick<ExpenseOccurrence,'date'|'endDate'>,
  nextDate:string,
  maxDate?:string,
){
  if(!nextDate)return {date:'',endDate:''}
  const currentEnd=occurrenceEndDate(occurrence)
  const duration=occurrence.date && currentEnd>=occurrence.date
    ?Math.round((dateFromValue(currentEnd).getTime()-dateFromValue(occurrence.date).getTime())/86_400_000)
    :0
  const shiftedEnd=dateFromValue(nextDate)
  shiftedEnd.setUTCDate(shiftedEnd.getUTCDate()+duration)
  const endDate=dateValue(shiftedEnd)
  return {date:nextDate,endDate:maxDate && endDate>maxDate?maxDate:endDate}
}

export function normalizeOccurrenceDateRange<T extends Pick<ExpenseOccurrence,'date'|'endDate'>>(occurrence:T){
  const endDate=occurrenceEndDate(occurrence)
  return {...occurrence,endDate:occurrence.date && endDate<occurrence.date?occurrence.date:endDate}
}

export function occurrenceDateError(
  occurrence:Pick<ExpenseOccurrence,'date'|'endDate'|'startTime'|'endTime'>,
  minDate:string,
  maxDate:string,
){
  const endDate=occurrenceEndDate(occurrence)
  if(!occurrence.date || occurrence.date<minDate || occurrence.date>maxDate || !endDate || endDate<minDate || endDate>maxDate){
    return 'Los días deben estar dentro de las fechas del viaje.'
  }
  if(endDate<occurrence.date)return 'La fecha de finalización no puede ser anterior al inicio.'
  if(endDate===occurrence.date && occurrence.startTime && occurrence.endTime && occurrence.endTime<=occurrence.startTime){
    return 'La hora de fin debe ser posterior a la hora de inicio.'
  }
  return null
}

function timeMinutes(time?:string){
  if(!time)return null
  const [hours,minutes]=time.split(':').map(Number)
  return Number.isFinite(hours) && Number.isFinite(minutes)?hours*60+minutes:null
}

function dateMinutes(date:string){
  const [year,month,day]=date.split('-').map(Number)
  return Date.UTC(year,month-1,day)/60000
}

export function occurrenceWindow(occurrence:Pick<ExpenseOccurrence,'date'|'endDate'|'startTime'|'endTime'>){
  const startOffset=timeMinutes(occurrence.startTime) ?? 0
  const start=dateMinutes(occurrence.date)+startOffset
  const endDate=occurrenceEndDate(occurrence)
  const endOffset=timeMinutes(occurrence.endTime)
    ?? (endDate===occurrence.date?startOffset+90:24*60)
  const end=dateMinutes(endDate)+endOffset
  return {start,end:Math.max(end,start)}
}

export function occurrencesOverlap(
  first:Pick<ExpenseOccurrence,'date'|'endDate'|'startTime'|'endTime'>,
  second:Pick<ExpenseOccurrence,'date'|'endDate'|'startTime'|'endTime'>,
){
  const a=occurrenceWindow(first)
  const b=occurrenceWindow(second)
  return a.start<b.end && b.start<a.end
}
