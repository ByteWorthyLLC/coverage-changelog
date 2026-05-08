import { useEffect, useRef } from 'react'

export interface UrlState {
  view: string
  quickFilter: string
  sort: string
  search: string
  contractor: string
  entry: string
  impact: string
  docType: string
  tag: string
}

const DEFAULTS: UrlState = {
  view: 'radar',
  quickFilter: 'all',
  sort: 'impact',
  search: '',
  contractor: '',
  entry: '',
  impact: 'all',
  docType: 'all',
  tag: 'all',
}

export function readUrlState(): UrlState {
  if (typeof window === 'undefined') {
    return { ...DEFAULTS }
  }

  const params = new URLSearchParams(window.location.search)
  return {
    view: params.get('view') ?? DEFAULTS.view,
    quickFilter: params.get('q') ?? DEFAULTS.quickFilter,
    sort: params.get('sort') ?? DEFAULTS.sort,
    search: params.get('s') ?? DEFAULTS.search,
    contractor: params.get('contractor') ?? DEFAULTS.contractor,
    entry: params.get('entry') ?? DEFAULTS.entry,
    impact: params.get('impact') ?? DEFAULTS.impact,
    docType: params.get('doc') ?? DEFAULTS.docType,
    tag: params.get('tag') ?? DEFAULTS.tag,
  }
}

export function writeUrlState(state: UrlState): void {
  if (typeof window === 'undefined') {
    return
  }

  const params = new URLSearchParams()
  if (state.view !== DEFAULTS.view) params.set('view', state.view)
  if (state.quickFilter !== DEFAULTS.quickFilter) params.set('q', state.quickFilter)
  if (state.sort !== DEFAULTS.sort) params.set('sort', state.sort)
  if (state.search) params.set('s', state.search)
  if (state.contractor) params.set('contractor', state.contractor)
  if (state.entry) params.set('entry', state.entry)
  if (state.impact !== DEFAULTS.impact) params.set('impact', state.impact)
  if (state.docType !== DEFAULTS.docType) params.set('doc', state.docType)
  if (state.tag !== DEFAULTS.tag) params.set('tag', state.tag)

  const search = params.toString()
  const target = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` === target) {
    return
  }

  window.history.replaceState(null, '', target)
}

function urlStateKey(state: UrlState): string {
  return [
    state.view,
    state.quickFilter,
    state.sort,
    state.search,
    state.contractor,
    state.entry,
    state.impact,
    state.docType,
    state.tag,
  ].join('|')
}

export function useDebouncedUrlSync(state: UrlState, debounceMs = 200): void {
  const latestRef = useRef(state)
  const key = urlStateKey(state)

  useEffect(() => {
    latestRef.current = state
  })

  useEffect(() => {
    const id = window.setTimeout(() => writeUrlState(latestRef.current), debounceMs)
    return () => window.clearTimeout(id)
  }, [key, debounceMs])
}

export function shareableUrl(state: UrlState): string {
  if (typeof window === 'undefined') {
    return ''
  }

  const params = new URLSearchParams()
  if (state.view !== DEFAULTS.view) params.set('view', state.view)
  if (state.quickFilter !== DEFAULTS.quickFilter) params.set('q', state.quickFilter)
  if (state.sort !== DEFAULTS.sort) params.set('sort', state.sort)
  if (state.search) params.set('s', state.search)
  if (state.contractor) params.set('contractor', state.contractor)
  if (state.entry) params.set('entry', state.entry)
  if (state.impact !== DEFAULTS.impact) params.set('impact', state.impact)
  if (state.docType !== DEFAULTS.docType) params.set('doc', state.docType)
  if (state.tag !== DEFAULTS.tag) params.set('tag', state.tag)

  const search = params.toString()
  return `${window.location.origin}${window.location.pathname}${search ? `?${search}` : ''}`
}
