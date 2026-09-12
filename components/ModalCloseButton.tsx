'use client'

import { X } from 'lucide-react'

export default function ModalCloseButton({onClick,disabled=false}:{onClick:()=>void,disabled?:boolean}){
  return <button type="button" className="icon-btn modal-close" onClick={onClick} disabled={disabled} aria-label="Cerrar" title="Cerrar" data-modal-close>
    <X size={19}/>
  </button>
}
