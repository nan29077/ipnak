import { dbService, computeStats } from './DatabaseService'

/**
 * 계측일지 데이터 소스 — 로컬(localStorage) 기록 + 서버(/api/catch) 기록 병합
 *
 * 계측일지는 원래 기기 localStorage 에만 남아 기기를 바꾸거나 앱을 지우면 통째로 사라졌다.
 * 저장 시 이미 /api/catch 로 서버에도 올라가고 있으므로, 그 데이터를 함께 읽어 합친다.
 * 중복은 로컬 기록의 serverId(= 서버 CatchRecord id)로 걸러낸다.
 */

async function fetchServerRecords() {
  try {
    const res = await fetch('/api/catch?limit=200')
    if (!res.ok) return [] // 비로그인(401)·서버 오류 → 로컬 기록만으로 동작
    const json = await res.json()
    return Array.isArray(json?.items) ? json.items : []
  } catch {
    return [] // 오프라인 — 로컬 기록만 표시
  }
}

/** 병합된 전체 기록 (최신순). 서버 조회 실패 시 로컬 기록만 반환한다. */
export async function loadDiaryItems() {
  const [local, server] = await Promise.all([dbService.getAllMeasurements(), fetchServerRecords()])
  const linked = new Set(local.map((m) => m.serverId).filter(Boolean))
  const items = [
    ...local.map((m) => ({ ...m, source: 'local' })),
    ...server.filter((s) => !linked.has(s.serverId)).map((s) => ({ ...s, source: 'server' })),
  ]
  items.sort((a, b) => String(b.measuredAt || '').localeCompare(String(a.measuredAt || '')))
  return items
}

/** 어종·볼·키링·기간 필터 (DatabaseService.getMeasurements 와 동일 규칙) */
export function filterDiaryItems(items, { species = '', ballId = '', keyringId = '', dateFrom = '', dateTo = '' } = {}) {
  let list = Array.isArray(items) ? items : []
  if (species) list = list.filter((m) => m.speciesKr === species)
  if (ballId) list = list.filter((m) => m.ballId === ballId)
  if (keyringId) list = list.filter((m) => m.keyringId === keyringId)
  if (dateFrom) list = list.filter((m) => m.measuredAt >= dateFrom)
  if (dateTo) list = list.filter((m) => m.measuredAt <= dateTo)
  return list
}

/** 메모리 페이지네이션 */
export function pageOf(items, page = 1, limit = 20) {
  const start = (page - 1) * limit
  return { total: items.length, items: items.slice(start, start + limit) }
}

export { computeStats }
