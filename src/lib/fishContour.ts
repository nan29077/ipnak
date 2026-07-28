/**
 * 실시간 물고기 윤곽 추출 (순수 Canvas API — 외부 라이브러리 없음)
 *
 * 파이프라인 (매 감지 틱마다):
 *   1. 원본 프레임(video/canvas)을 작은 작업 캔버스에 축소해 그린다 (최대 176px)
 *   2. getImageData() → 픽셀을 16단계 RGB 큐브(4096 bin)로 양자화
 *   3. 프레임 테두리(배경) / 중앙(피사체) 히스토그램을 각각 만들고 3D 박스 블러
 *      → 우도비 p(중앙) / p(테두리) 가 높은 색만 전경으로 판정 (이진 마스크)
 *   4. 3x3 열림/닫힘 연산으로 잡티 제거 + 구멍 메우기
 *   5. 가장 큰 4-연결 영역만 남기고, 바깥에서 채우지 못한 내부 구멍을 채움
 *   6. Moore-neighbor 경계 추적으로 "순서 있는" 외곽 포인트 배열 추출
 *   7. Douglas-Peucker 단순화 → Chaikin 스무딩 → 등간격 리샘플(144점)
 *   8. 이전 프레임 윤곽과 EMA 블렌딩 → 떨림 억제
 *
 * 반환 좌표는 원본 프레임 기준 정규화(0~1) 값이라, 오버레이 캔버스 크기와 무관하게 쓸 수 있다.
 */

export type Pt = { x: number; y: number };

export type ContourStatus =
  | "idle"       // 소스 없음 / 프레임 미준비 / 픽셀 접근 불가
  | "searching"  // 물고기로 볼 만한 영역을 못 찾음
  | "too-small"  // 윤곽이 너무 작음 (더 가까이)
  | "too-large"  // 윤곽이 화면 대부분을 차지 (더 멀리)
  | "locked";    // 유효 윤곽 확보

export type ContourFrame = {
  status: ContourStatus;
  /** 원본 프레임 기준 정규화 좌표(0~1). locked 가 아니면 빈 배열 */
  points: Pt[];
  /** 윤곽 면적 / 프레임 면적 */
  areaRatio: number;
};

const WORK_MAX = 176;        // 작업 캔버스 최대 변 길이 (속도/정확도 균형)
const BINS = 16 * 16 * 16;   // RGB 4비트 양자화 큐브
const BORDER_RATIO = 0.11;   // 배경 표본으로 쓸 테두리 두께 (프레임 대비)
const CENTER_RATIO = 0.62;   // 전경 표본으로 쓸 중앙 영역 크기 (프레임 대비)
const FG_RATIO = 1.7;        // 전경 판정 우도비 임계값
const NOISE_AREA = 0.004;    // 이 미만이면 "못 찾음"으로 간주
const MIN_AREA = 0.014;      // 이 미만이면 too-small
const MAX_AREA = 0.68;       // 이 초과면 too-large
const RESAMPLE_N = 144;      // 윤곽 리샘플 포인트 수 (프레임 간 대응용 고정 길이)
const RDP_TOL = 1.1;         // Douglas-Peucker 허용 오차 (작업 캔버스 px)
const SMOOTH_ALPHA = 0.42;   // 신규 윤곽 반영 비율 (낮을수록 부드럽지만 반응 느림)
const MAX_TRACE = 20000;     // 경계 추적 안전 상한

/** 8방향 (화면 좌표계 y-down 기준 시계방향): E, SE, S, SW, W, NW, N, NE */
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];

const emptyFrame = (status: ContourStatus, areaRatio = 0): ContourFrame => ({
  status,
  points: [],
  areaRatio,
});

export class FishContourDetector {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private w = 0;
  private h = 0;

  private m = new Uint8Array(0);   // 현재 마스크
  private t1 = new Uint8Array(0);  // 임시 버퍼 1
  private t2 = new Uint8Array(0);  // 임시 버퍼 2
  private labels = new Int32Array(0);
  private stack = new Int32Array(0);
  private bins = new Uint16Array(0); // 픽셀별 양자화 bin 인덱스

  private bgHist = new Float32Array(BINS);
  private fgHist = new Float32Array(BINS);
  private histA = new Float32Array(BINS);
  private histB = new Float32Array(BINS);

  /** 직전 프레임의 정규화 윤곽 (EMA 블렌딩용) */
  private prev: Pt[] | null = null;

  /** 내부 버퍼 해제 — 컴포넌트 언마운트 시 호출 */
  dispose() {
    this.canvas = null;
    this.ctx = null;
    this.prev = null;
  }

  /** 소스 프레임에서 물고기 윤곽 1회 추출 */
  detect(source: CanvasImageSource | null, sw: number, sh: number): ContourFrame {
    if (!source || !(sw > 0) || !(sh > 0)) return this.reset("idle");

    const scale = Math.min(1, WORK_MAX / Math.max(sw, sh));
    const w = Math.max(24, Math.round(sw * scale));
    const h = Math.max(24, Math.round(sh * scale));
    if (!this.ensure(w, h)) return this.reset("idle");

    const ctx = this.ctx!;
    let data: Uint8ClampedArray;
    try {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(source, 0, 0, w, h);
      data = ctx.getImageData(0, 0, w, h).data;
    } catch {
      // 프레임 미준비 / 크로스오리진 오염 캔버스 등
      return this.reset("idle");
    }

    this.buildMask(data);
    this.morphology();

    const compArea = this.keepLargestComponent();
    if (compArea <= 0) return this.reset("searching");

    const filled = this.fillHoles();
    const areaRatio = filled / (w * h);

    if (areaRatio < NOISE_AREA) return this.reset("searching");
    if (areaRatio < MIN_AREA) return this.reset("too-small", areaRatio);
    if (areaRatio > MAX_AREA) return this.reset("too-large", areaRatio);

    const traced = this.traceContour();
    if (traced.length < 12) return this.reset("searching", areaRatio);

    const simplified = rdp(traced, RDP_TOL);
    if (simplified.length < 6) return this.reset("searching", areaRatio);

    const smoothed = chaikin(chaikin(simplified));
    const resampled = resampleClosed(smoothed, RESAMPLE_N);
    if (resampled.length !== RESAMPLE_N) return this.reset("searching", areaRatio);

    const rotated = rotateToCanonicalStart(resampled);
    // 정규화 (원본 프레임 기준 0~1)
    const norm = rotated.map((p) => ({ x: p.x / w, y: p.y / h }));

    const prev = this.prev;
    const out =
      prev && prev.length === norm.length
        ? norm.map((p, i) => ({
            x: prev[i].x + (p.x - prev[i].x) * SMOOTH_ALPHA,
            y: prev[i].y + (p.y - prev[i].y) * SMOOTH_ALPHA,
          }))
        : norm;
    this.prev = out;

    return { status: "locked", points: out, areaRatio };
  }

  /* ── 내부 구현 ───────────────────────────────────────────── */

  private reset(status: ContourStatus, areaRatio = 0): ContourFrame {
    this.prev = null;
    return emptyFrame(status, areaRatio);
  }

  private ensure(w: number, h: number): boolean {
    if (typeof document === "undefined") return false;
    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
      this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    }
    if (!this.ctx) return false;
    if (this.w !== w || this.h !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      const n = w * h;
      this.m = new Uint8Array(n);
      this.t1 = new Uint8Array(n);
      this.t2 = new Uint8Array(n);
      this.labels = new Int32Array(n);
      this.stack = new Int32Array(n);
      this.bins = new Uint16Array(n);
      this.w = w;
      this.h = h;
      this.prev = null; // 해상도 바뀌면 시간축 스무딩 초기화
    }
    return true;
  }

  /** 테두리(배경) 대비 중앙(피사체) 색 우도비로 이진 마스크 생성 */
  private buildMask(data: Uint8ClampedArray) {
    const { w, h, m, bins, bgHist, fgHist } = this;
    bgHist.fill(0);
    fgHist.fill(0);

    const bx = Math.max(1, Math.round(w * BORDER_RATIO));
    const by = Math.max(1, Math.round(h * BORDER_RATIO));
    const cx0 = Math.round(w * (1 - CENTER_RATIO) * 0.5);
    const cx1 = w - cx0;
    const cy0 = Math.round(h * (1 - CENTER_RATIO) * 0.5);
    const cy1 = h - cy0;

    let bgN = 0;
    let fgN = 0;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      const isBorderRow = y < by || y >= h - by;
      const inCenterRow = y >= cy0 && y < cy1;
      for (let x = 0; x < w; x++) {
        const i = row + x;
        const p = i * 4;
        const bin = ((data[p] >> 4) << 8) | ((data[p + 1] >> 4) << 4) | (data[p + 2] >> 4);
        bins[i] = bin;
        if (isBorderRow || x < bx || x >= w - bx) {
          bgHist[bin] += 1;
          bgN++;
        } else if (inCenterRow && x >= cx0 && x < cx1) {
          fgHist[bin] += 1;
          fgN++;
        }
      }
    }
    if (bgN === 0 || fgN === 0) {
      m.fill(0);
      return;
    }

    // 양자화 경계 아티팩트 완화 — 3D 박스 블러 (축 분리)
    blurCube(bgHist, this.histA, this.histB);
    blurCube(fgHist, this.histA, this.histB);

    // 블러로 총합이 커졌으므로 각자 총합으로 재정규화
    let bgSum = 0;
    let fgSum = 0;
    for (let b = 0; b < BINS; b++) {
      bgSum += bgHist[b];
      fgSum += fgHist[b];
    }
    if (bgSum <= 0 || fgSum <= 0) {
      m.fill(0);
      return;
    }
    const epsB = 1 / bgN;
    const epsF = 1 / fgN;

    for (let i = 0; i < m.length; i++) {
      const b = bins[i];
      const pb = bgHist[b] / bgSum + epsB;
      const pf = fgHist[b] / fgSum + epsF;
      m[i] = pf > pb * FG_RATIO ? 1 : 0;
    }
  }

  /** 3x3 열림(잡티 제거) → 닫힘(구멍/틈 메움) */
  private morphology() {
    const { m, t1, t2 } = this;
    this.minmax(m, t1, t2, false); // erode → t1
    this.minmax(t1, m, t2, true);  // dilate → m  (열림 완료)
    this.minmax(m, t1, t2, true);  // dilate → t1
    this.minmax(t1, m, t2, false); // erode → m   (닫힘 완료)
  }

  /** 3x3 분리형 min/max 필터 (경계는 replicate 패딩) */
  private minmax(src: Uint8Array, dst: Uint8Array, tmp: Uint8Array, max: boolean) {
    const { w, h } = this;
    for (let y = 0; y < h; y++) {
      const o = y * w;
      for (let x = 0; x < w; x++) {
        const v = src[o + x];
        const a = x > 0 ? src[o + x - 1] : v;
        const b = x < w - 1 ? src[o + x + 1] : v;
        tmp[o + x] = max ? (v > a ? (v > b ? v : b) : a > b ? a : b) : v < a ? (v < b ? v : b) : a < b ? a : b;
      }
    }
    for (let y = 0; y < h; y++) {
      const o = y * w;
      for (let x = 0; x < w; x++) {
        const v = tmp[o + x];
        const a = y > 0 ? tmp[o - w + x] : v;
        const b = y < h - 1 ? tmp[o + w + x] : v;
        dst[o + x] = max ? (v > a ? (v > b ? v : b) : a > b ? a : b) : v < a ? (v < b ? v : b) : a < b ? a : b;
      }
    }
  }

  /** 4-연결 라벨링 후 가장 큰 영역만 마스크에 남긴다. 반환: 남은 픽셀 수 */
  private keepLargestComponent(): number {
    const { w, h, m, labels, stack } = this;
    labels.fill(0);
    let cur = 0;
    let bestLabel = 0;
    let bestCount = 0;

    for (let s = 0; s < m.length; s++) {
      if (m[s] === 0 || labels[s] !== 0) continue;
      cur++;
      let top = 0;
      stack[top++] = s;
      labels[s] = cur;
      let count = 0;
      while (top > 0) {
        const i = stack[--top];
        count++;
        const x = i % w;
        const y = (i / w) | 0;
        if (x > 0 && m[i - 1] && !labels[i - 1]) { labels[i - 1] = cur; stack[top++] = i - 1; }
        if (x < w - 1 && m[i + 1] && !labels[i + 1]) { labels[i + 1] = cur; stack[top++] = i + 1; }
        if (y > 0 && m[i - w] && !labels[i - w]) { labels[i - w] = cur; stack[top++] = i - w; }
        if (y < h - 1 && m[i + w] && !labels[i + w]) { labels[i + w] = cur; stack[top++] = i + w; }
      }
      if (count > bestCount) { bestCount = count; bestLabel = cur; }
    }
    if (bestCount === 0) return 0;
    for (let i = 0; i < m.length; i++) m[i] = labels[i] === bestLabel ? 1 : 0;
    return bestCount;
  }

  /** 프레임 바깥에서 도달할 수 없는 배경 픽셀(=내부 구멍)을 채운다. 반환: 최종 면적 */
  private fillHoles(): number {
    const { w, h, m, t1, stack } = this;
    t1.fill(0); // 1 = 바깥과 연결된 배경
    let top = 0;
    const push = (i: number) => {
      if (m[i] === 0 && t1[i] === 0) { t1[i] = 1; stack[top++] = i; }
    };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (top > 0) {
      const i = stack[--top];
      const x = i % w;
      const y = (i / w) | 0;
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (y > 0) push(i - w);
      if (y < h - 1) push(i + w);
    }
    let area = 0;
    for (let i = 0; i < m.length; i++) {
      if (m[i] === 0 && t1[i] === 0) m[i] = 1;
      if (m[i]) area++;
    }
    return area;
  }

  /** Moore-neighbor 경계 추적 — 순서 있는 닫힌 외곽선 반환 */
  private traceContour(): Pt[] {
    const { w, h, m } = this;
    let sx = -1;
    let sy = -1;
    for (let i = 0; i < m.length && sx < 0; i++) {
      if (m[i]) { sx = i % w; sy = (i / w) | 0; }
    }
    if (sx < 0) return [];

    const pts: Pt[] = [];
    let cx = sx;
    let cy = sy;
    let back = 4; // 시작점의 서쪽은 반드시 배경 (행 우선 첫 히트)
    for (let step = 0; step < MAX_TRACE; step++) {
      pts.push({ x: cx, y: cy });
      let moved = false;
      for (let k = 1; k <= 8; k++) {
        const nd = (back + k) % 8;
        const nx = cx + DIRS[nd][0];
        const ny = cy + DIRS[nd][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (!m[ny * w + nx]) continue;
        back = (nd + 4) % 8; // 새 픽셀에서 이전 픽셀을 가리키는 방향
        cx = nx;
        cy = ny;
        moved = true;
        break;
      }
      if (!moved) break;                       // 고립 픽셀
      if (cx === sx && cy === sy) break;       // 한 바퀴 완료
    }
    return pts;
  }
}

/* ── 히스토그램 / 기하 유틸 ───────────────────────────────── */

/** 16³ RGB 큐브에 3x3x3 박스 블러 (축 분리, in-place) */
function blurCube(hist: Float32Array, a: Float32Array, b: Float32Array) {
  blurAxis(hist, a, 1);
  blurAxis(a, b, 16);
  blurAxis(b, hist, 256);
}

function blurAxis(src: Float32Array, dst: Float32Array, stride: number) {
  for (let i = 0; i < BINS; i++) {
    const c = ((i / stride) | 0) % 16;
    let s = src[i] * 2;
    if (c > 0) s += src[i - stride];
    if (c < 15) s += src[i + stride];
    dst[i] = s;
  }
}

/** Douglas-Peucker 단순화 (열린 폴리라인 취급 — 시작/끝점 보존) */
function rdp(pts: Pt[], tol: number): Pt[] {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    if (e <= s + 1) continue;
    const ax = pts[s].x;
    const ay = pts[s].y;
    const bx = pts[e].x;
    const by = pts[e].y;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let far = -1;
    let farD = tol;
    for (let i = s + 1; i < e; i++) {
      const d = Math.abs((pts[i].x - ax) * dy - (pts[i].y - ay) * dx) / len;
      if (d > farD) { farD = d; far = i; }
    }
    if (far > 0) {
      keep[far] = 1;
      stack.push([s, far], [far, e]);
    }
  }
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
  return out;
}

/** Chaikin 코너 컷 (닫힌 폴리곤) */
function chaikin(pts: Pt[]): Pt[] {
  const n = pts.length;
  if (n < 4) return pts.slice();
  const out: Pt[] = new Array(n * 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    out[i * 2] = { x: p.x * 0.75 + q.x * 0.25, y: p.y * 0.75 + q.y * 0.25 };
    out[i * 2 + 1] = { x: p.x * 0.25 + q.x * 0.75, y: p.y * 0.25 + q.y * 0.75 };
  }
  return out;
}

/** 닫힌 폴리곤을 등간격 n개 포인트로 리샘플 */
function resampleClosed(pts: Pt[], n: number): Pt[] {
  const m = pts.length;
  if (m < 3) return [];
  const acc = new Float64Array(m + 1);
  for (let i = 1; i <= m; i++) {
    const a = pts[i - 1];
    const b = pts[i % m];
    acc[i] = acc[i - 1] + Math.hypot(b.x - a.x, b.y - a.y);
  }
  const total = acc[m];
  if (!(total > 0)) return [];

  const out: Pt[] = new Array(n);
  let seg = 1;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    while (seg < m && acc[seg] < target) seg++;
    const s0 = acc[seg - 1];
    const segLen = acc[seg] - s0 || 1;
    const r = (target - s0) / segLen;
    const a = pts[seg - 1];
    const b = pts[seg % m];
    out[k] = { x: a.x + (b.x - a.x) * r, y: a.y + (b.y - a.y) * r };
  }
  return out;
}

/**
 * 프레임 간 포인트 대응을 맞추기 위해 시작점을 정규화한다.
 * (중심에서 +x 방향에 가장 가까운 포인트를 index 0 으로)
 */
function rotateToCanonicalStart(pts: Pt[]): Pt[] {
  const n = pts.length;
  let cx = 0;
  let cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  cx /= n;
  cy /= n;
  let best = 0;
  let bestA = Infinity;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(Math.atan2(pts[i].y - cy, pts[i].x - cx));
    if (a < bestA) { bestA = a; best = i; }
  }
  if (best === 0) return pts;
  return pts.slice(best).concat(pts.slice(0, best));
}
