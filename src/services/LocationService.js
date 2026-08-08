/**
 * 위치 서비스 (웹: navigator.geolocation)
 * 카카오 로컬 API 키(NEXT_PUBLIC_KAKAO_MAP_KEY)가 있으면 역지오코딩으로 주소명 변환
 */
class LocationService {
  async getCurrentPosition() {
    try {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return null
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 5000,
          enableHighAccuracy: true,
          maximumAge: 60000,
        })
      })
      const { latitude, longitude } = pos.coords
      const locationName = await this._reverseGeocode(latitude, longitude)
      return { latitude, longitude, locationName }
    } catch (e) {
      console.warn('LocationService 실패:', e && e.message)
      return null
    }
  }

  async _reverseGeocode(lat, lng) {
    try {
      const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY
      if (!key) return null
      const res = await fetch(
        `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`,
        { headers: { Authorization: `KakaoAK ${key}` } }
      )
      if (!res.ok) return null
      const json = await res.json()
      const doc = json.documents && json.documents[0]
      return (doc && doc.address && doc.address.address_name) || null
    } catch {
      return null
    }
  }
}

const locationService = new LocationService()
export default locationService
