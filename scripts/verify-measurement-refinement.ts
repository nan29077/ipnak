import assert from "node:assert/strict";
import {
  AI_REFERENCE_RADIUS_MARGIN,
  isContourAlignedWithAxis,
  refineFishLandmarks,
  refineReferenceCircle,
} from "../src/lib/measurementRefinement";
import {
  portraitToLandscapeTurn,
  rotateNormPoint,
  rotatePixelPoint,
  rotateWidthNormalizedRadius,
} from "../src/lib/cameraOrientation";
import { estimateWeightByWidth } from "../src/lib/weightEstimation";

function makePixels(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 44; data[i + 1] = 48; data[i + 2] = 52; data[i + 3] = 255;
  }
  const paint = (x: number, y: number, rgb: [number, number, number]) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2]; data[i + 3] = 255;
  };
  return { data, paint };
}

function referenceFixture() {
  const width = 480, height = 320;
  const { data, paint } = makePixels(width, height);
  const cx = 122, cy = 214, radius = 43;
  const yellow: [number, number, number] = [234, 179, 8];
  const white: [number, number, number] = [245, 245, 238];
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (Math.hypot(x - cx, y - cy) <= radius) paint(x, y, yellow);
    }
  }
  // White logo hole and a highlight: the yellow surface is intentionally not solid.
  for (let y = cy - 12; y <= cy + 12; y++) {
    for (let x = cx - 12; x <= cx + 12; x++) {
      if (Math.hypot(x - cx, y - cy) <= 11) paint(x, y, white);
    }
  }
  for (let y = cy - 31; y <= cy - 22; y++) {
    for (let x = cx - 10; x <= cx + 12; x++) paint(x, y, white);
  }
  // Thin connected yellow lanyard, which must not enlarge or pull the fitted circle.
  for (let x = cx + radius - 1; x <= cx + radius + 78; x++) {
    for (let y = cy - 2; y <= cy + 2; y++) paint(x, y, yellow);
  }
  return { width, height, data, truth: { cx, cy, radius } };
}

{
  const fixture = referenceFixture();
  const result = refineReferenceCircle(
    { data: fixture.data, width: fixture.width, height: fixture.height },
    { centerX: fixture.truth.cx - 9, centerY: fixture.truth.cy + 7, radiusPx: fixture.truth.radius * 1.12 },
  );
  assert.equal(result.refined, true, "reference circle should pass conservative validation");
  assert.ok(Math.abs(result.centerX - fixture.truth.cx) <= 2.5, `centerX error: ${result.centerX - fixture.truth.cx}`);
  assert.ok(Math.abs(result.centerY - fixture.truth.cy) <= 2.5, `centerY error: ${result.centerY - fixture.truth.cy}`);
  assert.ok(Math.abs(result.radiusPx - fixture.truth.radius) <= 2.5, `radius error: ${result.radiusPx - fixture.truth.radius}`);
  assert.ok(result.angularCoverage >= 0.72, `coverage too low: ${result.angularCoverage}`);
}

{
  const width = 320, height = 240;
  const { data } = makePixels(width, height);
  const coarse = { centerX: 100, centerY: 120, radiusPx: 31 };
  const result = refineReferenceCircle({ data, width, height }, coarse);
  assert.equal(result.refined, false, "blank frame must keep the AI fallback");
  assert.deepEqual(
    { x: result.centerX, y: result.centerY, r: result.radiusPx },
    { x: coarse.centerX, y: coarse.centerY, r: coarse.radiusPx },
  );
}

{
  const width = 520, height = 320;
  const cx = 260, cy = 158, rx = 164, ry = 57;
  const contour = Array.from({ length: 144 }, (_, i) => {
    const a = (i / 144) * Math.PI * 2;
    return { x: (cx + Math.cos(a) * rx) / width, y: (cy + Math.sin(a) * ry) / height };
  });
  const refined = refineFishLandmarks(contour, width, height, {
    head: { x: (cx - rx + 14) / width, y: (cy + 4) / height },
    tail: { x: (cx + rx - 17) / width, y: (cy - 3) / height },
    width: {
      top: { x: cx / width, y: (cy - ry + 9) / height },
      bottom: { x: cx / width, y: (cy + ry - 8) / height },
    },
  });
  assert.equal(refined.refinedHead, true);
  assert.equal(refined.refinedTail, true);
  assert.equal(refined.refinedWidth, true);
  assert.ok(Math.abs(refined.head.x * width - (cx - rx)) <= 4);
  assert.ok(Math.abs(refined.tail.x * width - (cx + rx)) <= 4);
  assert.ok(refined.width);
  assert.ok(Math.abs(refined.width!.top.y * height - (cy - ry)) <= 5);
  assert.ok(Math.abs(refined.width!.bottom.y * height - (cy + ry)) <= 5);
  const lengthAxis = {
    x: (refined.tail.x - refined.head.x) * width,
    y: (refined.tail.y - refined.head.y) * height,
  };
  const widthAxis = {
    x: (refined.width!.bottom.x - refined.width!.top.x) * width,
    y: (refined.width!.bottom.y - refined.width!.top.y) * height,
  };
  const cosine = Math.abs(lengthAxis.x * widthAxis.x + lengthAxis.y * widthAxis.y) /
    (Math.hypot(lengthAxis.x, lengthAxis.y) * Math.hypot(widthAxis.x, widthAxis.y));
  assert.ok(cosine < 0.02, `width line must be perpendicular to length axis: ${cosine}`);
}

{
  // 회전된 물고기에서도 폭선은 같은 축 위치에서 외곽과 교차해야 한다.
  const width = 620, height = 420;
  const cx = 310, cy = 205, rx = 188, ry = 62;
  const angle = 24 * Math.PI / 180;
  const ux = Math.cos(angle), uy = Math.sin(angle);
  const nx = -uy, ny = ux;
  const contour = Array.from({ length: 180 }, (_, i) => {
    const a = (i / 180) * Math.PI * 2;
    return {
      x: (cx + ux * rx * Math.cos(a) + nx * ry * Math.sin(a)) / width,
      y: (cy + uy * rx * Math.cos(a) + ny * ry * Math.sin(a)) / height,
    };
  });
  const point = (along: number, across: number) => ({
    x: (cx + ux * along + nx * across) / width,
    y: (cy + uy * along + ny * across) / height,
  });
  const refined = refineFishLandmarks(contour, width, height, {
    head: point(-rx + 15, 2),
    tail: point(rx - 18, -3),
    width: { top: point(8, -ry + 11), bottom: point(-5, ry - 9) },
  });
  assert.ok(refined.refinedHead && refined.refinedTail && refined.refinedWidth);
  assert.ok(refined.width);
  const lx = (refined.tail.x - refined.head.x) * width;
  const ly = (refined.tail.y - refined.head.y) * height;
  const wx = (refined.width!.bottom.x - refined.width!.top.x) * width;
  const wy = (refined.width!.bottom.y - refined.width!.top.y) * height;
  const cosine = Math.abs(lx * wx + ly * wy) / (Math.hypot(lx, ly) * Math.hypot(wx, wy));
  assert.ok(cosine < 0.025, `rotated width line perpendicularity error: ${cosine}`);
}

{
  // 화면에서 검출한 100px 지름을 실제 40mm로 두면 1055px 전장은 42.2cm다.
  const mmPerPixel = 40 / 100;
  const lengthCm = Math.round(((1055 * mmPerPixel) / 10) * 10) / 10;
  const widthCm = Math.round(((295 * mmPerPixel) / 10) * 10) / 10;
  assert.equal(lengthCm, 42.2);
  assert.equal(widthCm, 11.8);
  const weightG = estimateWeightByWidth(lengthCm, widthCm, "배스");
  assert.ok(weightG != null && weightG > 0, "length/width should produce an estimated weight");
}

{
  // Rear camera on the left + portrait-locked browser is the app's canonical grip.
  const turn = portraitToLandscapeTurn(true, false);
  assert.equal(turn, "ccw");
  const portraitW = 300, portraitH = 500;
  // Inverse fixture for an expected landscape point (x=420,y=80).
  const raw = { x: portraitW - 80, y: 420 };
  assert.deepEqual(rotatePixelPoint(raw, portraitW, portraitH, turn), { x: 420, y: 80 });
  assert.deepEqual(rotateNormPoint({ x: 0.25, y: 0.8 }, turn), { x: 0.8, y: 0.75 });
  const rawRadiusN = 42 / portraitW;
  const landscapeRadiusN = rotateWidthNormalizedRadius(rawRadiusN, portraitW, portraitH);
  assert.ok(Math.abs(landscapeRadiusN * portraitH - 42) < 1e-9, "rotation must preserve the marker radius in pixels");
}

{
  // 기준물 보정 계수 — 폴백 경로(실시간 스캐너 · measure 페이지)가 공유하는 값.
  assert.ok(
    AI_REFERENCE_RADIUS_MARGIN > 1 && AI_REFERENCE_RADIUS_MARGIN <= 1.25,
    `unexpected reference radius margin: ${AI_REFERENCE_RADIUS_MARGIN}`,
  );
  // 반지름을 키우면 mmPerPixel 이 작아져 계측값이 줄어드는 방향이어야 한다.
  const raw = 40 / (2 * 50);
  const corrected = 40 / (2 * 50 * AI_REFERENCE_RADIUS_MARGIN);
  assert.ok(corrected < raw, "radius margin must reduce mmPerPixel");
}

{
  // 외곽선 정합 검증 — 정상 물고기 외곽선은 통과해야 한다.
  const width = 520, height = 320;
  const cx = 260, cy = 158, rx = 164, ry = 46;
  const fish = Array.from({ length: 144 }, (_, i) => {
    const a = (i / 144) * Math.PI * 2;
    return { x: (cx + Math.cos(a) * rx) / width, y: (cy + Math.sin(a) * ry) / height };
  });
  const head = { x: (cx - rx + 10) / width, y: cy / height };
  const tail = { x: (cx + rx - 12) / width, y: cy / height };
  assert.equal(isContourAlignedWithAxis(fish, width, height, head, tail), true, "aligned fish contour must pass");

  // ① 화면 반대편의 엉뚱한 영역(사람 다리·바닥 무늬 등)은 걸러져야 한다.
  const elsewhere = fish.map((p) => ({ x: p.x, y: Math.min(1, p.y * 0.25 + 0.02) }));
  assert.equal(
    isContourAlignedWithAxis(elsewhere, width, height, head, tail), false,
    "contour far off the AI axis must be rejected",
  );

  // ② 물고기보다 훨씬 큰 영역(프레임 전체 배경)도 걸러져야 한다.
  const huge = Array.from({ length: 144 }, (_, i) => {
    const a = (i / 144) * Math.PI * 2;
    return { x: 0.5 + Math.cos(a) * 0.48, y: 0.5 + Math.sin(a) * 0.45 };
  });
  assert.equal(
    isContourAlignedWithAxis(huge, width, height, head, tail), false,
    "oversized blob must be rejected",
  );

  // ③ 축 방향으로만 길고 폭이 비정상적으로 넓은(원형) 영역도 걸러져야 한다.
  const round = Array.from({ length: 144 }, (_, i) => {
    const a = (i / 144) * Math.PI * 2;
    return { x: (cx + Math.cos(a) * rx) / width, y: (cy + Math.sin(a) * rx) / height };
  });
  assert.equal(
    isContourAlignedWithAxis(round, width, height, head, tail), false,
    "round blob must be rejected (not fish-shaped)",
  );
}

{
  // AI 가 꼬리를 꼬리자루에 찍어 축이 18% 짧게 잡힌 경우에도 실제 끝점으로 보정돼야 한다.
  const width = 640, height = 360;
  const cx = 320, cy = 180, rx = 210, ry = 52;
  const contour = Array.from({ length: 160 }, (_, i) => {
    const a = (i / 160) * Math.PI * 2;
    return { x: (cx + Math.cos(a) * rx) / width, y: (cy + Math.sin(a) * ry) / height };
  });
  const refined = refineFishLandmarks(contour, width, height, {
    head: { x: (cx - rx + 22) / width, y: cy / height },   // 눈 근처
    tail: { x: (cx + rx - 40) / width, y: cy / height },   // 꼬리자루
    width: null,
  });
  assert.equal(refined.refinedHead, true, "short AI axis must still snap the head");
  assert.equal(refined.refinedTail, true, "short AI axis must still snap the tail");
  assert.ok(Math.abs(refined.head.x * width - (cx - rx)) <= 5, `head error: ${refined.head.x * width - (cx - rx)}`);
  assert.ok(Math.abs(refined.tail.x * width - (cx + rx)) <= 5, `tail error: ${refined.tail.x * width - (cx + rx)}`);
}

console.log("measurement refinement verification: PASS");
