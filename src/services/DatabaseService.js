/**
 * 측정 기록 로컬 DB (웹: localStorage 기반)
 * - Next.js 웹 환경이므로 localStorage 를 1차 저장소로 사용
 * - 추후 네이티브(Capacitor) 패키징 시 이 파일의 구현만 SQLite 로 교체하면 됨 (공개 API 동일 유지)
 * - 이미지 포함 저장 용량(localStorage 약 5MB) 초과 시 이미지 없이 재시도
 */

const STORE_KEY = 'ipnak_measurements'

class DatabaseService {
  constructor() {
    this._ready = false
  }

  async initDB() {
    this._ready = typeof window !== 'undefined'
    return this._ready
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

  /** 측정 기록 저장 → id 반환 */
  async saveMeasurement(data) {
    await this.initDB()
    const list = this._lsGet(STORE_KEY, [])
    const item = {
      id: Date.now(),
      measuredAt: new Date().toISOString(),
      lengthCm: data.lengthCm,
      weightG: data.weightG ?? null,
      speciesKr: data.speciesKr || '기타',
      confidence: data.confidence ?? null,
      confidenceGrade: data.confidenceGrade ?? null,
      imageBase64: data.imageBase64 ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      locationName: data.locationName ?? null,
      weather: data.weather ?? null,
      temperature: data.temperature ?? null,
      tidePhase: data.tidePhase ?? null,
      ballId: data.ballId ?? null,
      synced: 0,
    }
    list.unshift(item)
    try {
      this._lsSet(STORE_KEY, list)
    } catch (e) {
      // 용량 초과 → 이미지 제거 후 재시도
      item.imageBase64 = null
      try {
        this._lsSet(STORE_KEY, list)
      } catch (e2) {
        list.shift()
        throw new Error('저장 공간이 부족해요. 오래된 기록을 삭제해주세요.')
      }
    }
    return item.id
  }

  /** 기록 목록 (페이지네이션 + 필터) */
  async getMeasurements({ page = 1, limit = 20, species = '', dateFrom = '', dateTo = '' } = {}) {
    await this.initDB()
    let list = this._lsGet(STORE_KEY, [])
    if (species) list = list.filter((m) => m.speciesKr === species)
    if (dateFrom) list = list.filter((m) => m.measuredAt >= dateFrom)
    if (dateTo) list = list.filter((m) => m.measuredAt <= dateTo)
    const start = (page - 1) * limit
    return { total: list.length, items: list.slice(start, start + limit) }
  }

  /** 통계: 최대어 / 평균 길이 / 총 마릿수 / 어종별 마릿수 */
  async getStats() {
    await this.initDB()
    const list = this._lsGet(STORE_KEY, [])
    const speciesMap = {}
    list.forEach((m) => {
      speciesMap[m.speciesKr] = (speciesMap[m.speciesKr] || 0) + 1
    })
    const sorted = [...list].sort((a, b) => (b.lengthCm || 0) - (a.lengthCm || 0))
    return {
      maxFish: sorted[0] || null,
      avgLength: list.length
        ? Math.round((list.reduce((s, m) => s + (m.lengthCm || 0), 0) / list.length) * 10) / 10
        : 0,
      totalCount: list.length,
      speciesBreakdown: speciesMap,
    }
  }

  async deleteMeasurement(id) {
    await this.initDB()
    const list = this._lsGet(STORE_KEY, []).filter((m) => m.id !== id)
    this._lsSet(STORE_KEY, list)
    return true
  }

  /** 서버 미동기화 기록 */
  async getUnsyncedMeasurements() {
    await this.initDB()
    return this._lsGet(STORE_KEY, []).filter((m) => !m.synced)
  }

  async markAsSynced(id) {
    await this.initDB()
    const list = this._lsGet(STORE_KEY, [])
    const i = list.findIndex((m) => m.id === id)
    if (i >= 0) {
      list[i].synced = 1
      this._lsSet(STORE_KEY, list)
    }
    return true
  }
}

export const dbService = new DatabaseService()
export default DatabaseService
