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
      text: '#ffffff',
      bg: 'rgba(0,0,0,0.72)',
      warning: '#ef4444',
    }
  }

  draw(canvas, { imageElement, ballResult, measureResult, headPoint, tailPoint, selectedSpecies, isMockMode }) {
    if (!canvas || !imageElement) return
    const ctx = canvas.getContext('2d')
    const w = imageElement.naturalWidth || imageElement.width || 640
    const h = imageElement.naturalHeight || imageElement.height || 480
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height)

    if (ballResult && ballResult.found) this._drawBall(ctx, ballResult, canvas)
    if (headPoint || tailPoint) this._drawMeasureLine(ctx, headPoint, tailPoint, measureResult && measureResult.lengthCm, canvas)
    if (measureResult) this._drawResultCard(ctx, measureResult, selectedSpecies, canvas)
    if (isMockMode) this._drawMockBanner(ctx, canvas)
  }

  _drawBall(ctx, ball, canvas) {
    const cx = ball.centerX
    const cy = ball.centerY
    const r = ball.diameterPx / 2

    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.strokeStyle = this.COLORS.ball
    ctx.lineWidth = Math.max(2, canvas.width * 0.004)
    ctx.setLineDash([8, 4])
    ctx.stroke()
    ctx.setLineDash([])

    ctx.fillStyle = this.COLORS.ball
    ctx.font = `bold ${Math.max(13, r * 0.45)}px sans-serif`
    ctx.textAlign = 'center'
    const label = ball.method === 'aruco' ? '20mm 마커' : '40mm'
    ctx.fillText(label, cx, Math.max(16, cy - r - 8))
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

  _drawResultCard(ctx, result, species, canvas) {
    const scale = Math.max(1, canvas.width / 640)
    const cardW = 170 * scale
    const cardH = 96 * scale
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
    ctx.font = `${13 * scale}px sans-serif`
    ctx.fillStyle = '#ccc'
    ctx.fillText(`약 ${result.weightG}g`, x + 10 * scale, y + 68 * scale)
    if (result.grade) {
      ctx.fillStyle = result.grade.color
      ctx.fillText(result.grade.label, x + 10 * scale, y + 86 * scale)
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
