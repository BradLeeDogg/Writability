// Executive-function helpers: the single next action, and a gentle deadline
// back-plan. Both are pure and offline.
//
// The aim is to externalise the hard parts of getting started: instead of
// facing the whole mountain, the student is shown exactly one next step, and a
// big deadline is broken into "about this much today".

import type { OutlineNode } from './types'

export interface NextAction {
  label: string
  prompt: string
}

/**
 * The first not-yet-done step, in reading order. A parent step (e.g. "Point 1")
 * is offered before its sub-steps; once it is checked, its children come next.
 */
export function nextAction(outline: OutlineNode[]): NextAction | null {
  let found: NextAction | null = null
  const walk = (list: OutlineNode[]): void => {
    for (const n of list) {
      if (found) return
      if (!n.done) {
        found = { label: n.label, prompt: n.prompt }
        return
      }
      if (n.children.length) walk(n.children)
    }
  }
  walk(outline)
  return found
}

export interface BackPlan {
  stepsLeft: number
  /** Days from today to the due date, inclusive of today. 0 when overdue. */
  daysAvailable: number
  /** Days past the due date, when overdue. */
  overdueDays: number
  /** A gentle "aim for about this many today" target. */
  perToday: number
  message: string
}

function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

function midnight(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Break the remaining steps across the days left until the due date. */
export function backPlan(dueDate: string, stepsLeft: number, now: Date = new Date()): BackPlan | null {
  const due = dueDate ? parseYmd(dueDate) : null
  if (!due) return null

  const diffDays = Math.round((midnight(due) - midnight(now)) / 86400000)

  if (stepsLeft <= 0) {
    return {
      stepsLeft: 0,
      daysAvailable: Math.max(0, diffDays + 1),
      overdueDays: Math.max(0, -diffDays),
      perToday: 0,
      message: 'All your steps are checked off. Nicely done.'
    }
  }

  if (diffDays < 0) {
    const overdueDays = -diffDays
    return {
      stepsLeft,
      daysAvailable: 0,
      overdueDays,
      perToday: stepsLeft,
      message: `This was due ${overdueDays} day${overdueDays === 1 ? '' : 's'} ago. Pick one step and start there.`
    }
  }

  const daysAvailable = diffDays + 1
  const perToday = Math.ceil(stepsLeft / daysAvailable)
  const dueWord = diffDays === 0 ? 'today' : diffDays === 1 ? 'tomorrow' : `in ${diffDays} days`
  return {
    stepsLeft,
    daysAvailable,
    overdueDays: 0,
    perToday,
    message: `${stepsLeft} step${stepsLeft === 1 ? '' : 's'} left, due ${dueWord}. Aim for about ${perToday} ${perToday === 1 ? 'step' : 'steps'} today.`
  }
}
