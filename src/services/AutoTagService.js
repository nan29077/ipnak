import locationService from './LocationService'
import weatherService from './WeatherService'
import tideService from './TideService'

/**
 * 자동 태그 수집기 — 위치(3초 제한) → 날씨/물때 병렬 수집
 * 어떤 항목이 실패해도 나머지는 정상 반환 (저장 흐름을 막지 않음)
 */
class AutoTagService {
  async collectAll() {
    const location = await Promise.race([
      locationService.getCurrentPosition(),
      new Promise((r) => setTimeout(() => r(null), 3000)),
    ])

    const [weather, tide] = await Promise.allSettled([
      location ? weatherService.getCurrentWeather(location.latitude, location.longitude) : Promise.resolve(null),
      location ? tideService.getTideInfo(location.latitude, location.longitude) : Promise.resolve(null),
    ])

    return {
      location,
      weather: weather.status === 'fulfilled' ? weather.value : null,
      tide: tide.status === 'fulfilled' ? tide.value : null,
    }
  }
}

const autoTagService = new AutoTagService()
export default autoTagService
