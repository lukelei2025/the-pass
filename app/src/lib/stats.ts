import type { ItemStatus, UserStats } from '../types'

export function getStatsDeltasForStatusChange(
  oldStatus: ItemStatus,
  newStatus: ItemStatus
): Partial<Record<keyof UserStats, number>> {
  const deltas: Partial<Record<keyof UserStats, number>> = {}

  if (oldStatus === 'pending' && newStatus !== 'pending') {
    deltas.totalProcessed = 1
  }

  if (newStatus === 'todo') {
    deltas.totalTodos = 1
  }

  if (newStatus === 'frozen') {
    deltas.totalStashed = 1
  }

  if (
    oldStatus === 'todo' &&
    ['cooked', 'frozen', 'thought'].includes(newStatus)
  ) {
    deltas.completedTodos = 1
  }

  return deltas
}
