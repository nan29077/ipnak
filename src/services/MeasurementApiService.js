/**
 * 측정 서버 API 클라이언트
 * - NEXT_PUBLIC_USE_MOCK_API !== 'false' 이면 목 모드 (기본값: 목)
 * - 실제 서버(/api/v1/measurement/*) 준비 시 NEXT_PUBLIC_API_BASE_URL 설정 후 목 해제
 */
const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ''
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_API !== 'false'

class MeasurementApiService {
  get isMock() {
    return USE_MOCK || !BASE
  }

  _getToken() {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('ipnak_token') || ''
  }

  async analyze(imageBase64) {
    if (this.isMock) {
      const m = await import('@/mocks/measurementApi.mock')
      return m.mockAnalyze()
    }
    const res = await fetch(`${BASE}/api/v1/measurement/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this._getToken()}` },
      body: JSON.stringify({ image: imageBase64, ballDiameterMm: 40 }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`analyze 실패: ${res.status}`)
    return res.json()
  }

  async save(data) {
    if (this.isMock) return { measurementId: Date.now(), saved: true }
    const res = await fetch(`${BASE}/api/v1/measurement/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this._getToken()}` },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`save 실패: ${res.status}`)
    return res.json()
  }

  async getHistory(page = 1, limit = 20, species = '') {
    if (this.isMock) {
      const m = await import('@/mocks/measurementApi.mock')
      return m.mockHistory(page, limit, species)
    }
    const q = new URLSearchParams({ page: String(page), limit: String(limit), ...(species ? { species } : {}) })
    const res = await fetch(`${BASE}/api/v1/measurement/history?${q}`, {
      headers: { Authorization: `Bearer ${this._getToken()}` },
    })
    return res.json()
  }

  async getStats() {
    if (this.isMock) {
      const m = await import('@/mocks/measurementApi.mock')
      return m.mockStats()
    }
    const res = await fetch(`${BASE}/api/v1/measurement/stats`, {
      headers: { Authorization: `Bearer ${this._getToken()}` },
    })
    return res.json()
  }
}

const measurementApi = new MeasurementApiService()
export default measurementApi
