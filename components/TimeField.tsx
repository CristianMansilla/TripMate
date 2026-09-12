'use client'

const HOURS=Array.from({length:24},(_,index)=>String(index).padStart(2,'0'))
const MINUTES=Array.from({length:60},(_,index)=>String(index).padStart(2,'0'))

export default function TimeField({id,label,value,onChange}:{
  id:string
  label:string
  value?:string
  onChange:(value:string)=>void
}){
  const [hour='',minute='']=value?.split(':') || []
  const labelId=`${id}-label`

  return <div className="field time-field">
    <span id={labelId} className="time-field-label">{label}</span>
    <div className="time-parts" role="group" aria-labelledby={labelId}>
      <select
        id={`${id}-hour`}
        aria-label={`${label}: hora`}
        value={hour}
        onChange={event=>onChange(event.target.value?`${event.target.value}:${minute || '00'}`:'')}
      >
        <option value="">--</option>
        {HOURS.map(option=><option value={option} key={option}>{option}</option>)}
      </select>
      <span aria-hidden="true">:</span>
      <select
        id={`${id}-minute`}
        aria-label={`${label}: minutos`}
        value={minute}
        onChange={event=>onChange(event.target.value?`${hour || '00'}:${event.target.value}`:'')}
      >
        <option value="">--</option>
        {MINUTES.map(option=><option value={option} key={option}>{option}</option>)}
      </select>
    </div>
  </div>
}
