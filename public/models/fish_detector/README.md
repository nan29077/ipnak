# 물고기 감지 모델 배치 위치

이 폴더에 TensorFlow.js GraphModel 형식의 물고기 키포인트 감지 모델을 배치하면
`/measure` 페이지의 AI 자동 감지가 활성화됩니다. 모델이 없으면 자동으로
수동 탭 측정(목 모드)으로 동작합니다.

## 필요한 파일

```
public/models/fish_detector/
├── model.json          # TF.js GraphModel 매니페스트
├── group1-shard1of4.bin
├── group1-shard2of4.bin
└── ...                 # 샤드 바이너리 (model.json 이 참조)
```

## 모델 준비 절차 (YOLOv8n-pose 기준)

1. 데이터셋: 물고기 사진에 바운딩박스 + 키포인트 2개(머리 끝, 꼬리 끝) 라벨링
   - 클래스 순서(고정): 농어, 광어, 배스, 우럭, 감성돔, 참돔, 붕어, 잉어, 방어, 고등어, 갈치, 삼치
2. 학습: `yolo pose train model=yolov8n-pose.pt data=fish.yaml imgsz=640`
3. 내보내기: `yolo export model=best.pt format=tfjs`
4. 산출물(`best_web_model/` 내용)을 이 폴더에 복사

## 출력 포맷 연동

`src/utils/FishDetector.js` 의 `_parseOutput()` 이 현재
`[x, y, w, h, conf, cls, kp1x, kp1y, kp2x, kp2y]` (정규화 좌표) 형식을 가정합니다.
실제 내보낸 모델의 출력 텐서 형태에 맞게 `_parseOutput()` 만 수정하면 됩니다.

- 입력 크기: 640x640 (FishDetector.INPUT_SIZE)
- 신뢰도 임계값: 0.6 (FishDetector.CONFIDENCE_THRESHOLD)
