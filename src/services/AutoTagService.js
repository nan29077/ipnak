import locationService from './LocationService'
import weatherService from './WeatherService'
import tideService from './TideService'

/** GPS 좌표 확보 제한 시간 — 실외 저신호 환경에서 3초는 자주 모자라 좌표가 통째로 유실된다 */
const GPS_TIMEOUT_MS = 7000
/** 역지오코딩(주소명) 제한 시간 — 실패해도 좌표는 그대로 유지한다 */
const GEOCODE_TIMEOUT_MS = 10000

/**
 * 자동 태그 수집기 — 위치(7초 제한) → 날씨/물때/주소명 병렬 수집
 * 어떤 항목이 실패해도 나머지는 정상 반환 (저장 흐름을 막지 않음)
 *
 * 역지오코딩은 좌표 확보 뒤 별도 단계로 분리했다.
 * 좌표와 주소명을 한 덩어리로 기다리면 주소 조회가 느릴 때 좌표까지 null 이 되어
 * 기록의 위치 정보가 통째로 사라진다.
 */
class AutoTagService {
  /** 이미 확보한 좌표로 주소·날씨·해양 정보를 수집한다. */
  async collectAt(location) {
    if (!location) return { location: null, weather: null, tide: null }
    const [weather, tide, place] = await Promise.allSettled([
      weatherService.getCurrentWeather(location.latitude, location.longitude),
      tideService.getTideInfo(location.latitude, location.longitude),
      Promise.race([
        locationService.reverseGeocode(location.latitude, location.longitude),
        new Promise((r) => setTimeout(() => r(null), GEOCODE_TIMEOUT_MS)),
      ]),
    ])

    return {
      location: { ...location, locationName: place.status === 'fulfilled' ? place.value : null },
      weather: weather.status === 'fulfilled' ? weather.value : null,
      tide: tide.status === 'fulfilled' ? tide.value : null,
    }
  }

  async collectAll() {
    const location = await Promise.race([
      locationService.getCoords(),
      new Promise((r) => setTimeout(() => r(null), GPS_TIMEOUT_MS)),
    ])
    return this.collectAt(location)
  }

  /**
   * 첫 조회에서 일부 API만 늦거나 실패한 경우 같은 GPS 좌표로 빈 값만 한 번 보완한다.
   * 기존에 얻은 값은 덮어쓰지 않아 API별 응답 순서 때문에 정보가 사라지지 않는다.
   */
  async complete(existing) {
    if (!existing?.location) return this.collectAll()
    const retry = await this.collectAt(existing.location)
    return {
      location: {
        ...existing.location,
        locationName: existing.location.locationName ?? retry.location?.locationName ?? null,
      },
      weather: {
        temperature: existing.weather?.temperature ?? retry.weather?.temperature ?? null,
        weather: existing.weather?.weather ?? retry.weather?.weather ?? null,
      },
      tide: {
        ...(retry.tide ?? {}),
        ...(existing.tide ?? {}),
        tidePhase: existing.tide?.tidePhase ?? retry.tide?.tidePhase ?? null,
        mulddae: existing.tide?.mulddae ?? retry.tide?.mulddae ?? null,
        waterTemp: existing.tide?.waterTemp ?? retry.tide?.waterTemp ?? null,
        airTemp: existing.tide?.airTemp ?? retry.tide?.airTemp ?? null,
        windSpeed: existing.tide?.windSpeed ?? retry.tide?.windSpeed ?? null,
        windLabel: existing.tide?.windLabel ?? retry.tide?.windLabel ?? null,
      },
    }
  }
}

const autoTagService = new AutoTagService()
export default autoTagService
