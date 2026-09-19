function utcDate(value:string){
  return new Date(`${value}T00:00:00Z`)
}

function datePart(value:string,options:Intl.DateTimeFormatOptions){
  return new Intl.DateTimeFormat('es-AR',{...options,timeZone:'UTC'}).format(utcDate(value))
}

export function longDateLabel(value:string,weekday=false){
  return datePart(value,{day:'numeric',month:'long',year:'numeric',weekday:weekday?'long':undefined})
}

export function tripDateRangeLabel(start:string,end:string){
  const startDate=utcDate(start)
  const endDate=utcDate(end)
  const startDayMonth=datePart(start,{day:'numeric',month:'long'})
  const endDayMonth=datePart(end,{day:'numeric',month:'long'})
  const startYear=startDate.getUTCFullYear()
  const endYear=endDate.getUTCFullYear()

  if(start===end)return longDateLabel(start)
  if(startYear===endYear)return `${startDayMonth} a ${endDayMonth} de ${endYear}`
  return `${longDateLabel(start)} a ${longDateLabel(end)}`
}
