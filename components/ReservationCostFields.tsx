'use client'

import type { Expense, ReservationCostChoice } from '@/lib/types'
import { money } from '@/lib/money'

export type ReservationCostMode = ReservationCostChoice['mode']

export default function ReservationCostFields({
  mode,expenseId,amount,amountBasis,expenses,currency,legacyAmount,onModeChange,onExpenseChange,onAmountChange,onAmountBasisChange,
}:{
  mode:ReservationCostMode
  expenseId:string
  amount:string
  amountBasis:'per_person'|'group'
  expenses:Expense[]
  currency:string
  legacyAmount?:number
  onModeChange:(mode:ReservationCostMode)=>void
  onExpenseChange:(expenseId:string)=>void
  onAmountChange:(amount:string)=>void
  onAmountBasisChange:(basis:'per_person'|'group')=>void
}){
  const expenseAmount=(expense:Expense)=>expense.amount*(expense.occurrencePricing==='per_occurrence'?Math.max(1,expense.occurrences?.length || 0):1)
  return <>
    <div className="field full">
      <label htmlFor="reservation-cost-mode">Costo en Presupuesto</label>
      <select id="reservation-cost-mode" value={mode} onChange={event=>onModeChange(event.target.value as ReservationCostMode)}>
        <option value="none">Sin costo en Presupuesto</option>
        <option value="existing">Usar un gasto existente</option>
        <option value="new">Crear un gasto nuevo</option>
        {legacyAmount!==undefined&&<option value="legacy">Conservar importe anterior sin incluir</option>}
      </select>
    </div>
    {mode==='existing'&&<div className="field full">
      <label htmlFor="reservation-expense">Gasto</label>
      <select id="reservation-expense" value={expenseId} onChange={event=>onExpenseChange(event.target.value)} required>
        <option value="">Elegí un gasto</option>
        {expenses.map(expense=><option key={expense.id} value={expense.id}>{expense.title} · {money(expenseAmount(expense),expense.currency || currency)}{expense.amountBasis==='group'?' · grupo':''}{expense.included===false?' · fuera del total':''}</option>)}
      </select>
      {!expenses.length&&<small>No hay gastos disponibles para vincular.</small>}
    </div>}
    {mode==='new'&&<>
      <div className="field"><label htmlFor="reservation-new-expense-amount">Costo</label><input id="reservation-new-expense-amount" type="number" min="0" step="0.01" value={amount} onChange={event=>onAmountChange(event.target.value)} required/></div>
      <label className="toggle-field"><input type="checkbox" checked={amountBasis==='group'} onChange={event=>onAmountBasisChange(event.target.checked?'group':'per_person')}/><span><b>Precio para todo el grupo</b><small>Usalo sólo cuando el servicio tenga un único precio total.</small></span></label>
    </>}
    {mode==='legacy'&&legacyAmount!==undefined&&<div className="reservation-cost-note full">Importe anterior: <b>{money(legacyAmount,currency)}</b>. Se conserva en la reserva, pero no forma parte del presupuesto.</div>}
  </>
}
