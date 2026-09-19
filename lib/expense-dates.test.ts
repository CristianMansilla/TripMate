import { describe,expect,it } from 'vitest'
import { groupExpensesByDate, MULTI_DATE_EXPENSES, UNDATED_EXPENSES } from './expense-dates'
import type { Activity, Expense } from './types'

const expense=(id:string,title:string):Expense=>({
  id,tripId:'trip-1',title,category:'Transporte',amount:6000,status:'estimated',scope:'per_person',
})

const activity=(id:string,expenseId:string,date:string,startTime?:string):Activity=>({
  id,expenseId,tripId:'trip-1',date,startTime,title:'Traslado',category:'Transporte',estimatedCost:6000,
  costScope:'per_person',status:'planned',
})

describe('expense date groups',()=>{
  it('separates equal expense titles by their linked activity date',()=>{
    const expenses=[expense('expense-2','Carlos Paz a Córdoba'),expense('expense-1','Carlos Paz a Córdoba')]
    const activities=[activity('activity-2','expense-2','2026-11-12'),activity('activity-1','expense-1','2026-11-10')]

    expect(groupExpensesByDate(expenses,activities).map(group=>[group.key,group.expenses[0].id])).toEqual([
      ['2026-11-10','expense-1'],
      ['2026-11-12','expense-2'],
    ])
  })

  it('puts recurring and undated expenses in explicit groups after dated expenses',()=>{
    const recurring={...expense('recurring','Hotel'),occurrences:[{date:'2026-11-10'},{date:'2026-11-11'}]}
    const groups=groupExpensesByDate([expense('undated','Seguro'),recurring,expense('dated','Cena')],[activity('a','dated','2026-11-09')])

    expect(groups.map(group=>group.key)).toEqual(['2026-11-09',MULTI_DATE_EXPENSES,UNDATED_EXPENSES])
  })
})
