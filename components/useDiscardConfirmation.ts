'use client'

import { useCallback, useRef, useState } from 'react'

export function useDiscardConfirmation(isDirty:boolean,onClose:()=>void){
  const [discardOpen,setDiscardOpen]=useState(false)
  const isDirtyRef=useRef(isDirty)
  const onCloseRef=useRef(onClose)
  isDirtyRef.current=isDirty
  onCloseRef.current=onClose

  const requestClose=useCallback(()=>{
    if(isDirtyRef.current)setDiscardOpen(true)
    else onCloseRef.current()
  },[])
  const cancelDiscard=useCallback(()=>setDiscardOpen(false),[])
  const confirmDiscard=useCallback(()=>{
    setDiscardOpen(false)
    onCloseRef.current()
  },[])

  return {requestClose,discardOpen,cancelDiscard,confirmDiscard}
}
