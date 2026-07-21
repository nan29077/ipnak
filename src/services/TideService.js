/**
 * 물때 서비스 — 바다누리(국립해양조사원) 조석 예보 (NEXT_PUBLIC_TIDE_API_KEY 필요)
 * 키가 없으면 물때 없이 정상 진행 (달 위상만 자체 계산)
 */
class TideService {
  async getTideInfo(lat, lng) {
    const moonPhase = this._getMoonPhase()
    try {
      const key = process.env.NEXT_PUBLIC_TIDE_API_KEY
      if (!key) return { tidePhase: null, nextHighTide: null, moonPhase }

      const now = new Date()
      const today = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      const obsCode = this._nearestObs(lat, lng)
      const url =
        `https://www.khoa.go.kr/api/oceangrid/tideObsPreTab/search.do` +
        `?ServiceKey=${key}&ObsCode=${obsCode}&Date=${today}&ResultType=json`
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
      if (!res.ok) return { tidePhase: null, nextHighTide: null, moonPhase }
      const json = await res.json()
      const tides = (json.result && json.result.data) || []
      const future = tides.filter((t) => {
        const d = new Date(t.tph_time || `${today.slice(0, 4)}-${today.slice(4, 6)}-${today.slice(6, 8)}T${t.hl_time || '00:00'}`)
        return d > now
      })
      const next = future[0]
      return {
        tidePhase: next ? ((next.hl_code === 'H' || /고조/.test(next.hl_code || '')) ? '만조' : '간조') : null,
        nextHighTide: next ? (next.tph_time || next.hl_time || null) : null,
        moonPhase,
      }
    } catch (e) {
      console.warn('TideService 실패:', e && e.message)
      return { tidePhase: null, nextHighTide: null, moonPhase }
    }
  }

  /** 주요 조위 관측소 중 가장 가까운 곳 선택 */
  _nearestObs(lat, lng) {
    const OBS = [
      { code: 'DT_0001', name: '인천', lat: 37.452, lng: 126.592 },
      { code: 'DT_0002', name: '평택', lat: 36.966, lng: 126.822 },
      { code: 'DT_0008', name: '군산', lat: 35.975, lng: 126.563 },
      { code: 'DT_0010', name: '목포', lat: 34.779, lng: 126.375 },
      { code: 'DT_0017', name: '여수', lat: 34.747, lng: 127.765 },
      { code: 'DT_0005', name: '부산', lat: 35.096, lng: 129.035 },
      { code: 'DT_0016', name: '울산', lat: 35.501, lng: 129.387 },
      { code: 'DT_0091', name: '포항', lat: 36.047, lng: 129.383 },
      { code: 'DT_0006', name: '묵호', lat: 37.550, lng: 129.116 },
      { code: 'DT_0004', name: '제주', lat: 33.527, lng: 126.543 },
      { code: 'DT_0023', name: '모슬포', lat: 33.214, lng: 126.251 },
    ]
    if (lat == null || lng == null) return OBS[0].code
    let best = OBS[0], bestD = Infinity
    for (const o of OBS) {
      const d = Math.pow(o.lat - lat, 2) + Math.pow(o.lng - lng, 2)
      if (d < bestD) { bestD = d; best = o }
    }
    return best.code
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
