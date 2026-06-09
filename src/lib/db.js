// Wrapper minimo de IndexedDB (idb) para cache stale-while-revalidate.

import { openDB } from 'idb'

const DB_NAME = 'sgsi-dashboard'
const STORE = 'cache'
let dbPromise = null

function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE)
      }
    })
  }
  return dbPromise
}

export async function cacheGet(key) {
  return (await db()).get(STORE, key)
}

export async function cacheSet(key, value) {
  return (await db()).put(STORE, value, key)
}

export async function cacheDelete(key) {
  return (await db()).delete(STORE, key)
}
