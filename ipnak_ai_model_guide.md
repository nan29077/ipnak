# 입낚 AI 물고기 감지 모델 제작 전체 가이드

---

## 1단계: Roboflow 프로젝트 생성
1. roboflow.com 접속 → 로그인
2. **Create New Project** 클릭
3. Project Type: **Object Detection** 선택
4. Project Name: `ipnak-fish` 입력 → Create

---

## 2단계: 이미지 업로드
1. 프로젝트 → **Upload Data** 탭
2. 물고기 사진 드래그 앤 드롭 (jpg/png, 최소 50장 이상 권장)
3. **Save and Continue** 클릭

---

## 3단계: 자동 라벨링 (Auto Label)
1. 왼쪽 메뉴 **Annotate** 탭
2. 이미지 선택 → **Auto Label** 클릭
3. 모델: **SAM 3 (Polygons)** 선택
4. Class 이름: `fish` 입력 → Add
5. **Auto Label With This Model** 클릭
6. 완료 후 각 이미지 검토 → 잘못된 라벨 수동 수정

---

## 4단계: 라벨 검토 & 승인
1. **Review** 탭 이동
2. 이미지 하나씩 확인 후 ✅ Approve
3. 또는 **Approve All** 클릭 → 새로고침해서 Approved 수 확인

---

## 5단계: 데이터셋 버전 생성
1. **Dataset** 탭 → **Generate New Version** 클릭
2. Train/Valid/Test 비율 설정: **70% / 20% / 10%**
   - Rebalance 버튼 클릭 → 슬라이더 조정 → Save
3. Preprocessing: 기본값 유지
4. Augmentation: Flip, Rotation, Brightness 추가 (3배 증강 권장)
5. **Create** 클릭 → 버전 생성 완료

---

## 6단계: YOLOv8 형식으로 Export
1. **Versions** 탭 → 생성된 버전 클릭
2. **Export Dataset** 클릭
3. Format: **YOLOv8** 선택
4. **Download zip to computer** 선택 → 다운로드

---

## 7단계: 입낚 서버에 zip 업로드
1. 입낚 관리자 페이지 접속 (`/admin`)
2. **AI 학습관리 → 데이터 수집** 탭
3. **Roboflow ZIP 업로드** 섹션에서 zip 파일 선택
4. 업로드 → 이미지/라벨 저장 확인

---

## 8단계: Google Drive에 zip 업로드
1. drive.google.com 접속
2. 내 드라이브 루트에 zip 파일 업로드
3. 파일명 확인: `ipnak_dataset.zip` (확장자 `.zip` 하나만)

---

## 9단계: Google Colab 학습
1. colab.google.com 접속
2. **Upload notebook** → `ipnak_fish_yolov8_train.ipynb` 업로드
3. 런타임 유형: **T4 GPU** 확인
4. **▶ Run all** 클릭
5. Google Drive 연결 팝업 → **Connect to Google Drive** 클릭
6. 30~60분 대기 (탭 닫지 말 것)
7. 완료 시 `best.onnx` 자동 다운로드

---

## 10단계: 모델 배포
1. 입낚 관리자 → **AI 학습관리 → 모델 관리** 탭
2. `best.onnx` 파일 선택 → 업로드
3. **즉시 적용** 클릭
4. 입낚 카메라에서 AI 물고기 감지 동작 확인

---

## 핵심 팁
- 이미지가 많을수록 정확도 향상 (200장 이상 추천)
- 라벨링 검토 꼼꼼히 할수록 모델 품질 올라감
- 모델 성능 부족하면 이미지 추가 → 2~10단계 반복
