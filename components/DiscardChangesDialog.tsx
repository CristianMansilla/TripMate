'use client'

import ConfirmDialog from './ConfirmDialog'

export default function DiscardChangesDialog({onClose,onConfirm}:{onClose:()=>void,onConfirm:()=>void}){
  return <ConfirmDialog title="Descartar cambios" confirmLabel="Descartar" onClose={onClose} onConfirm={onConfirm}>
    Hay cambios sin guardar. Si cerrás ahora, se perderán.
  </ConfirmDialog>
}
