import locationService from './LocationService'
import weatherService from './WeatherService'
import tideService from './TideService'

/** GPS 좌표 확보 제한 시간 — 실외 저신호 환경에서 3초는 자주 모자라 좌표가 통째로 유실된다 */
const GPS_TIMEOUT_MS = 7000
/** 역지오코딩(주소명) 제한 시간 — 실패해도 좌표는 그대로 유지한다 */
const GEOCODE_TIMEOUT_MS = 4000

/**
 * 자동 태그 수집기 — 위치(7초 제한) → 날씨/물때/주소명 병렬 수집
 * 어떤 항목이 실패해도 나머지는 정상 반환 (저장 흐름을 막지 않음)
 *
 * 역지오코딩은 좌표 확보 뒤 별도 단계로 분리했다.
 * 좌표와 주소명을 한 덩어리로 기다리면 주소 조회가 느릴 때 좌표까지 null 이 되어
 * 기록의 위치 정보가 통째로 사라진다.
 */
class AutoTagService {
  async collectAll() {
    const location = await Promise.race([
      locationService.getCoords(),
      new Promise((r) => setTimeout(() => r(null), GPS_TIMEOUT_MS)),
    ])

    const [weather, tide, place] = await Promise.allSettled([
      location ? weatherService.getCurrentWeather(location.latitude, location.longitude) : Promise.resolve(null),
      location ? tideService.getTideInfo(location.latitude, location.longitude) : Promise.resolve(null),
      location
        ? Promise.race([
            locationService.reverseGeocode(location.latitude, location.longitude),
            new Promise((r) => setTimeout(() => r(null), GEOCODE_TIMEOUT_MS)),
          ])
        : Promise.resolve(null),
    ])

    return {
      location: location
        ? { ...location, locationName: place.status === 'fulfilled' ? place.value : null }
        : null,
      weather: weather.status === 'fulfilled' ? weather.value : null,
      tide: tide.status === 'fulfilled' ? tide.value : null,
    }
  }
}

const autoTagService = new AutoTagService()
export default autoTagService
