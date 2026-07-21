/**
 * 입낚볼 감지 엔진 (웹 전용)
 * 형광 오렌지 원형 물체를 이미지에서 찾아 픽셀→mm 비율 계산
 * 볼 실제 지름: 40mm 고정
 *
 * OpenCV.js 는 번들에 포함하지 않고 측정 페이지 진입 시 CDN 에서 지연 로드한다.
 * (기존 앱 번들/빌드에 영향 없음)
 */

const OPENCV_CDN = 'https://docs.opencv.org/4.8.0/opencv.js'
// js-aruco (원조 ArUco 딕셔너리) — 있으면 정밀(ArUco) 모드, 없어도 동작
const ARUCO_CDN = [
  'https://cdn.jsdelivr.net/gh/jcmellado/js-aruco@master/src/cv.js',
  'https://cdn.jsdelivr.net/gh/jcmellado/js-aruco@master/src/aruco.js',
]

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const exist = document.querySelector(`script[src="${src}"]`)
    if (exist) {
      if (exist.dataset.loaded === '1') return resolve()
      exist.addEventListener('load', () => resolve())
      exist.addEventListener('error', () => reject(new Error(`script load fail: ${src}`)))
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => { s.dataset.loaded = '1'; resolve() }
    s.onerror = () => reject(new Error(`script load fail: ${src}`))
    document.head.appendChild(s)
  })
}

class BallDetector {
  constructor() {
    this.BALL_REAL_DIAMETER_MM = 40
    // OpenCV HSV (H: 0~180) — 형광 오렌지 범위
    this.ORANGE_HSV = {
      lower: [5, 120, 120],
      upper: [25, 255, 255],
    }
    this.isReady = false
    this._readyPromise = null
  }

  /** OpenCV.js CDN 지연 로드 + 런타임 초기화 대기 */
  async init() {
    if (this.isReady) return
    if (this._readyPromise) return this._readyPromise

    this._readyPromise = (async () => {
      // ArUco 는 보조 수단 — 실패해도 무시
      Promise.all(ARUCO_CDN.map((s) => loadScript(s))).catch(() => {})

      await loadScript(OPENCV_CDN)

      // opencv.js 는 빌드에 따라 전역 cv 가 Promise 이거나, onRuntimeInitialized 콜백형
      if (window.cv && typeof window.cv.then === 'function') {
        window.cv = await window.cv
      }
      await new Promise((resolve, reject) => {
        const t0 = Date.now()
        const timer = setInterval(() => {
          if (window.cv && window.cv.Mat) {
            clearInterval(timer)
            window.openCVReady = true
            resolve()
          } else if (Date.now() - t0 > 20000) {
            clearInterval(timer)
            reject(new Error('OpenCV 로드 타임아웃'))
          }
        }, 100)
      })
      this.isReady = true
    })()

    try {
      await this._readyPromise
    } catch (e) {
      this._readyPromise = null
      throw e
    }
  }

  /**
   * 메인 감지: ArUco 마커 우선, 실패 시 오렌지 원형(볼) 감지
   * @param {HTMLImageElement|HTMLCanvasElement} imageElement
   */
  detectBest(imageElement) {
    const aruco = this.detectArUco(imageElement)
    if (aruco && aruco.found) return aruco
    return this.detect(imageElement)
  }

  /** 오렌지 볼 감지 (컨투어 우선 → Hough 폴백) */
  detect(imageElement) {
    if (!this.isReady || !window.cv) {
      return { found: false, errorMessage: 'OpenCV 초기화 중입니다. 잠시 후 다시 시도해주세요.' }
    }

    const cv = window.cv
    let src, rgb, hsv, mask
    try {
      src = cv.imread(imageElement) // RGBA
      rgb = new cv.Mat()
      hsv = new cv.Mat()
      cv.cvtColor(src, rgb, cv.COLOR_RGBA2RGB)
      cv.cvtColor(rgb, hsv, cv.COLOR_RGB2HSV)

      mask = this.filterOrange(hsv)

      // 1) 컨투어 기반 (바이너리 마스크에 더 강함)
      let ball = this._detectByContour(mask, src)
      // 2) Hough 폴백
      if (!ball) ball = this._detectByHough(mask, src)

      if (!ball) {
        return { found: false, errorMessage: null } // 상위에서 BALL_NOT_FOUND 처리
      }

      return {
        found: true,
        centerX: ball.cx,
        centerY: ball.cy,
        diameterPx: ball.diameter,
        mmPerPixel: this.BALL_REAL_DIAMETER_MM / ball.diameter,
        confidence: ball.score,
        method: 'ball',
        errorMessage: null,
      }
    } catch (e) {
      console.error('BallDetector.detect error:', e)
      return { found: false, errorMessage: '볼 감지 중 오류가 발생했어요.' }
    } finally {
      if (src) src.delete()
      if (rgb) rgb.delete()
      if (hsv) hsv.delete()
      if (mask) mask.delete()
    }
  }

  /** ArUco 마커(id 0, 실측 20mm) 감지 — js-aruco 로드된 경우에만 */
  detectArUco(imageElement) {
    try {
      if (typeof window === 'undefined' || !window.AR || !window.AR.Detector) return null
      const detector = new window.AR.Detector()
      const canvas = document.createElement('canvas')
      canvas.width = imageElement.naturalWidth || imageElement.width
      canvas.height = imageElement.naturalHeight || imageElement.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const markers = detector.detect(imageData)
      const marker0 = (markers || []).find((m) => m.id === 0)
      if (!marker0 || !marker0.corners || marker0.corners.length !== 4) return null

      const c = marker0.corners
      const w1 = Math.hypot(c[1].x - c[0].x, c[1].y - c[0].y)
      const w2 = Math.hypot(c[2].x - c[3].x, c[2].y - c[3].y)
      const avgWidthPx = (w1 + w2) / 2
      const MARKER_REAL_MM = 20
      if (avgWidthPx < 8) return null

      return {
        found: true,
        centerX: c.reduce((s, p) => s + p.x, 0) / 4,
        centerY: c.reduce((s, p) => s + p.y, 0) / 4,
        diameterPx: avgWidthPx * 2,
        mmPerPixel: MARKER_REAL_MM / avgWidthPx,
        confidence: 0.97,
        method: 'aruco',
        errorMessage: null,
      }
    } catch (e) {
      return null
    }
  }

  /** HSV 오렌지 마스크 + 모폴로지 정리 */
  filterOrange(hsvMat) {
    const cv = window.cv
    const mask = new cv.Mat()
    const lower = new cv.Mat(hsvMat.rows, hsvMat.cols, hsvMat.type(), [...this.ORANGE_HSV.lower, 0])
    const upper = new cv.Mat(hsvMat.rows, hsvMat.cols, hsvMat.type(), [...this.ORANGE_HSV.upper, 255])
    cv.inRange(hsvMat, lower, upper, mask)
    lower.delete()
    upper.delete()
    const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(7, 7))
    cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel)
    cv.morphologyEx(mask, mask, cv.MORPH_OPEN, kernel)
    kernel.delete()
    return mask
  }

  _detectByContour(mask, srcMat) {
    const cv = window.cv
    const contours = new cv.MatVector()
    const hierarchy = new cv.Mat()
    let best = null
    try {
      cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
      const minR = srcMat.cols * 0.01
      const maxR = srcMat.cols * 0.25

      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i)
        const area = cv.contourArea(cnt)
        const peri = cv.arcLength(cnt, true)
        if (peri <= 0 || area < Math.PI * minR * minR) { cnt.delete(); continue }

        const circle = cv.minEnclosingCircle(cnt)
        const r = circle.radius
        cnt.delete()
        if (r < minR || r > maxR) continue

        const circularity = (4 * Math.PI * area) / (peri * peri) // 1 = 완전한 원
        const fillRatio = area / (Math.PI * r * r)               // 가림 여부
        if (circularity < 0.55 || fillRatio < 0.55) continue

        const score = Math.min(1, circularity * 0.55 + fillRatio * 0.35 + Math.min(1, r / (srcMat.cols * 0.08)) * 0.10)
        if (!best || score > best.score) {
          best = { cx: circle.center.x, cy: circle.center.y, diameter: r * 2, score }
        }
      }
    } finally {
      contours.delete()
      hierarchy.delete()
    }
    return best
  }

  _detectByHough(mask, srcMat) {
    const cv = window.cv
    const circles = new cv.Mat()
    try {
      const minR = Math.floor(srcMat.cols * 0.01)
      const maxR = Math.floor(srcMat.cols * 0.25)
      cv.HoughCircles(mask, circles, cv.HOUGH_GRADIENT, 1, 50, 100, 30, minR, maxR)
      return this.validateBall(circles, srcMat, mask)
    } catch (e) {
      return null
    } finally {
      circles.delete()
    }
  }

  /** Hough 결과 중 오렌지 비율 검증 */
  validateBall(circles, srcMat, maskMat) {
    const cv = window.cv
    if (!circles || circles.cols === 0) return null
    let best = null
    for (let i = 0; i < circles.cols; i++) {
      const cx = circles.data32F[i * 3]
      const cy = circles.data32F[i * 3 + 1]
      const r = circles.data32F[i * 3 + 2]
      if (r < srcMat.cols * 0.01 || r > srcMat.cols * 0.25) continue

      const x0 = Math.max(0, Math.floor(cx - r))
      const y0 = Math.max(0, Math.floor(cy - r))
      const w = Math.min(Math.floor(r * 2), srcMat.cols - x0)
      const h = Math.min(Math.floor(r * 2), srcMat.rows - y0)
      if (w <= 0 || h <= 0) continue

      const roi = maskMat.roi(new cv.Rect(x0, y0, w, h))
      const orange = cv.countNonZero(roi)
      roi.delete()
      const ratio = orange / (Math.PI * r * r)
      if (ratio < 0.5) continue

      const score = Math.min(1.0, ratio * 0.8 + Math.min(1, r / (srcMat.cols * 0.10)) * 0.2)
      if (!best || score > best.score) {
        best = { cx, cy, diameter: r * 2, score }
      }
    }
    return best
  }
}

export default BallDetector
