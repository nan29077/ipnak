import { dbService } from './DatabaseService'

/**
 * 오프라인 → 서버 동기화
 * - synced=0 인 로컬 기록을 /api/catch POST 로 재전송한다.
 *   (측정 저장 시 /api/catch 가 실패했거나 네트워크가 없었던 케이스 복구)
 * - 이미 serverId 가 있는 항목은 로컬 synced 플래그만 정정한다.
 * - 온라인 상태에서만 순차 업로드, 실패 항목은 다음 실행 때 재시도.
 */
class SyncService {
  constructor() {
    this._syncing = false
  }

  async syncPendingMeasurements() {
    if (this._syncing) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return

    this._syncing = true
    try {
      const pending = await dbService.getUnsyncedMeasurements()
      for (const item of pending) {
        // 서버 ID 는 이미 있지만 로컬 synced 플래그만 미정인 경우 — 플래그만 정정
        if (item.serverId) {
          await dbService.markAsSynced(item.id)
          continue
        }
        // 서버에 아직 없는 기록 → /api/catch POST 로 동기화
        try {
          const res = await fetch('/api/catch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              speciesName: item.speciesKr ?? item.species_kr ?? '기타',
              sizeCm: item.lengthCm ?? item.length_cm ?? null,
              bodyWidth: item.bodyWidth ?? null,
              estimatedWeight: item.weightG ?? item.weight_g ?? null,
              photoUrl: item.imageUrl ?? null,
              lat: item.latitude ?? null,
              lng: item.longitude ?? null,
              shareToFeed: false,
              ballId: item.ballId ?? item.ball_id ?? null,
              keyringId: item.keyringId ?? item.keyring_id ?? null,
            }),
            signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout
              ? AbortSignal.timeout(10000)
              : undefined,
          })
          if (res.ok) {
            const data = await res.json().catch(() => ({}))
            if (data?.catchId) {
              // 서버 기록 ID 연결 + synced=1 마킹
              await dbService.attachServerId(item.id, data.catchId)
            } else {
              await dbService.markAsSynced(item.id)
            }
          }
          // res.ok 아닌 경우(401, 500 등)는 다음 실행 때 재시도
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
