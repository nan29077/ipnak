import { dbService } from './DatabaseService'
import measurementApi from './MeasurementApiService'

/**
 * 오프라인 → 서버 동기화
 * - 목 API 모드에서는 실제 동기화하지 않음 (가짜 synced 마킹 방지, pending 유지)
 * - 온라인 상태에서만 순차 업로드, 실패 항목은 다음 실행 때 재시도
 */
class SyncService {
  constructor() {
    this._syncing = false
  }

  async syncPendingMeasurements() {
    if (this._syncing) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    if (measurementApi.isMock) return // 서버 준비 전 — 로컬 보관 유지

    this._syncing = true
    try {
      const pending = await dbService.getUnsyncedMeasurements()
      for (const item of pending) {
        try {
          await measurementApi.save({
            lengthCm: item.lengthCm ?? item.length_cm,
            weightG: item.weightG ?? item.weight_g,
            speciesKr: item.speciesKr ?? item.species_kr,
            measuredAt: item.measuredAt ?? item.measured_at,
            latitude: item.latitude,
            longitude: item.longitude,
            locationName: item.locationName ?? item.location_name,
            weather: item.weather,
            tidePhase: item.tidePhase ?? item.tide_phase,
            ballId: item.ballId ?? item.ball_id,
          })
          await dbService.markAsSynced(item.id)
        } catch (e) {
          console.warn('동기화 실패 (다음 실행 재시도):', e && e.message)
        }
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('ipnak_last_sync', new Date().toISOString())
      }
    } finally {
      this._syncing = false
    }
  }

  async getSyncStatus() {
    const pending = await dbService.getUnsyncedMeasurements()
    return {
      pendingCount: pending.length,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      lastSyncAt: typeof window !== 'undefined' ? localStorage.getItem('ipnak_last_sync') : null,
    }
  }
}

const syncService = new SyncService()
export default syncService
