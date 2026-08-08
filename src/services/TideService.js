/**
 * 물때 서비스 — 서버 API(/api/tide/current)를 경유하여 조석 정보를 가져온다.
 * 키 노출 없이 동작하며, 실패 시 달 위상만 반환하고 정상 진행한다.
 */
class TideService {
  async getTideInfo(lat, lng) {
    const moonPhase = this._getMoonPhase()
    try {
      const res = await fetch(
        `/api/tide/current?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
        { signal: AbortSignal.timeout(8000) },
      )
      if (!res.ok) return { tidePhase: null, nextHighTide: null, moonPhase }
      const data = await res.json()
      return {
        tidePhase: data.tidePhase ?? null,
        nextHighTide: data.nextTideTime ?? null,
        moonPhase: data.moonPhase ?? moonPhase,
      }
    } catch (e) {
      console.warn('TideService 실패:', e && e.message)
      return { tidePhase: null, nextHighTide: null, moonPhase }
    }
  }

  /** 달 위상 (라인 아이콘/텍스트 표기용 — 이모지 미사용) */
  _getMoonPhase() {
    const synodic = 29.53058867
    const known = new Date('2000-01-06T18:14:00Z')
    const diff = (Date.now() - known.getTime()) / (1000 * 60 * 60 * 24)
    const idx = Math.floor((((diff % synodic) / synodic) * 8 + 0.5) % 8)
    return ['삭', '초승달', '상현달', '차오르는 달', '보름달', '기우는 달', '하현달', '그믐달'][idx]
  }
}

const tideService = new TideService()
export default tideService
