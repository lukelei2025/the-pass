import { describe, expect, it } from 'vitest'
import { getStatsDeltasForStatusChange } from './stats'

describe('getStatsDeltasForStatusChange', () => {
  it('counts todo to frozen as completed todo', () => {
    expect(getStatsDeltasForStatusChange('todo', 'frozen')).toEqual({
      totalStashed: 1,
      completedTodos: 1,
    })
  })

  it('counts todo to thought as completed todo', () => {
    expect(getStatsDeltasForStatusChange('todo', 'thought')).toEqual({
      completedTodos: 1,
    })
  })
})
