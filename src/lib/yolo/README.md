# YOLO 온디바이스 추론 (`src/lib/yolo`)

입낚 AI 카메라에서 **물고기 · 입낚볼 · 입낚키링**을 브라우저에서 직접 감지하기 위한 모듈입니다.
추론은 `onnxruntime-web`(WASM)으로 클라이언트에서 수행하며, 서버 비용이 들지 않습니다.

> **모델 파일이 없으면 이 모듈은 아무 것도 하지 않습니다.**
> AI 카메라는 기존(서버 AI + 색상 기반) 방식으로 이전과 완전히 동일하게 동작합니다.

---

## 1. 파일 구성

| 파일 | 역할 |
|---|---|
| `types.ts` | `Detection` / `YoloResult` / `ModelConfig` 등 공용 타입, 클래스 상수 (서버에서도 import 가능) |
| `modelLoader.ts` | ONNX 세션 지연 로딩 + 싱글턴 캐싱, 모델 존재 확인, 캐시 초기화 |
| `preprocess.ts` | 캔버스 프레임 → 640×640 레터박스 → `Float32Array`(NCHW, 0~1) |
| `postprocess.ts` | 출력 텐서 파싱 · 좌표 복원 · 클래스별 NMS |
| `inference.ts` | 전체 파이프라인 통합 (`runYoloInference`) + 크기 환산 유틸 |

---

## 2. 모델 파일 위치

```
public/models/best.onnx        ← 학습 완료 후 여기에 저장
```

서빙 경로는 **`/api/models/best.onnx`** 입니다.
(실서버 standalone 빌드에서는 런타임에 추가된 `public/` 파일이 정적 서빙되지 않기 때문에,
`public/uploads` 와 동일하게 API 라우트로 서빙합니다.)

모델은 관리자 화면에서도 업로드할 수 있습니다:
**관리자 → AI 학습 관리 → 모델 관리 → 새 모델 업로드**

---

## 3. 클래스 정의 (순서 고정)

| class id | 이름 | 설명 |
|---|---|---|
| 0 | `fish` | 물고기 |
| 1 | `ipnak-ball` | 입낚볼 (지름 40mm 구) |
| 2 | `ipnak-keyring` | 입낚키링 (지름 40mm 원판) |

⚠️ **이 순서는 학습 데이터의 `data.yaml` 과 반드시 일치해야 합니다.**
순서를 바꾸면 감지 결과의 클래스가 뒤섞입니다.

---

## 4. 사용법

```ts
import { runYoloInference, estimateSize, topByClass, topReference } from "@/lib/yolo/inference";

const result = await runYoloInference(frameCanvas);
if (!result) {
  // 모델 없음 / 로드 실패 / 이미 추론 중 → 기존 방식으로 폴백
  return;
}

for (const d of result.detections) {
  console.log(d.className, d.score, d.boxN); // boxN 은 0~1 정규화 좌표
}

// 기준물(40mm) 대비 물고기 크기 자동 환산
const size = estimateSize(result.detections);
if (size) console.log(`${size.lengthCm}cm (기준: ${size.referenceClass})`);
```

모델 존재 여부만 먼저 확인하고 싶을 때:

```ts
import { isYoloModelAvailable } from "@/lib/yolo/modelLoader";

if (await isYoloModelAvailable()) { /* YOLO UI 노출 */ }
```

새 모델을 업로드한 직후 캐시를 비우려면:

```ts
import { resetYoloModel } from "@/lib/yolo/modelLoader";
resetYoloModel();
```

---

## 5. onnxruntime-web 런타임 위치

`onnxruntime-web` 은 **번들에 포함하지 않고** 브라우저가 런타임에 직접 불러옵니다.
(배포본에 ESM 워커가 들어 있어 webpack + Terser 가 처리하지 못합니다 —
`/* webpackIgnore: true */` 동적 import 로 우회합니다.)

로드 경로는 다음 순서로 자동 선택됩니다.

1. `NEXT_PUBLIC_ORT_BASE` 환경변수 (지정한 경우)
2. 자체 호스팅 `/ort/`
3. jsDelivr CDN — 웹에서는 아무 설정 없이 바로 동작합니다

Capacitor 앱처럼 **오프라인에서도 동작해야 하는 빌드**는 자체 호스팅하세요.

```bash
npm run yolo:wasm          # node_modules → public/ort 로 3개 파일 복사 (약 13MB)
```

복사만 해두면 `/ort/` 가 자동으로 우선 사용됩니다 (환경변수 불필요).
`public/ort/` 는 용량 때문에 `.gitignore` 에 있으므로, **배포 파이프라인에 이 명령을 넣어 두세요.**

---

## 6. 튜닝 파라미터

`DEFAULT_MODEL_CONFIG` (`modelLoader.ts`)에서 조정합니다.

| 항목 | 기본값 | 설명 |
|---|---|---|
| `inputSize` | `640` | 모델 입력 해상도. 학습 시 `imgsz` 와 동일해야 함 |
| `scoreThreshold` | `0.5` | 이 점수 미만 박스는 버림 |
| `iouThreshold` | `0.45` | NMS 중복 억제 기준 |
| `maxDetections` | `20` | 프레임당 최대 박스 수 |

---

## 7. 주의사항

- `modelLoader.ts` / `inference.ts` 는 **클라이언트 전용**(`"use client"`)입니다.
  서버 컴포넌트에서는 `types.ts` 만 import 하세요.
- `onnxruntime-web` 은 **동적 import** 로만 불러옵니다 (초기 번들 크기 보호).
- 추론은 직렬 실행됩니다 — 이전 프레임 추론 중 호출하면 `null` 을 반환합니다.
