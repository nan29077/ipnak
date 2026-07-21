/**
 * 물고기 AI 감지 엔진
 * TensorFlow.js (CDN 지연 로드) + YOLOv8n 키포인트 모델로 머리·꼬리 감지
 * 모델(/models/fish_detector/model.json)이 없으면 목(Mock) 모드로 동작
 * → 목 모드에서는 사용자가 머리/꼬리를 직접 탭해서 측정
 */

const TFJS_CDN = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js'
const MODEL_URL = '/models/fish_detector/model.json'
const SPECIES_MAP = ['농어', '광어', '배스', '우럭', '감성돔', '참돔', '붕어', '잉어', '방어', '고등어', '갈치', '삼치']

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const exist = document.querySelector(`script[src="${src}"]`)
    if (exist) {
      if (exist.dataset.loaded === '1') return resolve()
      exist.addEventListener('load', () => resolve())
      exist.addEventListener('error', () => reject(new Error('tfjs load fail')))
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => { s.dataset.loaded = '1'; resolve() }
    s.onerror = () => reject(new Error('tfjs load fail'))
    document.head.appendChild(s)
  })
}

class FishDetector {
  constructor() {
    this.model = null
    this.isMockMode = false
    this.INPUT_SIZE = 640
    this.CONFIDENCE_THRESHOLD = 0.6
    this._initPromise = null
  }

  async init() {
    if (this.model || this.isMockMode) return
    if (this._initPromise) return this._initPromise

    this._initPromise = (async () => {
      try {
        // 모델 파일 존재 여부 먼저 확인 → 없으면 tfjs 자체를 로드하지 않음 (트래픽 절약)
        const head = await fetch(MODEL_URL, { method: 'HEAD' })
        if (!head.ok) throw new Error('모델 파일 없음')

        await loadScript(TFJS_CDN)
        const tf = window.tf
        if (!tf) throw new Error('tfjs 전역 객체 없음')

        try { await tf.setBackend('webgl') } catch { await tf.setBackend('cpu') }
        await tf.ready()
        this.model = await tf.loadGraphModel(MODEL_URL)
        await this._warmup(tf)
        console.log('FishDetector: 모델 로드 완료')
      } catch (e) {
        console.warn('FishDetector: 모델 없음 → 수동(목) 모드로 동작합니다.', e && e.message)
        this.isMockMode = true
      }
    })()
    return this._initPromise
  }

  async detect(imageElement) {
    await this.init()
    if (this.isMockMode || !this.model) return this._mockDetect(imageElement)

    const tf = window.tf
    let tensor
    try {
      tensor = tf.browser.fromPixels(imageElement)
        .resizeBilinear([this.INPUT_SIZE, this.INPUT_SIZE])
        .toFloat()
        .div(255.0)
        .expandDims(0)

      const output = this.model.predict(tensor)
      const out = Array.isArray(output) ? output[0] : output
      const data = await out.data()
      tensor.dispose()
      if (Array.isArray(output)) output.forEach((t) => t.dispose())
      else output.dispose()

      return this._parseOutput(data, imageElement)
    } catch (e) {
      if (tensor) tensor.dispose()
      console.error('FishDetector.detect error:', e)
      return this._mockDetect(imageElement)
    }
  }

  /**
   * YOLOv8-pose 출력 파싱 (x, y, w, h, conf, cls, kp1x, kp1y, kp2x, kp2y — 정규화 좌표 가정)
   * 실제 학습 모델의 출력 포맷에 맞게 이 함수만 수정하면 된다.
   */
  _parseOutput(data, imageElement) {
    const imgW = imageElement.naturalWidth || imageElement.width
    const imgH = imageElement.naturalHeight || imageElement.height
    const conf = data[4] || 0
    if (conf < this.CONFIDENCE_THRESHOLD) {
      return this._mockDetect({ naturalWidth: imgW, naturalHeight: imgH })
    }

    const classId = data[5] ? Math.round(data[5]) : 0
    const speciesKr = SPECIES_MAP[classId] || '기타'

    return {
      found: true,
      species: speciesKr,
      speciesKr,
      confidence: conf,
      headPoint: { x: (data[6] != null ? data[6] : 0.2) * imgW, y: (data[7] != null ? data[7] : 0.5) * imgH },
      tailPoint: { x: (data[8] != null ? data[8] : 0.8) * imgW, y: (data[9] != null ? data[9] : 0.5) * imgH },
      boundingBox: {
        x: (data[0] - data[2] / 2) * imgW,
        y: (data[1] - data[3] / 2) * imgH,
        width: data[2] * imgW,
        height: data[3] * imgH,
      },
    }
  }

  /** 목 모드: 감지 실패로 반환 → UI 가 수동 탭 측정으로 전환 */
  _mockDetect(imageElement) {
    const w = (imageElement && (imageElement.naturalWidth || imageElement.width)) || 400
    const h = (imageElement && (imageElement.naturalHeight || imageElement.height)) || 300
    return {
      found: false,
      species: 'unknown',
      speciesKr: '자동감지 준비중',
      confidence: 0,
      headPoint: { x: w * 0.2, y: h * 0.5 },
      tailPoint: { x: w * 0.8, y: h * 0.5 },
      boundingBox: { x: w * 0.1, y: h * 0.3, width: w * 0.8, height: h * 0.4 },
    }
  }

  async _warmup(tf) {
    const dummy = tf.zeros([1, this.INPUT_SIZE, this.INPUT_SIZE, 3])
    try {
      const r = this.model.predict(dummy)
      if (Array.isArray(r)) r.forEach((t) => t.dispose())
      else r.dispose()
    } catch (e) { /* warmup 실패는 무시 */ }
    dummy.dispose()
  }
}

export default FishDetector
