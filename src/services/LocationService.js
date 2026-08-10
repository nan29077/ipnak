/**
 * 위치 서비스 (웹: navigator.geolocation)
 * - 좌표 획득(getCoords)과 주소명 변환(reverseGeocode)을 분리한다.
 *   역지오코딩이 느리거나 실패해도 좌표는 살아남아야 하기 때문 (기록 위치 소실 방지).
 * - 역지오코딩은 서버 프록시(/api/reverse-geocode)를 거친다 —
 *   카카오 REST 키를 클라이언트 번들에 노출하지 않기 위함.
 */
class LocationService {
  /** 좌표만 확보 (역지오코딩 없음). 실패 시 null */
  async getCoords() {
    try {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return null
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          // 호출부(AutoTagService)의 7초 상한보다 살짝 짧게 — 실외 저신호에서 측위할 시간을 벌되
          // 상한을 넘기지는 않게 한다
          timeout: 6500,
          enableHighAccuracy: true,
          maximumAge: 60000,
        })
      })
      const { latitude, longitude } = pos.coords
      return { latitude, longitude }
    } catch (e) {
      console.warn('LocationService 실패:', e && e.message)
      return null
    }
  }

  /** 좌표 → 주소명. 실패 시 null (좌표 자체는 호출부에서 유지한다) */
  async reverseGeocode(lat, lng) {
    try {
      const res = await fetch(`/api/reverse-geocode?lat=${lat}&lng=${lng}`)
      if (!res.ok) return null
      const json = await res.json()
      return json?.name ?? null
    } catch {
      return null
    }
  }

  /** 좌표 + 주소명 (기존 호출부 호환용) */
  async getCurrentPosition() {
    const coords = await this.getCoords()
    if (!coords) return null
    const locationName = await this.reverseGeocode(coords.latitude, coords.longitude)
    return { ...coords, locationName }
  }
}

const locationService = new LocationService()
export default locationService
