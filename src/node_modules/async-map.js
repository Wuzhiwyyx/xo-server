// @flow

import { map } from 'lodash'

type Collection = Array<any>

// Similar to map() + Promise.all() but wait for all promises to
// settle before rejecting (with the first error)
const asyncMap = (
  collection: Collection | Promise<Collection>,
  iteratee: (value: any, key: number, collection: Collection) => any
): Promise<Collection> => {
  if (!Array.isArray(collection)) {
    return collection.then(collection => asyncMap(collection, iteratee))
  }

  let errorContainer
  const onError = error => {
    if (errorContainer === undefined) {
      errorContainer = { error }
    }
  }

  return Promise.all(map(collection, (item, key, collection) =>
    new Promise(resolve => {
      resolve(iteratee(item, key, collection))
    }).catch(onError)
  )).then(values => {
    if (errorContainer !== undefined) {
      throw errorContainer.error
    }
    return values
  })
}

export { asyncMap as default }
