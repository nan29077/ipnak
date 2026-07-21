import { FISH_SPECIES } from '@/constants/errorMessages'

/**
 * 측정 계산기
 * - 픽셀 거리 × mm/px 비율 → 실제 길이(cm)
 * - 어종별 길이-무게 회귀식 (W = a × L^b, g 단위)
 * - 신뢰도 등급 / 금지체장 판정
 */
class MeasurementCalculator {
  /** 두 점 사이 실제 길이(cm, 소수 1자리) */
  calculateLength(headPoint, tailPoint, mmPerPixel, angleRad = 0) {
    const dx = tailPoint.x - headPoint.x
    const dy = tailPoint.y - headPoint.y
    const distancePx = Math.sqrt(dx * dx + dy * dy)
    const lengthMm = distancePx * mmPerPixel
    const corrected = angleRad ? lengthMm / Math.cos(Math.abs(angleRad)) : lengthMm
    return Math.round(corrected / 10 * 10) / 10 // mm → cm, 0.1cm 반올림
  }

  /** 길이(cm) → 추정 무게(g) */
  estimateWeight(lengthCm, species = 'default') {
    const formulas = {
      '농어':   { a: 0.0089, b: 3.02 }, '광어':   { a: 0.0071, b: 3.10 },
      '배스':   { a: 0.0085, b: 2.98 }, '우럭':   { a: 0.0120, b: 2.95 },
      '감성돔': { a: 0.0095, b: 3.05 }, '참돔':   { a: 0.0098, b: 3.01 },
      '붕어':   { a: 0.0102, b: 2.93 }, '잉어':   { a: 0.0115, b: 2.97 },
      '방어':   { a: 0.0078, b: 3.08 }, '고등어': { a: 0.0065, b: 3.15 },
      '갈치':   { a: 0.0055, b: 3.20 }, '삼치':   { a: 0.0072, b: 3.05 },
      default:  { a: 0.0090, b: 3.00 },
    }
    const f = formulas[species] || formulas.default
    return Math.round(f.a * Math.pow(lengthCm, f.b))
  }

  /** 신뢰도 등급 */
  getConfidenceGrade(confidence, method) {
    if (method === 'aruco' || confidence >= 0.85) return { grade: 'HIGH', label: '정밀 측정', color: '#22c55e' }
    if (confidence >= 0.60) return { grade: 'MEDIUM', label: '일반 측정', color: '#f59e0b' }
    return { grade: 'LOW', label: '재측정 권장', color: '#ef4444' }
  }

  /** 금지체장 판정 (null = 제한 없음) */
  checkLegalSize(lengthCm, species) {
    const found = FISH_SPECIES.find((f) => f.key === species)
    if (!found || !found.minLegalSize) return null
    return { belowLimit: lengthCm < found.minLegalSize, minSize: found.minLegalSize }
  }
}

export default MeasurementCalculator
