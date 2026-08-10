# Roboflow 연동 가이드 (입낚 AI 라벨링)

> 작성일: 2026-08-09  
> 대상: 입낚 관리자 페이지 → AI 학습관리 → 라벨링 탭 → **Roboflow 연동** 서브탭

---

## 현황 요약

백엔드 API와 프론트엔드 UI가 **이미 구현 완료**된 상태입니다.  
내일 할 작업은 **Roboflow 계정 세팅 + 연동 설정 입력 + 실제 라벨링 진행**입니다.

---

## 1단계 — Roboflow 계정 & 프로젝트 준비

### 1-1. 계정 생성
- https://app.roboflow.com 접속 → 무료 계정 생성 (또는 기존 계정 로그인)

### 1-2. 워크스페이스 확인
- 로그인 후 좌상단 워크스페이스 이름 확인 (예: `ipnak-team`)
- 이 값을 나중에 **워크스페이스** 입력란에 사용 (선택사항, 없어도 동작)

### 1-3. 새 프로젝트 생성
1. **New Project** 클릭
2. 설정:
   - **Project Name**: `ipnak-fish-detect` (원하는 이름)
   - **Project Type**: `Object Detection` ← 반드시 이것 선택
   - **Annotation Group**: `fish` (어종 분류용) 또는 `ball` (입낚볼 감지용)
3. 생성 완료 후 URL에서 프로젝트 ID 확인
   - URL 예시: `https://app.roboflow.com/ipnak-team/ipnak-fish-detect`
   - 프로젝트 ID = `ipnak-fish-detect`

### 1-4. API Key 발급
1. 우상단 프로필 아이콘 → **Roboflow Settings**
2. **API Keys** 탭 → **Private API Key** 복사
   - 절대 외부에 노출하지 말 것 (서버에만 저장됨, 화면엔 마스킹 표시)

---

## 2단계 — 입낚 관리자 페이지 연동 설정

**경로**: 관리자 로그인 → AI 학습관리 → 라벨링 → **Roboflow 연동** 탭

| 입력 항목 | 예시 | 설명 |
|-----------|------|------|
| API Key | `rf_abcdef...` | 1-4에서 복사한 Private Key |
| 워크스페이스 | `ipnak-team` | 선택사항, 비워도 됨 |
| 프로젝트 ID | `ipnak-fish-detect` | 반드시 입력 |

입력 후 **설정 저장** 클릭 → `저장됨 rf_ab****` 표시 확인

---

## 3단계 — 이미지 Roboflow로 전송

1. **"아직 라벨이 없는 이미지만 전송"** 체크박스 선택 권장
2. **Roboflow로 전송** 버튼 클릭
3. 한 번에 최대 50장 전송 → 남은 장수 있으면 버튼 다시 눌러서 이어서 전송
4. 완료 메시지 확인: `업로드 50장 · 실패 0장`

---

## 4단계 — Roboflow에서 라벨링 작업

### 4-1. Roboflow 접속
- https://app.roboflow.com → 해당 프로젝트 진입
- **Annotate** 탭 클릭 → 업로드된 이미지 목록 확인

### 4-2. 라벨링 방법
1. 이미지 클릭 → 어노테이션 캔버스 진입
2. **Bounding Box 도구** (단축키 `B`) 선택
3. 감지 대상 영역 드래그하여 박스 그리기
4. 클래스 선택:
   - 어종 감지: `fish`, `bass`, `carp` 등 (프로젝트 클래스에 추가)
   - 입낚볼 감지: `ball`, `keyring`
5. 저장 → 다음 이미지

### 4-3. 라벨링 팁
- **Smart Polygon** 기능으로 AI가 자동 윤곽 잡아줌 (Roboflow 무료 제공)
- **Label Assist** 기능으로 이전 라벨 패턴 자동 추천
- 단축키: `D` = 다음 이미지, `A` = 이전 이미지, `Esc` = 선택 해제

---

## 5단계 — 라벨 데이터 Export 및 학습 활용

### 방법 A — Roboflow 내부 학습 (선택사항)
- 프로젝트 → **Train** 탭 → Roboflow가 YOLOv8 자동 학습
- 결과 모델을 API로 바로 사용 가능

### 방법 B — 입낚 서버로 Export (권장)
1. **Dataset** 탭 → **Export Dataset**
2. 포맷: `YOLOv8` 선택
3. `Download zip to computer` 클릭
4. 다운받은 zip을 입낚 관리자 → **AI 학습관리 → 수집 탭**에 업로드 후 학습 진행

---

## API 구조 (참고용)

```
GET  /api/admin/ai-training/roboflow   → 현재 설정 조회
PUT  /api/admin/ai-training/roboflow   → 설정 저장 { apiKey, workspace, project }
POST /api/admin/ai-training/roboflow   → 이미지 전송 { onlyUnlabeled, offset }
```

**전송 응답 구조**:
```json
{
  "uploaded": 50,
  "failed": 0,
  "remaining": 120,
  "nextOffset": 50,
  "errors": []
}
```
- `remaining > 0` 이면 버튼 다시 눌러서 이어서 전송

---

## 주요 파일 위치

| 파일 | 역할 |
|------|------|
| `src/app/api/admin/ai-training/roboflow/route.ts` | Roboflow 연동 API (GET/PUT/POST) |
| `src/components/admin/AiTrainingLabelTab.tsx` | 라벨링 탭 UI (RoboflowPanel 컴포넌트 포함) |
| `src/lib/aiTraining.ts` | AI 학습 공통 유틸 (RAW_DIR, readJson, writeJson 등) |

---

## 체크리스트 (내일 진행 순서)

- [ ] Roboflow 계정 로그인
- [ ] Object Detection 프로젝트 생성
- [ ] Private API Key 발급
- [ ] 관리자 페이지에서 API Key + 프로젝트 ID 저장
- [ ] 이미지 전송 (미라벨 이미지 선택)
- [ ] Roboflow에서 라벨링 작업
- [ ] 완료 후 YOLOv8 포맷으로 Export
