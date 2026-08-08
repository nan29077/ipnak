/**
 * 날씨 서비스 — 기상청 초단기실황 (NEXT_PUBLIC_WEATHER_API_KEY 필요)
 * 키가 없으면 null 반환 → 측정 저장은 날씨 없이 정상 진행
 */
class WeatherService {
  async getCurrentWeather(lat, lng) {
    try {
      const key = process.env.NEXT_PUBLIC_WEATHER_API_KEY
      if (!key) return null

      // 초단기실황은 매시 40분 이후 제공 → 40분 이전이면 직전 시각 사용
      const now = new Date()
      if (now.getMinutes() < 45) now.setHours(now.getHours() - 1)
      const yyyy = now.getFullYear()
      const mm = String(now.getMonth() + 1).padStart(2, '0')
      const dd = String(now.getDate()).padStart(2, '0')
      const base_date = `${yyyy}${mm}${dd}`
      const base_time = `${String(now.getHours()).padStart(2, '0')}00`

      const { nx, ny } = this._latlngToGrid(lat, lng)
      const url =
        `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst` +
        `?serviceKey=${key}&numOfRows=10&pageNo=1&dataType=JSON` +
        `&base_date=${base_date}&base_time=${base_time}&nx=${nx}&ny=${ny}`
      const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
      if (!res.ok) return null
      const json = await res.json()
      const items = (json.response && json.response.body && json.response.body.items && json.response.body.items.item) || []
      const T1H = (items.find((i) => i.category === 'T1H') || {}).obsrValue
      const PTY = (items.find((i) => i.category === 'PTY') || {}).obsrValue
      const weatherMap = { '0': '맑음', '1': '비', '2': '비/눈', '3': '눈', '5': '빗방울', '7': '빗방울/눈날림' }
      return {
        temperature: T1H != null ? parseFloat(T1H) : null,
        weather: weatherMap[PTY] || '맑음',
      }
    } catch (e) {
      console.warn('WeatherService 실패:', e && e.message)
      return null
    }
  }

  /** 위경도 → 기상청 LCC 격자 좌표 */
  _latlngToGrid(lat, lng) {
    const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0
    const OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136
    const DEGRAD = Math.PI / 180.0
    const re = RE / GRID
    const slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD
    const olon = OLON * DEGRAD, olat = OLAT * DEGRAD
    let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5)
    sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn)
    let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5)
    sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn
    let ro = Math.tan(Math.PI * 0.25 + olat * 0.5)
    ro = (re * sf) / Math.pow(ro, sn)
    let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5)
    ra = (re * sf) / Math.pow(ra, sn)
    let theta = lng * DEGRAD - olon
    if (theta > Math.PI) theta -= 2 * Math.PI
    if (theta < -Math.PI) theta += 2 * Math.PI
    theta *= sn
    return {
      nx: Math.floor(ra * Math.sin(theta) + XO + 0.5),
      ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5),
    }
  }
}

const weatherService = new WeatherService()
export default weatherService
