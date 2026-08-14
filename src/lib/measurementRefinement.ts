/**
 * Measurement landmark refinement helpers.
 *
 * These functions deliberately have no DOM dependency so their geometry can be
 * verified with synthetic pixel buffers. The server vision result is treated as
 * a coarse hint; a refinement is accepted only when conservative shape checks
 * pass. Otherwise the original AI coordinates remain untouched.
 */

export type NormPoint = { x: number; y: number };

export type ReferenceGeometry = {
  centerX: number;
  centerY: number;
  radiusPx: number;
  refined: boolean;
  confidence: number;
  angularCoverage: number;
};

type PixelSource = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

type Circle = { x: number; y: number; r: number };
type PixelPoint = { x: number; y: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * AI 가 돌려주는 기준물 반지름 보정 계수.
 *
 * Vision 모델은 볼의 외곽이 아니라 내부 로고/하이라이트 영역의 경계를 잡는 경향이 있어
 * 반지름을 일관되게 과소 추정한다. 픽셀 기반 정밀화(refineReferenceCircle)가 성공하면
 * 실측 반지름을 쓰므로 이 계수는 필요 없고, 정밀화가 실패했을 때의 폴백에만 적용한다.
 * (반지름이 커지면 mmPerPixel 이 작아져 계측값이 과대 산출되는 것을 막는다)
 */
export const AI_REFERENCE_RADIUS_MARGIN = 1.15;

function isReferenceYellow(r8: number, g8: number, b8: number, testBall: boolean) {
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (max < 0.18 || delta < 0.075) return false;
  const saturation = delta / max;
  if (saturation < 0.24) return false;

  let hue = 0;
  if (max === r) hue = 60 * (((g - b) / delta) % 6);
  else if (max === g) hue = 60 * ((b - r) / delta + 2);
  else hue = 60 * ((r - g) / delta + 4);
  if (hue < 0) hue += 360;
  return hue >= (testBall ? 8 : 17) && hue <= 76;
}

function solve3x3(a: number[][], b: number[]): [number, number, number] | null {
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    if (Math.abs(m[pivot][col]) < 1e-8) return null;
    if (pivot !== col) [m[pivot], m[col]] = [m[col], m[pivot]];
    const div = m[col][col];
    for (let k = col; k < 4; k++) m[col][k] /= div;
    for (let row = 0; row < 3; row++) {
      if (row === col) continue;
      const f = m[row][col];
      for (let k = col; k < 4; k++) m[row][k] -= f * m[col][k];
    }
  }
  return [m[0][3], m[1][3], m[2][3]];
}

/** Algebraic least-squares circle fit: x²+y²+Dx+Ey+F=0. */
function fitCircle(points: PixelPoint[]): Circle | null {
  if (points.length < 12) return null;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  let sz = 0, sxz = 0, syz = 0;
  for (const p of points) {
    const z = -(p.x * p.x + p.y * p.y);
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    syy += p.y * p.y;
    sxy += p.x * p.y;
    sz += z;
    sxz += p.x * z;
    syz += p.y * z;
  }
  const n = points.length;
  const solved = solve3x3(
    [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]],
    [sxz, syz, sz],
  );
  if (!solved) return null;
  const [d, e, f] = solved;
  const x = -d / 2;
  const y = -e / 2;
  const rr = x * x + y * y - f;
  if (!(rr > 0) || !Number.isFinite(rr)) return null;
  return { x, y, r: Math.sqrt(rr) };
}

function angularCoverage(points: PixelPoint[], circle: Circle, bins = 48) {
  const hit = new Uint8Array(bins);
  for (const p of points) {
    let a = Math.atan2(p.y - circle.y, p.x - circle.x);
    if (a < 0) a += Math.PI * 2;
    hit[Math.min(bins - 1, Math.floor((a / (Math.PI * 2)) * bins))] = 1;
  }
  let count = 0;
  for (const v of hit) count += v;
  return count / bins;
}

/* ──────────────────────────────────────────────────────────────────────────
   방사형 확장 탐색 — 기준물 외곽 "실측"

   Vision 모델은 볼 표면의 로고·반사광 경계를 볼 외곽으로 착각해 반지름을 2배 이상
   과소 추정하는 프레임이 있다. AI 반지름 ±30~45% 창 안에서만 찾는 기존 경로로는
   이런 프레임이 영원히 작은 원으로 확정된다 (초록 기준원이 볼보다 훨씬 작게 보이는 원인).

   그래서 AI 중심에서 48방향으로 광선을 쏘아 "볼 색(주황~노랑)이 마지막으로 나타나는
   반경" = 실제 외곽을 방향별로 찾는다. 탐색 범위는 AI 반지름의 0.3~3.0배로,
   과소 추정된 힌트에서 바깥쪽으로 점진 확장한다.
     - 내부 로고·하이라이트는 "마지막 볼 색" 기준이라 자연스럽게 통과한다.
     - 볼 색이 끊긴 뒤 배경이 충분히 길게 이어질 때만 외곽으로 인정해, 노이즈 한두 픽셀로
       경계가 앞당겨지는 것을 막는다.
     - 끈·노란 배경으로 튄 방향은 중앙값 대비 ±28% 필터로 제거하고, 남은 경계점에
       원을 피팅해 중심·반지름을 함께 확정한다 (중심 보정 후 2회 반복).
   원형도(잔차)·각도 커버리지·반지름 비율 검증에 실패하면 null 을 돌려
   기존 경로(색 영역 피팅 → 방사 에지 → AI 원본 + 1.15 폴백)로 넘긴다.
   ────────────────────────────────────────────────────────────────────────── */
const RADIAL_DIRECTIONS = 48;
const RADIAL_MIN_SCALE = 0.3;
const RADIAL_MAX_SCALE = 3.0;
/** 유효 경계를 찾아야 하는 최소 방향 비율 */
const RADIAL_MIN_RAY_RATIO = 0.55;
/** 중앙값 대비 이 비율을 벗어난 방향은 끈·배경으로 새어나간 것으로 보고 버린다 */
const RADIAL_MEDIAN_TOLERANCE = 0.28;

type RayHit = { radius: number; x: number; y: number };

/**
 * 중심 (cx, cy) 에서 방향별로 "볼 색이 마지막으로 나타나는 반경"을 찾는다.
 * 경계를 확정하지 못한 방향(프레임 밖으로 나감·배경 구간 부족)은 결과에서 제외한다.
 */
function castBoundaryRays(
  source: PixelSource,
  cx: number,
  cy: number,
  aiR: number,
  testBall: boolean,
): RayHit[] {
  const { data, width, height } = source;
  const step = clamp(aiR * 0.025, 0.6, 2);
  const rMin = Math.max(1, aiR * RADIAL_MIN_SCALE);
  const rMax = aiR * RADIAL_MAX_SCALE;
  const isBall = (x: number, y: number) => {
    const px = Math.round(x);
    const py = Math.round(y);
    if (px < 0 || py < 0 || px >= width || py >= height) return null; // 프레임 밖
    const i = (py * width + px) * 4;
    return isReferenceYellow(data[i], data[i + 1], data[i + 2], testBall);
  };

  const hits: RayHit[] = [];
  for (let i = 0; i < RADIAL_DIRECTIONS; i++) {
    const a = (i / RADIAL_DIRECTIONS) * Math.PI * 2;
    const cs = Math.cos(a), sn = Math.sin(a);
    let lastBall = -1;   // 지금까지 확인한 가장 바깥쪽 볼 색 반경
    let gapStart = -1;   // 볼 색이 끊긴 지점
    let boundary = -1;
    let reached = rMin;  // 실제로 확인한 마지막 반경 (프레임 밖 이탈 대비)
    for (let r = rMin; r <= rMax; r += step) {
      const ball = isBall(cx + cs * r, cy + sn * r);
      if (ball === null) break; // 프레임 밖 — 아래 tail 검사로 판단
      reached = r;
      if (ball) {
        lastBall = r;
        gapStart = -1;
        continue;
      }
      if (lastBall > 0 && gapStart < 0) gapStart = r;
      // 배경이 충분히 길게 이어진 뒤에야 직전 볼 색 반경을 외곽으로 확정한다
      if (gapStart > 0 && r - gapStart >= Math.max(2, lastBall * 0.12)) { boundary = lastBall; break; }
    }
    if (boundary < 0 && lastBall > 0 && reached - lastBall >= Math.max(2, lastBall * 0.12)) {
      // 최대 반경까지 왔거나 프레임 밖으로 나갔지만 배경 구간은 충분히 확보된 경우
      boundary = lastBall;
    }
    if (boundary <= 0) continue;
    // step 양자화 오차(평균 step/2 만큼 과소)를 1/4 step 재탐색으로 줄인다
    const fine = step / 4;
    for (let r = boundary + fine; r <= boundary + step; r += fine) {
      if (isBall(cx + cs * r, cy + sn * r) !== true) break;
      boundary = r;
    }
    hits.push({ radius: boundary, x: cx + cs * boundary, y: cy + sn * boundary });
  }
  return hits;
}

/** 경계점 집합에 원을 피팅하고, 첫 원 근처 표본만 남겨 한 번 더 피팅한다. */
function fitCircleRobust(points: PixelPoint[]): { circle: Circle; inliers: PixelPoint[] } | null {
  const first = fitCircle(points);
  if (!first) return null;
  const limit = Math.max(2.5, first.r * 0.12);
  const inliers = points.filter((p) => Math.abs(Math.hypot(p.x - first.x, p.y - first.y) - first.r) <= limit);
  const second = fitCircle(inliers);
  return second ? { circle: second, inliers } : { circle: first, inliers: points };
}

/**
 * AI 반지름을 시작점으로 바깥쪽까지 확장 탐색해 기준물의 실제 외곽 원을 구한다.
 * 검증에 실패하면 null (호출 측이 기존 경로로 폴백).
 */
function refineCircleByRadialExpansion(
  source: PixelSource,
  coarse: { centerX: number; centerY: number; radiusPx: number },
  testBall: boolean,
): ReferenceGeometry | null {
  const aiR = coarse.radiusPx;
  const minRays = Math.ceil(RADIAL_DIRECTIONS * RADIAL_MIN_RAY_RATIO);
  let cx = coarse.centerX;
  let cy = coarse.centerY;
  let result: ReferenceGeometry | null = null;

  // 1회차는 AI 중심, 2회차는 보정된 중심에서 다시 쏜다 (중심이 치우쳐도 수렴)
  for (let iter = 0; iter < 2; iter++) {
    const hits = castBoundaryRays(source, cx, cy, aiR, testBall);
    if (hits.length < minRays) return null;
    const sorted = hits.map((h) => h.radius).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    if (!(median > 0)) return null;
    const kept = hits.filter((h) => Math.abs(h.radius - median) <= median * RADIAL_MEDIAN_TOLERANCE);
    if (kept.length < minRays) return null;

    const fitted = fitCircleRobust(kept.map((h) => ({ x: h.x, y: h.y })));
    if (!fitted) return null;
    const { circle, inliers } = fitted;
    if (!Number.isFinite(circle.x) || !Number.isFinite(circle.y) || !(circle.r > 0)) return null;

    const coverage = angularCoverage(inliers, circle, 36);
    const residual = inliers.length
      ? inliers.reduce((sum, p) => sum + Math.abs(Math.hypot(p.x - circle.x, p.y - circle.y) - circle.r), 0) / inliers.length
      : Infinity;
    const residualRatio = residual / Math.max(circle.r, 1);
    result = {
      centerX: circle.x,
      centerY: circle.y,
      radiusPx: circle.r,
      refined: true,
      confidence: clamp(
        coverage * 0.5 + (1 - Math.min(1, residualRatio / 0.14)) * 0.3 + (kept.length / RADIAL_DIRECTIONS) * 0.2,
        0,
        1,
      ),
      angularCoverage: coverage,
    };

    const radiusRatio = circle.r / aiR;
    const centerShift = Math.hypot(circle.x - coarse.centerX, circle.y - coarse.centerY);
    if (
      // 3배 상한에 붙었다면 노란 배경으로 새어나간 것이다
      radiusRatio < 0.6 || radiusRatio > RADIAL_MAX_SCALE * 0.95 ||
      centerShift > Math.max(aiR, circle.r * 0.6) ||
      coverage < 0.6 || residualRatio > 0.14
    ) return null;

    cx = circle.x;
    cy = circle.y;
  }
  return result;
}

/**
 * Color segmentation can split on a large white logo/highlight. This secondary
 * pass searches for the strongest circular radial edge around the AI hint.
 * It still requires yellow pixels inside most of the circumference, so nearby
 * deck texture or a random circular object cannot silently replace the marker.
 */
function refineCircleByRadialEdge(
  source: PixelSource,
  coarse: { centerX: number; centerY: number; radiusPx: number },
  testBall: boolean,
): ReferenceGeometry {
  const fallback: ReferenceGeometry = {
    centerX: coarse.centerX,
    centerY: coarse.centerY,
    radiusPx: coarse.radiusPx,
    refined: false,
    confidence: 0,
    angularCoverage: 0,
  };
  const { data, width, height } = source;
  const aiR = coarse.radiusPx;
  const sample = (x: number, y: number) => {
    const px = clamp(Math.round(x), 0, width - 1);
    const py = clamp(Math.round(y), 0, height - 1);
    const i = (py * width + px) * 4;
    return [data[i], data[i + 1], data[i + 2]] as const;
  };
  const colorDistance = (a: readonly number[], b: readonly number[]) =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 441.7;

  const centerStep = Math.max(2, aiR * 0.075);
  const radiusStep = Math.max(1.5, aiR * 0.045);
  const centerRange = aiR * 0.28;
  const angles = 56;
  let best: (ReferenceGeometry & { score: number; yellow: number }) | null = null;
  for (let cy = coarse.centerY - centerRange; cy <= coarse.centerY + centerRange + 0.01; cy += centerStep) {
    for (let cx = coarse.centerX - centerRange; cx <= coarse.centerX + centerRange + 0.01; cx += centerStep) {
      // AI 반지름은 볼 내부(로고/하이라이트) 기준으로 과소 추정되는 쪽으로 치우치므로
      // 탐색 범위를 바깥쪽(1.45배)까지 넓게 잡는다.
      for (let radius = aiR * 0.75; radius <= aiR * 1.45 + 0.01; radius += radiusStep) {
        const gap = Math.max(2, radius * 0.035);
        let gradient = 0;
        let edgeHits = 0;
        let yellowHits = 0;
        let outsideYellow = 0;
        for (let i = 0; i < angles; i++) {
          const a = (i / angles) * Math.PI * 2;
          const cs = Math.cos(a), sn = Math.sin(a);
          const inside = sample(cx + cs * (radius - gap), cy + sn * (radius - gap));
          const outside = sample(cx + cs * (radius + gap), cy + sn * (radius + gap));
          const edge = colorDistance(inside, outside);
          gradient += Math.min(0.65, edge);
          if (edge >= 0.09) edgeHits++;
          const y1 = sample(cx + cs * radius * 0.72, cy + sn * radius * 0.72);
          const y2 = sample(cx + cs * radius * 0.88, cy + sn * radius * 0.88);
          if (isReferenceYellow(...y1, testBall) || isReferenceYellow(...y2, testBall)) yellowHits++;
          const yo = sample(cx + cs * radius * 1.14, cy + sn * radius * 1.14);
          if (isReferenceYellow(...yo, testBall)) outsideYellow++;
        }
        const coverage = edgeHits / angles;
        const yellow = yellowHits / angles;
        const outside = outsideYellow / angles;
        const centerPenalty = Math.hypot(cx - coarse.centerX, cy - coarse.centerY) / aiR;
        const radiusPenalty = Math.abs(radius - aiR) / aiR;
        const score = gradient / angles + coverage * 0.24 + yellow * 0.3 - outside * 0.12 - centerPenalty * 0.08 - radiusPenalty * 0.05;
        if (!best || score > best.score) {
          best = { centerX: cx, centerY: cy, radiusPx: radius, refined: true, confidence: 0, angularCoverage: coverage, score, yellow };
        }
      }
    }
  }
  if (!best || best.angularCoverage < 0.4 || best.yellow < 0.3) return fallback;
  const confidence = clamp(best.angularCoverage * 0.48 + best.yellow * 0.34 + Math.min(1, best.score) * 0.18, 0, 1);
  return { ...best, confidence };
}

/**
 * Refines both the center and the radius of the yellow 40 mm spherical marker.
 * Internal logo holes, white glare and the thin yellow lanyard are rejected by
 * fitting only outer boundary samples and requiring broad angular coverage.
 */
export function refineReferenceCircle(
  source: PixelSource,
  coarse: { centerX: number; centerY: number; radiusPx: number },
  testBall = false,
): ReferenceGeometry {
  const fallback: ReferenceGeometry = {
    centerX: coarse.centerX,
    centerY: coarse.centerY,
    radiusPx: coarse.radiusPx,
    refined: false,
    confidence: 0,
    angularCoverage: 0,
  };
  const { data, width, height } = source;
  const aiR = coarse.radiusPx;
  if (!data || !(width > 0) || !(height > 0) || !(aiR >= 5)) return fallback;

  // ① AI 반지름을 시작점으로 바깥까지 확장 탐색해 실제 외곽을 찾는다.
  //    AI 가 반지름을 크게 과소 추정한 프레임(로고/반사광만 측정)을 바로잡는 유일한 경로이므로
  //    아래의 ±45% 창 기반 경로보다 먼저 시도한다. 검증 실패 시에만 기존 경로로 내려간다.
  const expanded = refineCircleByRadialExpansion(source, coarse, testBall);
  if (expanded) return expanded;

  const edgeFallback = () => refineCircleByRadialEdge(source, coarse, testBall);

  const searchR = Math.min(Math.max(aiR * 1.75, 18), Math.min(width, height) * 0.45);
  const x0 = clamp(Math.floor(coarse.centerX - searchR), 0, width - 1);
  const y0 = clamp(Math.floor(coarse.centerY - searchR), 0, height - 1);
  const x1 = clamp(Math.ceil(coarse.centerX + searchR), 0, width - 1);
  const y1 = clamp(Math.ceil(coarse.centerY + searchR), 0, height - 1);
  const rw = x1 - x0 + 1;
  const rh = y1 - y0 + 1;
  if (rw < 8 || rh < 8) return fallback;

  const mask = new Uint8Array(rw * rh);
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const src = ((y0 + y) * width + x0 + x) * 4;
      mask[y * rw + x] = isReferenceYellow(data[src], data[src + 1], data[src + 2], testBall) ? 1 : 0;
    }
  }

  // 8-connected components. The score favors a near, round, AI-sized object;
  // it does not simply pick the largest yellow region in the frame.
  const labels = new Int32Array(mask.length);
  const stack = new Int32Array(mask.length);
  let label = 0;
  let bestPixels: number[] | null = null;
  let bestScore = -Infinity;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue;
    label++;
    let top = 0;
    stack[top++] = start;
    labels[start] = label;
    const pixels: number[] = [];
    let minX = rw, minY = rh, maxX = 0, maxY = 0;
    let sumX = 0, sumY = 0;
    while (top) {
      const i = stack[--top];
      pixels.push(i);
      const x = i % rw;
      const y = (i / rw) | 0;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      sumX += x; sumY += y;
      for (let oy = -1; oy <= 1; oy++) {
        const ny = y + oy;
        if (ny < 0 || ny >= rh) continue;
        for (let ox = -1; ox <= 1; ox++) {
          if (!ox && !oy) continue;
          const nx = x + ox;
          if (nx < 0 || nx >= rw) continue;
          const ni = ny * rw + nx;
          if (mask[ni] && !labels[ni]) { labels[ni] = label; stack[top++] = ni; }
        }
      }
    }
    // 볼 표면이 로고·반사광으로 크게 잘려도 남은 노란 조각을 후보로 살린다.
    // (조각이 작아도 아래 원 피팅·각도 커버리지 검증을 통과해야만 채택된다)
    if (pixels.length < Math.max(20, Math.PI * aiR * aiR * 0.06)) continue;
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const aspect = Math.min(bw, bh) / Math.max(bw, bh);
    const cx = x0 + sumX / pixels.length;
    const cy = y0 + sumY / pixels.length;
    const dist = Math.hypot(cx - coarse.centerX, cy - coarse.centerY);
    const size = (bw + bh) / 4;
    const sizeFit = Math.max(0, 1 - Math.abs(size - aiR) / Math.max(aiR, 1));
    const proximity = Math.max(0, 1 - dist / Math.max(aiR * 1.25, 1));
    // AI 힌트 위치에 가까운 후보를 우선한다(proximity 가중 상향) — 배경의 노란 물체가
    // 더 크고 동그랗다는 이유만으로 기준물을 대체하지 못하게 한다.
    const score = aspect * 2.2 + sizeFit * 1.4 + proximity * 2.4 + Math.min(1, pixels.length / (Math.PI * aiR * aiR));
    if (score > bestScore) { bestScore = score; bestPixels = pixels; }
  }
  if (!bestPixels) return edgeFallback();

  const chosenLabel = labels[bestPixels[0]];
  const boundary: PixelPoint[] = [];
  for (const i of bestPixels) {
    const x = i % rw;
    const y = (i / rw) | 0;
    let edge = x === 0 || y === 0 || x === rw - 1 || y === rh - 1;
    if (!edge) {
      edge = labels[i - 1] !== chosenLabel || labels[i + 1] !== chosenLabel ||
        labels[i - rw] !== chosenLabel || labels[i + rw] !== chosenLabel;
    }
    if (!edge) continue;
    const gx = x0 + x;
    const gy = y0 + y;
    const d = Math.hypot(gx - coarse.centerX, gy - coarse.centerY);
    // Removes logo holes and long lanyard/cable edges before the first fit.
    // 1.48×aiR 은 AI 가 15~20% 과소 추정해도 실제 외곽을 충분히 포함하는 범위다.
    // 더 넓히면 끈·케이블 픽셀이 섞여 원 피팅 품질이 떨어진다.
    if (d >= aiR * 0.48 && d <= aiR * 1.48) boundary.push({ x: gx, y: gy });
  }
  if (boundary.length < 18) return edgeFallback();

  let circle = fitCircle(boundary);
  if (!circle) return edgeFallback();
  // Robust second fit: retain only samples close to the first circumference.
  const residualLimit = Math.max(2.5, circle.r * 0.11);
  const inliers = boundary.filter((p) => Math.abs(Math.hypot(p.x - circle!.x, p.y - circle!.y) - circle!.r) <= residualLimit);
  const second = fitCircle(inliers);
  if (second) circle = second;

  const centerShift = Math.hypot(circle.x - coarse.centerX, circle.y - coarse.centerY);
  const radiusRatio = circle.r / aiR;
  const coverage = angularCoverage(inliers, circle);
  const residual = inliers.length
    ? inliers.reduce((sum, p) => sum + Math.abs(Math.hypot(p.x - circle!.x, p.y - circle!.y) - circle!.r), 0) / inliers.length
    : Infinity;
  const residualRatio = residual / Math.max(circle.r, 1);

  if (
    !Number.isFinite(circle.x) || !Number.isFinite(circle.y) || !Number.isFinite(circle.r) ||
    // 실측 반지름이 AI 값보다 큰 쪽(과소 추정 보정)은 더 넓게 허용한다.
    radiusRatio < 0.55 || radiusRatio > 1.45 ||
    centerShift > aiR * 0.65 || coverage < 0.5 || residualRatio > 0.12
  ) return edgeFallback();
  // NOTE: coverage 하한(0.5)을 낮추면 안 된다. 노란 외곽이 절반 미만만 보이는 프레임에서
  // 대수적 원 피팅은 짧은 호 + 절단면 직선에 끌려 반지름을 7~32% 과소 추정하고
  // (실측: 46px 볼이 32~42px 로 피팅), 그 결과 mmPerPixel 이 과대 → 전장이 과대 측정된다.
  // 커버리지가 0.5 미만인 프레임은 아래 edgeFallback(방사 에지 탐색)이 훨씬 정확하다.

  const confidence = clamp(
    coverage * 0.5 + (1 - residualRatio / 0.12) * 0.3 + (1 - centerShift / (aiR * 0.65)) * 0.2,
    0,
    1,
  );
  return {
    centerX: circle.x,
    centerY: circle.y,
    radiusPx: circle.r,
    refined: true,
    confidence,
    angularCoverage: coverage,
  };
}

/**
 * 외곽선이 AI 축과 얼마나 어긋나도 되는지의 허용 범위.
 *
 * AI 는 꼬리를 꼬리자루(fork)에, 머리를 눈 근처에 두는 실수를 자주 하므로 실제 외곽선이
 * AI 축보다 최대 45% 길게 나올 수 있다. 반대로 외곽선이 AI 축보다 지나치게 짧거나 길면
 * 물고기가 아닌 다른 피사체를 잡은 것이므로 보정에 쓰지 않는다.
 */
const AXIS_SPAN_MIN = 0.70;
const AXIS_SPAN_MAX = 1.45;

/**
 * 색상 기반 외곽선이 실제로 "AI 가 지목한 그 물고기"인지 검증한다.
 *
 * FishContourDetector 는 테두리 대비 중앙 색 우도비로 전경을 고르기 때문에, 복잡한 배경에서는
 * 사람 다리·바닥 무늬 같은 엉뚱한 영역을 물고기로 잡을 수 있다. 그런 외곽선을 그대로 그리면
 * 둘레선이 물고기가 아닌 곳에 표시되고, 끝점 보정까지 망가진다.
 * 아래 조건을 모두 통과할 때만 신뢰한다.
 *   1. 머리→꼬리 축 방향 길이(span)가 AI 축 길이와 비슷할 것
 *   2. 외곽선의 축 방향 양 극단이 AI 의 머리/꼬리 근처에 있을 것
 *   3. 축에 수직인 퍼짐(폭)이 축 길이를 크게 넘지 않을 것
 *   4. 머리-꼬리 중점이 외곽선 내부에 있을 것
 */
export function isContourAlignedWithAxis(
  contour: NormPoint[],
  frameWidth: number,
  frameHeight: number,
  head: NormPoint,
  tail: NormPoint,
): boolean {
  if (contour.length < 12 || !(frameWidth > 0) || !(frameHeight > 0)) return false;
  const toPx = (p: NormPoint) => ({ x: p.x * frameWidth, y: p.y * frameHeight });
  const pts = contour.map(toPx);
  const h = toPx(head);
  const t = toPx(tail);
  const ax = t.x - h.x;
  const ay = t.y - h.y;
  const axisLen = Math.hypot(ax, ay);
  if (axisLen < 30) return false;
  const ux = ax / axisLen;
  const uy = ay / axisLen;

  let minT = Infinity, maxT = -Infinity, maxAbsCross = 0;
  for (const p of pts) {
    const dx = p.x - h.x;
    const dy = p.y - h.y;
    const along = dx * ux + dy * uy;
    const across = Math.abs(dx * -uy + dy * ux);
    if (along < minT) minT = along;
    if (along > maxT) maxT = along;
    if (across > maxAbsCross) maxAbsCross = across;
  }
  const span = maxT - minT;
  if (span < axisLen * AXIS_SPAN_MIN || span > axisLen * AXIS_SPAN_MAX) return false;
  // 축 방향 양 극단이 AI 머리/꼬리에서 크게 벗어나면 다른 피사체다.
  const endTolerance = axisLen * 0.3;
  if (Math.abs(minT) > endTolerance || Math.abs(maxT - axisLen) > endTolerance) return false;
  // 물고기는 전장보다 폭이 훨씬 좁다(체고는 보통 전장의 25~40%). 지느러미를 넉넉히 감안해도
  // 반폭이 축 길이의 45%를 넘으면 원형 물체(양동이·접시·둥근 배경)를 잡은 것이다.
  if (maxAbsCross > axisLen * 0.45) return false;
  return pointInPolygon({ x: (h.x + t.x) / 2, y: (h.y + t.y) / 2 }, pts);
}

/** 짝수-홀수 규칙 점-다각형 내부 판정 */
function pointInPolygon(p: PixelPoint, poly: PixelPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) &&
        p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y || 1e-9) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

export type FishLandmarkInput = {
  head: NormPoint;
  tail: NormPoint;
  width: { top: NormPoint; bottom: NormPoint } | null;
};

export type FishLandmarkRefinement = FishLandmarkInput & {
  refinedHead: boolean;
  refinedTail: boolean;
  refinedWidth: boolean;
};

/**
 * Conservatively snaps coarse vision landmarks to a validated fish contour.
 * If the contour disagrees with the AI axis or a candidate moves too far, that
 * coordinate is left unchanged instead of risking a worse automatic result.
 */
export function refineFishLandmarks(
  contour: NormPoint[],
  frameWidth: number,
  frameHeight: number,
  input: FishLandmarkInput,
): FishLandmarkRefinement {
  const unchanged: FishLandmarkRefinement = {
    ...input,
    refinedHead: false,
    refinedTail: false,
    refinedWidth: false,
  };
  if (contour.length < 12 || !(frameWidth > 0) || !(frameHeight > 0)) return unchanged;
  const toPx = (p: NormPoint) => ({ x: p.x * frameWidth, y: p.y * frameHeight });
  const toNorm = (p: PixelPoint): NormPoint => ({ x: clamp(p.x / frameWidth, 0, 1), y: clamp(p.y / frameHeight, 0, 1) });
  const pts = contour.map(toPx);
  const head = toPx(input.head);
  const tail = toPx(input.tail);
  const ax = tail.x - head.x;
  const ay = tail.y - head.y;
  const axisLen = Math.hypot(ax, ay);
  if (axisLen < 30) return unchanged;
  const ux = ax / axisLen;
  const uy = ay / axisLen;
  const projection = (p: PixelPoint) => (p.x - head.x) * ux + (p.y - head.y) * uy;
  const projected = pts.map((p) => ({ p, t: projection(p) })).sort((a, b) => a.t - b.t);
  const minT = projected[0].t;
  const maxT = projected[projected.length - 1].t;
  const span = maxT - minT;
  if (span < axisLen * AXIS_SPAN_MIN || span > axisLen * AXIS_SPAN_MAX) return unchanged;

  const chooseEnd = (target: PixelPoint, fromHead: boolean) => {
    // 입/꼬리는 축 방향 극단의 좁은 5% 구간에서만 고른다. 기존처럼 넓은
    // 구간에서 단순 최근접점을 고르면 입 안쪽이나 꼬리자루에 선이 멈출 수 있다.
    const limit = fromHead ? minT + span * 0.05 : maxT - span * 0.05;
    const candidates = projected.filter((q) => fromHead ? q.t <= limit : q.t >= limit);
    let best: PixelPoint | null = null;
    let bestScore = Infinity;
    for (const q of candidates) {
      const dist = Math.hypot(q.p.x - target.x, q.p.y - target.y);
      const extremePenalty = fromHead ? q.t - minT : maxT - q.t;
      const transverse = Math.abs((q.p.x - target.x) * -uy + (q.p.y - target.y) * ux);
      const score = transverse + extremePenalty * 1.5 + dist * 0.08;
      if (score < bestScore) { bestScore = score; best = q.p; }
    }
    // AI 가 꼬리를 꼬리자루에, 머리를 눈 근처에 두는 실수를 자주 하므로 이동 허용치를
    // 축 길이의 22% 까지 넓힌다. (이보다 멀면 다른 지형지물로 튄 것으로 보고 원본 유지)
    if (!best || Math.hypot(best.x - target.x, best.y - target.y) > Math.max(24, axisLen * 0.22)) return null;
    return best;
  };

  const snappedHead = chooseEnd(head, true);
  const snappedTail = chooseEnd(tail, false);
  let nextWidth = input.width;
  let refinedWidth = false;

  // 축에 수직인 방향벡터 (단면선 교차점 정렬 기준)
  const nx = -uy, ny = ux;
  const cross = (p: PixelPoint) => (p.x - head.x) * nx + (p.y - head.y) * ny;

  // 순서 있는 외곽선과 축에 정확히 수직인 단면선의 교차점을 구한다.
  // 두 끝점의 축 투영값이 같으므로 결과 폭선이 입↔꼬리 선에 수직으로 유지된다.
  const intersectionsAt = (station: number) => {
    const intersections: PixelPoint[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const ta = projection(a), tb = projection(b);
      if ((ta - station) * (tb - station) > 0 || Math.abs(tb - ta) < 1e-6) continue;
      const ratio = (station - ta) / (tb - ta);
      if (ratio < -1e-6 || ratio > 1 + 1e-6) continue;
      const p = { x: a.x + (b.x - a.x) * ratio, y: a.y + (b.y - a.y) * ratio };
      if (!intersections.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 1.5)) intersections.push(p);
    }
    return intersections.sort((a, b) => cross(a) - cross(b));
  };

  // 컨투어 전체를 스캔해 최대 폭 단면을 찾는다.
  // AI 원본 폭 좌표(bodyTop/Bottom)에 의존하면 AI가 과소평가할 때 보정이 실패하므로,
  // 물고기 몸통 영역(전장의 15%~85%)을 22단계로 나눠 각 단면의 폭을 비교한다.
  {
    const STEPS = 22;
    let best: { top: PixelPoint; bottom: PixelPoint; widthPx: number } | null = null;
    for (let i = 0; i <= STEPS; i++) {
      const station = minT + span * (0.15 + (i / STEPS) * 0.70);
      const ints = intersectionsAt(station);
      if (ints.length < 2) continue;
      const a = ints[0], b = ints[ints.length - 1];
      const w = Math.hypot(a.x - b.x, a.y - b.y);
      if (!best || w > best.widthPx) best = { top: a, bottom: b, widthPx: w };
    }
    // 최소 전장의 8% 이상이어야 유효한 폭으로 인정 (윤곽 오인식 방지)
    if (best && best.widthPx > axisLen * 0.08) {
      nextWidth = { top: toNorm(best.top), bottom: toNorm(best.bottom) };
      refinedWidth = true;
    }
  }

  return {
    head: snappedHead ? toNorm(snappedHead) : input.head,
    tail: snappedTail ? toNorm(snappedTail) : input.tail,
    width: nextWidth,
    refinedHead: !!snappedHead,
    refinedTail: !!snappedTail,
    refinedWidth,
  };
}
