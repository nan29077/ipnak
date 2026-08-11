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
      for (let radius = aiR * 0.7; radius <= aiR * 1.3 + 0.01; radius += radiusStep) {
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
    if (pixels.length < Math.max(20, Math.PI * aiR * aiR * 0.09)) continue;
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const aspect = Math.min(bw, bh) / Math.max(bw, bh);
    const cx = x0 + sumX / pixels.length;
    const cy = y0 + sumY / pixels.length;
    const dist = Math.hypot(cx - coarse.centerX, cy - coarse.centerY);
    const size = (bw + bh) / 4;
    const sizeFit = Math.max(0, 1 - Math.abs(size - aiR) / Math.max(aiR, 1));
    const proximity = Math.max(0, 1 - dist / Math.max(aiR * 1.25, 1));
    const score = aspect * 2.2 + sizeFit * 1.4 + proximity * 1.8 + Math.min(1, pixels.length / (Math.PI * aiR * aiR));
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
    radiusRatio < 0.55 || radiusRatio > 1.35 ||
    centerShift > aiR * 0.65 || coverage < 0.5 || residualRatio > 0.12
  ) return edgeFallback();

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
  if (span < axisLen * 0.72 || span > axisLen * 1.32) return unchanged;

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
    if (!best || Math.hypot(best.x - target.x, best.y - target.y) > Math.max(18, axisLen * 0.16)) return null;
    return best;
  };

  const snappedHead = chooseEnd(head, true);
  const snappedTail = chooseEnd(tail, false);
  let nextWidth = input.width;
  let refinedWidth = false;
  if (input.width) {
    const top = toPx(input.width.top);
    const bottom = toPx(input.width.bottom);
    const mid = { x: (top.x + bottom.x) / 2, y: (top.y + bottom.y) / 2 };
    const widthLen = Math.hypot(bottom.x - top.x, bottom.y - top.y);
    const requestedStation = clamp(projection(mid), minT + span * 0.15, maxT - span * 0.15);
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

    const stationStep = span * 0.012;
    const stations = [requestedStation, requestedStation - stationStep, requestedStation + stationStep];
    let bestPair: { top: PixelPoint; bottom: PixelPoint; score: number } | null = null;
    for (const station of stations) {
      const intersections = intersectionsAt(station);
      if (intersections.length < 2) continue;
      const a = intersections[0], b = intersections[intersections.length - 1];
      const direct = Math.hypot(a.x - top.x, a.y - top.y) + Math.hypot(b.x - bottom.x, b.y - bottom.y);
      const swapped = Math.hypot(b.x - top.x, b.y - top.y) + Math.hypot(a.x - bottom.x, a.y - bottom.y);
      const st = direct <= swapped ? a : b;
      const sb = direct <= swapped ? b : a;
      const snappedWidth = Math.hypot(sb.x - st.x, sb.y - st.y);
      const moveTop = Math.hypot(st.x - top.x, st.y - top.y);
      const moveBottom = Math.hypot(sb.x - bottom.x, sb.y - bottom.y);
      const moveLimit = Math.max(18, axisLen * 0.18);
      if (
        snappedWidth < widthLen * 0.6 || snappedWidth > widthLen * 1.5 ||
        moveTop > moveLimit || moveBottom > moveLimit
      ) continue;
      const score = moveTop + moveBottom + Math.abs(station - requestedStation) * 0.4;
      if (!bestPair || score < bestPair.score) bestPair = { top: st, bottom: sb, score };
    }
    if (bestPair) {
      nextWidth = { top: toNorm(bestPair.top), bottom: toNorm(bestPair.bottom) };
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
