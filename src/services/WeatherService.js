/**
 * 날씨 서비스 — 서버 API(/api/weather/current)를 경유해 현재 날씨를 가져온다.
 *
 * 예전에는 브라우저에서 기상청 API 를 직접 호출했으나
 * NEXT_PUBLIC_WEATHER_API_KEY 가 배포에 없어 항상 null 이 반환됐고,
 * 그 결과 계측일지의 "날씨"가 계속 "-" 로 남았다.
 * 이제 서버 키(WEATHER_API_KEY / 관리자 설정)로 조회하며,
 * 키가 없으면 서버에서 Open-Meteo(키 불필요)로 폴백한다.
 * 실패 시 null 을 반환해 측정 저장 흐름은 그대로 진행된다.
 */
class WeatherService {
  async getCurrentWeather(lat, lng) {
    try {
      const res = await fetch(
        `/api/weather/current?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
        { signal: AbortSignal.timeout(8000) },
      )
      if (!res.ok) return null
      const data = await res.json()
      if (data.weather == null && data.temperature == null) return null
      return {
        temperature: data.temperature ?? null,
        weather: data.weather ?? null,
      }
    } catch (e) {
      console.warn('WeatherService 실패:', e && e.message)
      return null
    }
  }
}

const weatherService = new WeatherService()
export default weatherService
