// @flow

// one of the pattern must match
type OrPattern = {| __or: Array<Pattern> |}

// none of the pattern must match
type NotPattern = {| __not: Pattern |}

// value is an object with properties matching the patterns
type ObjectPattern = { [string]: Pattern }

// value is an array and all patterns must match a different item
type ArrayPattern = Array<Pattern>

// value equals the pattern
type ValuePattern = bool | number | string

export type Pattern = OrPattern | NotPattern | ObjectPattern | ArrayPattern | ValuePattern

const isObject = value => value !== null && typeof value === 'object'

const match = (pattern: Pattern, value: any) => {
  if (Array.isArray(pattern)) {
    return Array.isArray(value) && pattern.every((subpattern, i) => {
      const j = value.findIndex(subvalue => match(subvalue, subpattern), i)
      if (j === -1) {
        return false
      }
      const tmp = value[i]
      value[i] = value[j]
      value[j] = value[i]
    })
  }

  if (pattern !== null && typeof pattern === 'object') {
    const keys = Object.keys(pattern)
    if (keys.length === 1) {
      const [ key ] = keys
      if (key === '__or') {
        return (pattern: OrPattern).__or.some(subpattern => match(subpattern, value))
      }
      if (key === '__not') {
        return !match((pattern: NotPattern)._not, value)
      }
    }

    return isObject(value) && every((pattern: ObjectPattern), (subpattern, key) =>
      value[key] !== undefined && match(subpattern, value[key])
    )
  }


  return pattern === value
}
export { match as default }

export const createPredicate = pattern => value => match(pattern, value)
