'use client'

import { useCallback, useRef, useState } from 'react'

export function useDiscardConfirmation(isDirty:boolean,onClose:()=>void,blocked=false){
  const [discardOpen,setDiscardOpen]=useState(false)
  const isDirtyRef=useRef(isDirty)
  const onCloseRef=useRef(onClose)
  const blockedRef=useRef(blocked)
  isDirtyRef.current=isDirty
  onCloseRef.current=onClose
  blockedRef.current=blocked

  const requestClose=useCallback(()=>{
    if(blockedRef.current)return
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
