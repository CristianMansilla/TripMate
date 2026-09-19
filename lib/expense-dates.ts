import type { Activity, Expense } from './types'

export const MULTI_DATE_EXPENSES='varias-fechas'
export const UNDATED_EXPENSES='sin-fecha'

export type ExpenseDateGroup={
  key:string
  expenses:Expense[]
}

export function activitiesForExpense(expense:Expense,activities:Activity[]){
  return activities.filter(activity=>activity.expenseId===expense.id || activity.id===expense.activityId)
}

export function expenseDates(expense:Expense,activities:Activity[]){
  const linkedDates=activitiesForExpense(expense,activities).map(activity=>activity.date)
  const occurrenceDates=(expense.occurrences || []).map(occurrence=>occurrence.date)
  return [...new Set([...linkedDates,...occurrenceDates,expense.date].filter((date):date is string=>Boolean(date)))].sort()
}

function expenseTime(expense:Expense,activities:Activity[]){
  const linkedTimes=activitiesForExpense(expense,activities).map(activity=>activity.startTime).filter(Boolean) as string[]
  const occurrenceTimes=(expense.occurrences || []).map(occurrence=>occurrence.startTime).filter(Boolean) as string[]
  return [expense.startTime,...linkedTimes,...occurrenceTimes].filter(Boolean).sort()[0] || '99:99'
}

export function groupExpensesByDate(expenses:Expense[],activities:Activity[]):ExpenseDateGroup[]{
  const sorted=[...expenses].sort((a,b)=>{
    const aDates=expenseDates(a,activities)
    const bDates=expenseDates(b,activities)
    const dateComparison=(aDates[0] || '9999-12-31').localeCompare(bDates[0] || '9999-12-31')
    if(dateComparison)return dateComparison
    const timeComparison=expenseTime(a,activities).localeCompare(expenseTime(b,activities))
    return timeComparison || a.title.localeCompare(b.title,'es')
  })
  const groups=new Map<string,Expense[]>()
  for(const expense of sorted){
    const dates=expenseDates(expense,activities)
    const key=dates.length>1?MULTI_DATE_EXPENSES:dates[0] || UNDATED_EXPENSES
    groups.set(key,[...(groups.get(key) || []),expense])
  }
  return [...groups.entries()]
    .sort(([a],[b])=>{
      const rank=(key:string)=>key===MULTI_DATE_EXPENSES?'9999-12-30':key===UNDATED_EXPENSES?'9999-12-31':key
      return rank(a).localeCompare(rank(b))
    })
    .map(([key,groupedExpenses])=>({key,expenses:groupedExpenses}))
}
