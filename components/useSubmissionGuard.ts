'use client'

import { useRef } from 'react'

export function useSubmissionGuard(){
  const submitting=useRef(false)
  return async function runOnce(task:()=>Promise<void>){
    if(submitting.current)return false
    submitting.current=true
    try{await task();return true}
    finally{submitting.current=false}
  }
}
