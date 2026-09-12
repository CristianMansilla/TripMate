export function localDateValue(date=new Date()){
  const year=date.getFullYear()
  const month=String(date.getMonth()+1).padStart(2,'0')
  const day=String(date.getDate()).padStart(2,'0')
  return `${year}-${month}-${day}`
}

export function newTripDateError(startDate:string,endDate:string,today=localDateValue()){
  if(!startDate || !endDate)return 'Completá las fechas de salida y vuelta.'
  if(startDate<today)return 'La fecha de salida no puede ser anterior a hoy.'
  if(endDate<startDate)return 'La fecha de vuelta no puede ser anterior a la de salida.'
  return null
}
