'use client'
import { useEffect, useId, useState } from 'react'

const customValue='__custom_category__'

function uniqueOptions(options:string[]){
  const seen=new Set<string>()
  return options
    .map(option=>option.trim())
    .filter(option=>{
      const key=option.toLowerCase()
      if(!option || seen.has(key))return false
      seen.add(key)
      return true
    })
}

export default function CategoryPicker({
  label='Categoría',
  value,
  options,
  onChange,
  required,
  className='',
}:{
  label?:string
  value:string
  options:string[]
  onChange:(value:string)=>void
  required?:boolean
  className?:string
}){
  const fieldId=useId()
  const choices=uniqueOptions(options)
  const matchesChoice=choices.some(option=>option.toLowerCase()===value.trim().toLowerCase())
  const [customMode,setCustomMode]=useState(Boolean(value.trim()) && !matchesChoice)
  const usingCustom=Boolean(value.trim()) && !matchesChoice
  const selectValue=customMode || usingCustom?customValue:value

  useEffect(()=>{
    if(!value.trim())return
    if(!matchesChoice)setCustomMode(true)
  },[matchesChoice,value])

  return <div className={`field ${className}`.trim()}>
    <label htmlFor={`${fieldId}-select`}>{label}</label>
    <select id={`${fieldId}-select`} value={selectValue} onChange={e=>{
      const next=e.target.value
      setCustomMode(next===customValue)
      onChange(next===customValue?'':next)
    }} required={required}>
      {choices.map(option=><option key={option} value={option}>{option}</option>)}
      <option value={customValue}>Otra categoría...</option>
    </select>
    {(selectValue===customValue || usingCustom)&&<input aria-label="Nueva categoría" value={value} onChange={e=>onChange(e.target.value)} placeholder="Nueva categoría" required={required} autoFocus/>}
  </div>
}
