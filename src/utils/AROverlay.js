/**
 * AR 오버레이 렌더러
 * 측정 캔버스 위에 볼 링, 측정선, 결과 카드, 워터마크를 그린다.
 * (캔버스 좌표계 = 작업 이미지 좌표계, 최대 1280px 기준)
 */
class AROverlay {
  constructor() {
    this.COLORS = {
      ball: '#22c55e',
      head: '#ef4444',
      tail: '#3b82f6',
      line: '#fbbf24',
      width: '#22d3ee',
      text: '#ffffff',
      bg: 'rgba(0,0,0,0.72)',
      warning: '#ef4444',
    }
  }

  draw(canvas, { imageElement, ballResult, measureResult, headPoint, tailPoint, widthPoints, selectedSpecies, isMockMode }) {
    if (!canvas || !imageElement) return
    const ctx = canvas.getContext('2d')
    const w = imageElement.naturalWidth || imageElement.width || 640
    const h = imageElement.naturalHeight || imageElement.height || 480
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height)

    // 기준물(입낚볼) 원은 그리지 않는다 — 계산(mmPerPixel)에만 사용하고 화면에는 노출하지 않는다.
    // (ballResult 는 측정 스케일 기준으로만 쓰인다)
    if (headPoint || tailPoint) this._drawMeasureLine(ctx, headPoint, tailPoint, measureResult && measureResult.lengthCm, canvas)
    if (widthPoints) this._drawWidthLine(ctx, widthPoints, measureResult && measureResult.widthCm, canvas)
    if (measureResult) this._drawResultCard(ctx, measureResult, selectedSpecies, canvas)
    if (isMockMode) this._drawMockBanner(ctx, canvas)
  }

  _drawMeasureLine(ctx, head, tail, lengthCm, canvas) {
    const R = Math.max(8, canvas.width * 0.012)
    if (head && tail) {
      ctx.beginPath()
      ctx.moveTo(head.x, head.y)
      ctx.lineTo(tail.x, tail.y)
      ctx.strokeStyle = this.COLORS.line
      ctx.lineWidth = Math.max(2.5, canvas.width * 0.004)
      ctx.setLineDash([10, 5])
      ctx.stroke()
      ctx.setLineDash([])
    }

    const pts = []
    if (head) pts.push({ pt: head, color: this.COLORS.head })
    if (tail) pts.push({ pt: tail, color: this.COLORS.tail })
    pts.forEach(({ pt, color }) => {
      ctx.beginPath()
      ctx.arc(pt.x, pt.y, R, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
      // 십자선
      ctx.beginPath()
      ctx.moveTo(pt.x - R * 1.6, pt.y); ctx.lineTo(pt.x + R * 1.6, pt.y)
      ctx.moveTo(pt.x, pt.y - R * 1.6); ctx.lineTo(pt.x, pt.y + R * 1.6)
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'
      ctx.lineWidth = 1
      ctx.stroke()
    })

    if (lengthCm && head && tail) {
      const mx = (head.x + tail.x) / 2
      const my = (head.y + tail.y) / 2
      const label = `${lengthCm} cm`
      const fs = Math.max(16, canvas.width * 0.028)
      ctx.font = `bold ${fs}px sans-serif`
      ctx.textAlign = 'center'
      const tw = ctx.measureText(label).width
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(mx - tw / 2 - 8, my - fs - 12, tw + 16, fs + 12)
      ctx.fillStyle = this.COLORS.line
      ctx.fillText(label, mx, my - 8)
    }
  }

  /** 몸통 최대 너비 선 (전장에 수직) */
  _drawWidthLine(ctx, widthPoints, widthCm, canvas) {
    const { top, bottom } = widthPoints
    if (!top || !bottom) return

    ctx.beginPath()
    ctx.moveTo(top.x, top.y)
    ctx.lineTo(bottom.x, bottom.y)
    ctx.strokeStyle = this.COLORS.width
    ctx.lineWidth = Math.max(2, canvas.width * 0.0035)
    ctx.setLineDash([6, 4])
    ctx.stroke()
    ctx.setLineDash([])

    // 양 끝 짧은 마감선
    const r = Math.max(5, canvas.width * 0.008)
    const ux = bottom.x - top.x
    const uy = bottom.y - top.y
    const len = Math.hypot(ux, uy) || 1
    const px = -uy / len // 수직 단위벡터
    const py = ux / len
    ctx.beginPath()
    ctx.moveTo(top.x - px * r, top.y - py * r); ctx.lineTo(top.x + px * r, top.y + py * r)
    ctx.moveTo(bottom.x - px * r, bottom.y - py * r); ctx.lineTo(bottom.x + px * r, bottom.y + py * r)
    ctx.stroke()

    if (widthCm) {
      const mx = (top.x + bottom.x) / 2
      const my = (top.y + bottom.y) / 2
      const label = `폭 ${widthCm} cm`
      const fs = Math.max(12, canvas.width * 0.021)
      ctx.font = `bold ${fs}px sans-serif`
      ctx.textAlign = 'left'
      const tw = ctx.measureText(label).width
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(mx + r * 1.4, my - fs * 0.85, tw + 10, fs + 8)
      ctx.fillStyle = this.COLORS.width
      ctx.fillText(label, mx + r * 1.4 + 5, my + fs * 0.25)
    }
  }

  _drawResultCard(ctx, result, species, canvas) {
    const scale = Math.max(1, canvas.width / 640)
    const cardW = 170 * scale
    const hasWidth = result.widthCm != null
    const cardH = (hasWidth ? 114 : 96) * scale
    const pad = 12 * scale
    const x = canvas.width - cardW - pad
    const y = pad

    ctx.fillStyle = this.COLORS.bg
    this._roundRect(ctx, x, y, cardW, cardH, 10 * scale)
    ctx.fill()

    ctx.textAlign = 'left'
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${14 * scale}px sans-serif`
    ctx.fillText(species || '어종 선택', x + 10 * scale, y + 22 * scale)
    ctx.font = `bold ${22 * scale}px sans-serif`
    ctx.fillStyle = this.COLORS.line
    ctx.fillText(`${result.lengthCm} cm`, x + 10 * scale, y + 48 * scale)
    let lineY = 68
    if (hasWidth) {
      ctx.font = `${13 * scale}px sans-serif`
      ctx.fillStyle = this.COLORS.width
      ctx.fillText(`폭 ${result.widthCm} cm`, x + 10 * scale, y + lineY * scale)
      lineY += 18
    }
    ctx.font = `${13 * scale}px sans-serif`
    ctx.fillStyle = '#ccc'
    ctx.fillText(`약 ${result.weightG}g`, x + 10 * scale, y + lineY * scale)
    if (result.grade) {
      ctx.fillStyle = result.grade.color
      ctx.fillText(result.grade.label, x + 10 * scale, y + (lineY + 18) * scale)
    }
  }

  _drawMockBanner(ctx, canvas) {
    const scale = Math.max(1, canvas.width / 640)
    const hgt = 38 * scale
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(0, canvas.height - hgt, canvas.width, hgt)
    ctx.fillStyle = '#fbbf24'
    ctx.font = `${13 * scale}px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('AI 학습 중 — 머리와 꼬리를 직접 탭해 주세요', canvas.width / 2, canvas.height - hgt / 2 + 5 * scale)
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  /** 공유용 이미지 (워터마크 포함) */
  async getShareImage(canvas) {
    const out = document.createElement('canvas')
    out.width = canvas.width
    out.height = canvas.height
    const ctx = out.getContext('2d')
    ctx.drawImage(canvas, 0, 0)

    const scale = Math.max(1, out.width / 640)
    ctx.font = `bold ${14 * scale}px sans-serif`
    const wm = '입낚으로 측정'
    const tw = ctx.measureText(wm).width
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(out.width - tw - 24 * scale, out.height - 32 * scale, tw + 18 * scale, 24 * scale)
    ctx.fillStyle = '#fff'
    ctx.textAlign = 'right'
    ctx.fillText(wm, out.width - 12 * scale, out.height - 15 * scale)
    return new Promise((resolve) => out.toBlob(resolve, 'image/png', 0.92))
  }
}

export default AROverlay
