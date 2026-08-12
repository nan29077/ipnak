/**
 * 측정 기록 로컬 DB (웹: localStorage 기반)
 * - Next.js 웹 환경이므로 localStorage 를 1차 저장소로 사용
 * - 추후 네이티브(Capacitor) 패키징 시 이 파일의 구현만 SQLite 로 교체하면 됨 (공개 API 동일 유지)
 * - 저장소 키는 계정별로 분리한다 (`ipnak_measurements_<userId>`).
 *   공용 기기에서 계정을 바꿔 로그인하면 앞 사람의 계측 기록이 그대로 보이던 문제를 막는다.
 * - 사진은 서버 업로드 URL(imageUrl)을 우선 저장하고, 업로드에 실패했을 때만
 *   base64(imageBase64)로 폴백한다 (localStorage 5MB 한도 보호).
 */

const STORE_PREFIX = 'ipnak_measurements_'
/** 계정 분리 이전에 쓰던 공용 키 — 최초 1회 현재 계정 키로 옮기고 삭제한다 */
const LEGACY_KEY = 'ipnak_measurements'
const UID_KEY = 'ipnak_uid'
const GUEST_UID = 'guest'

/** 현재 세션 사용자 id (UserProvider 가 렌더 시점에 주입) */
let currentUserId = null

/**
 * 로그인 사용자 식별자 등록/해제.
 * localStorage 에도 미러링해 두어 모듈 변수가 아직 비어 있는 순간에도 같은 키를 가리키게 한다.
 */
export function setLocalUserId(id) {
  const next = id ? String(id) : null
  if (currentUserId === next) return
  currentUserId = next
  if (typeof window === 'undefined') return
  try {
    if (next) localStorage.setItem(UID_KEY, next)
    else localStorage.removeItem(UID_KEY)
  } catch {
    /* 프라이빗 모드 등 — 모듈 변수만으로 동작 */
  }
  // 세션을 아는 시점에 바로 이관한다. 계측일지 화면을 열 때까지 미루면
  // 그 사이에 다른 계정으로 로그인한 사람이 공용 키를 가져갈 수 있다.
  if (next) migrateLegacyStore(next)
}

/**
 * 공용 키(ipnak_measurements) → 계정 키 1회성 이관.
 * 비로그인(guest) 상태에서는 건드리지 않는다 — 기존 기록은 로그인 사용자의 것이기 때문.
 */
function migrateLegacyStore(uid) {
  if (typeof window === 'undefined') return
  const key = `${STORE_PREFIX}${uid}`
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (raw == null) return
    const legacy = JSON.parse(raw)
    if (!Array.isArray(legacy) || legacy.length === 0) {
      localStorage.removeItem(LEGACY_KEY)
      return
    }
    const cur = JSON.parse(localStorage.getItem(key) || '[]')
    const curList = Array.isArray(cur) ? cur : []
    const seen = new Set(curList.map((m) => m.id))
    const merged = [...curList, ...legacy.filter((m) => m && !seen.has(m.id))]
    merged.sort((a, b) => String(b.measuredAt || '').localeCompare(String(a.measuredAt || '')))
    localStorage.setItem(key, JSON.stringify(merged))
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* 이관 실패해도 신규 키로 계속 진행 */
  }
}

/** 로그아웃 시 호출 — 계정 포인터만 해제한다 (기록 자체는 계정 키에 남아 재로그인 시 복구) */
export function clearLocalUserScope() {
  setLocalUserId(null)
}

function resolveUserId() {
  if (currentUserId) return currentUserId
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(UID_KEY) || null
  } catch {
    return null
  }
}

class DatabaseService {
  constructor() {
    this._ready = false
  }

  async initDB() {
    this._ready = typeof window !== 'undefined'
    return this._ready
  }

  /** 현재 계정의 저장소 키 (비로그인 상태는 guest 버킷) */
  _storeKey() {
    const uid = resolveUserId()
    // 세션 복원 직후 등 setLocalUserId 를 아직 못 탄 경로 대비 — 이관은 멱등하다
    if (uid) migrateLegacyStore(uid)
    return `${STORE_PREFIX}${uid || GUEST_UID}`
  }

  _lsGet(key, def) {
    if (typeof window === 'undefined') return def
    try {
      const v = JSON.parse(localStorage.getItem(key) || 'null')
      return v == null ? def : v
    } catch {
      return def
    }
  }

  _lsSet(key, val) {
    if (typeof window === 'undefined') return
    localStorage.setItem(key, JSON.stringify(val))
  }

  /** 측정 기록 저장 → { id, photoDropped } 반환 */
  async saveMeasurement(data) {
    await this.initDB()
    const key = this._storeKey()
    const list = this._lsGet(key, [])
    const item = {
      id: Date.now(),
      measuredAt: new Date().toISOString(),
      lengthCm: data.lengthCm,
      bodyWidth: data.bodyWidth ?? null, // 몸통 최대 너비(cm) — AI 자동 스캔 시에만
      weightG: data.weightG ?? null,
      speciesKr: data.speciesKr || '기타',
      confidence: data.confidence ?? null,
      confidenceGrade: data.confidenceGrade ?? null,
      // 서버 업로드 성공 시 URL 만 보관한다 (용량 절약). 실패 시에만 base64 폴백.
      imageUrl: data.imageUrl ?? null,
      imageBase64: data.imageUrl ? null : data.imageBase64 ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      locationName: data.locationName ?? null,
      weather: data.weather ?? null,
      temperature: data.temperature ?? null, // 기온(°C)
      tidePhase: data.tidePhase ?? null,     // 조석 상태 (밀물/썰물 등)
      tideName: data.tideName ?? null,       // 물때 이름 (예: "7물")
      waterTemp: data.waterTemp ?? null,     // 수온(°C)
      ballId: data.ballId ?? null,
      keyringId: data.keyringId ?? null, // 키링 모드 측정 시 연동된 입낚키링 ID
      serverId: null, // /api/catch 저장 성공 시 채워지는 서버 CatchRecord id
      synced: 0,
    }
    list.unshift(item)

    let photoDropped = false
    try {
      this._lsSet(key, list)
    } catch {
      // 용량 초과 → 사진(base64)을 떼고 재시도.
      if (item.imageBase64) {
        item.imageBase64 = null
        photoDropped = true
        // 서비스 레이어에서 UI 토스트를 직접 띄울 수 없으므로 CustomEvent 로 상위에 알린다.
        // StorageWarningListener (글로벌 레이아웃)가 이 이벤트를 수신해 토스트를 표시한다.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ipnak:storage-warning', {
            detail: { message: '저장 공간이 부족하여 기기 사진 미리보기가 삭제되었습니다. 수치는 정상 저장됩니다.' },
          }))
        }
      }
      try {
        this._lsSet(key, list)
      } catch {
        list.shift()
        throw new Error('저장 공간이 부족해요. 계측일지에서 오래된 기록을 삭제해주세요.')
      }
    }
    return { id: item.id, photoDropped }
  }

  /** /api/catch 저장 성공 시 서버 기록 id 를 연결하고 동기화 완료로 표시 */
  async attachServerId(id, serverId) {
    await this.initDB()
    const key = this._storeKey()
    const list = this._lsGet(key, [])
    const i = list.findIndex((m) => m.id === id)
    if (i < 0) return false
    list[i].serverId = serverId || null
    list[i].synced = serverId ? 1 : 0
    try {
      this._lsSet(key, list)
    } catch {
      return false
    }
    return true
  }

  /** 계측일지의 선택 환경정보(수온·물때)를 로컬 기록에 보완한다. */
  async updateMeasurement(id, patch) {
    await this.initDB()
    const key = this._storeKey()
    const list = this._lsGet(key, [])
    const i = list.findIndex((m) => m.id === id)
    if (i < 0) return false
    list[i] = { ...list[i], ...patch }
    this._lsSet(key, list)
    return true
  }

  /** 기록 목록 (페이지네이션 + 필터) */
  async getMeasurements({ page = 1, limit = 20, species = '', dateFrom = '', dateTo = '', ballId = '', keyringId = '' } = {}) {
    await this.initDB()
    let list = this._lsGet(this._storeKey(), [])
    if (species) list = list.filter((m) => m.speciesKr === species)
    if (ballId) list = list.filter((m) => m.ballId === ballId)
    if (keyringId) list = list.filter((m) => m.keyringId === keyringId)
    if (dateFrom) list = list.filter((m) => m.measuredAt >= dateFrom)
    if (dateTo) list = list.filter((m) => m.measuredAt <= dateTo)
    const start = (page - 1) * limit
    return { total: list.length, items: list.slice(start, start + limit) }
  }

  /** 필터 없이 전체 기록 (서버 기록과 병합할 때 사용) */
  async getAllMeasurements() {
    await this.initDB()
    const list = this._lsGet(this._storeKey(), [])
    return Array.isArray(list) ? list : []
  }

  /** 통계: 최대어 / 평균 길이 / 총 마릿수 / 어종별 마릿수 */
  async getStats() {
    await this.initDB()
    const list = this._lsGet(this._storeKey(), [])
    return computeStats(list)
  }

  async deleteMeasurement(id) {
    await this.initDB()
    const key = this._storeKey()
    const list = this._lsGet(key, []).filter((m) => m.id !== id)
    this._lsSet(key, list)
    return true
  }

  /** 서버 미동기화 기록 */
  async getUnsyncedMeasurements() {
    await this.initDB()
    return this._lsGet(this._storeKey(), []).filter((m) => !m.synced)
  }

  async markAsSynced(id) {
    await this.initDB()
    const key = this._storeKey()
    const list = this._lsGet(key, [])
    const i = list.findIndex((m) => m.id === id)
    if (i >= 0) {
      list[i].synced = 1
      this._lsSet(key, list)
    }
    return true
  }
}

/** 기록 배열 → 통계 (로컬/서버 병합 목록에도 그대로 쓴다) */
export function computeStats(list) {
  const items = Array.isArray(list) ? list : []
  const speciesMap = {}
  items.forEach((m) => {
    speciesMap[m.speciesKr] = (speciesMap[m.speciesKr] || 0) + 1
  })
  const sorted = [...items].sort((a, b) => (b.lengthCm || 0) - (a.lengthCm || 0))
  return {
    maxFish: sorted[0] || null,
    avgLength: items.length
      ? Math.round((items.reduce((s, m) => s + (m.lengthCm || 0), 0) / items.length) * 10) / 10
      : 0,
    totalCount: items.length,
    speciesBreakdown: speciesMap,
  }
}

export const dbService = new DatabaseService()
export default DatabaseService
