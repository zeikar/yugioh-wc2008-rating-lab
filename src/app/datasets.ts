import { matchPath } from 'react-router'

// Which dataset is on view is part of the URL (MVP §3): `/research/…` or
// `/u/{uid}/…`. `base` is that prefix; every link inside the dataset starts with it.

export type ResearchRef = { kind: 'research'; base: string }
export type SaveRef = { kind: 'save'; uid: string; base: string }
export type DatasetRef = ResearchRef | SaveRef

export const RESEARCH: ResearchRef = { kind: 'research', base: '/research' }
export const RESEARCH_NAME = 'Research: emulator'

export function saveRef(uid: string): SaveRef {
  return { kind: 'save', uid, base: `/u/${uid}` }
}

// Firebase uids are 1–128 characters. A `/` (typed as %2F) would make a bad
// Firestore path, which throws instead of failing like a missing save.
const PLAUSIBLE_UID = /^[^/]{1,128}$/

/** The dataset a path is in; null outside any, such as `/`. */
export function datasetFromPath(pathname: string): DatasetRef | null {
  if (matchPath('/research/*', pathname)) return RESEARCH
  const uid = matchPath('/u/:uid/*', pathname)?.params.uid
  return uid && PLAUSIBLE_UID.test(uid) ? saveRef(uid) : null
}

/** The same page in another dataset, e.g. `/research/duelists` → `/u/{uid}/duelists`. */
export function switchPath(pathname: string, from: DatasetRef | null, to: DatasetRef): string {
  if (!from) return to.base
  const page = pathname
    .slice(from.base.length)
    .replace(/\/+$/, '')
    // A tournament exists in one dataset only; the other one's list is the same page there.
    .replace(/^\/tournaments\/[^/]+$/, '/tournaments')
  return to.base + page
}
