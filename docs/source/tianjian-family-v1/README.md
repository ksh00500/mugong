# 천검산 원화·내보내기 기록

2026-10-05. 기본 제공 `image_gen.imagegen`으로 기본 원화 35묶음과 수정안 15묶음을 생성했다. 원본 50 PNG·프롬프트·생성 도구 출력 경로를 보관한다. 실제 선택 원본은 43개이며 420개 논리 자세를 전달한다. 버린 수정안도 출처 확인을 위해 남겨 둔다.

| 슬롯 | 인물 | 기본 동작 |
| --- | --- | --- |
| 0 | 검객 | 한 손 검 전방 찌르기·반대 팔 균형 |
| 1 | 창 수문장 | 한 자루 창·떨어진 양손·허리에서 전방 찌르기 |
| 2 | 검기술사 | 한 자루 검·뒤 어깨 준비·사선 내려 베기·검결과 검기 발사 |
| 3 | 낙검객 우진 | 한 자루 검·가드·회전·사선 내려 베기 |
| 4 | 쌍검 백홍 | 각 손 한 자루·교차 타격·양쪽 후속 베기 |
| 5 | 검귀 무명 | 한 자루 검·낮은 자세의 빠른 베기 |
| 6 | 천검노인 백운 | 한 자루 검·반대 손 검결·지지발·내려 베기 |

각 인물은 정면·앞 대각선·측면·뒤 대각선·후면의 다섯 시점, 시점마다 대기·보행 3·작은 피격·사망·공격 6의 12자세다. 좌우 반전으로 팔방을 표시한다. 보스 19개 기술은 인물별 기본 주기와 기존 효과를 조합하며 기술마다 별도 원화를 제작한 것은 아니다.

## 선택한 수정안

원본 390자세를 유지하고 30자세를 아래 수정 원화로 교체했다. 자세 번호는 0부터 시작한다.

| 시점 | 선택 원본 | 자세 |
| --- | --- | --- |
| 검기술사 앞 대각선 | `swordcaster-front-right-spacing-v2.png` | 9, 10 |
| 검객 측면 | `duelist-right-attack-v3.png` | 6–10 |
| 검객 뒤 대각선 | `duelist-rear-right-attack-v4.png` | 6–10 |
| 창 수문장 측면 | `spearguard-right-attack-v4.png` | 6–10 |
| 창 수문장 뒤 대각선 | `spearguard-rear-right-attack-v3.png` | 6–10 |
| 창 수문장 후면 | `spearguard-back-attack-v3.png` | 6–10 |
| 검기술사 뒤 대각선 | `swordcaster-rear-right-spacing-v5.png` | 9, 10 |
| 백운 측면 | `baekun-right-death-v2.png` | 5 |

길게 뻗는 검·창이 이웃 인물과 연결되거나 시트 가장자리에서 잘리는 문제를 수정했다. 무기 여유를 확보하면서 몸 비율이 지나치게 달라진 시도는 선택하지 않았다. 선택 원본과 격자는 [generation-jobs.json](generation-jobs.json), 도구 원본 출력 경로와 프롬프트 연결은 [provenance.json](provenance.json)에 있다.

## 크기·여백·접지점

원본을 리사이즈하지 않는다. 연결된 인물과 1픽셀 외곽을 RGBA 1:1로 복사해 인물별 공통 칸에 배치한다. 모든 방향·자세의 게임 배율은 0.225, 투명 여백은 최소 32픽셀이다. 무기를 펼치는 자세 때문에 몸을 축소하지 않는다. 자연스러운 웅크림과 보행에 따른 실제 자세 높이 변화는 유지한다.

`ground-anchors.json`은 저장된 발 기준점이다. 런타임 자동 탐지·정규화는 하지 않는다. 제작 단계 제안을 원화와 실제 합성 화면으로 검토했으며 창끝을 발로 오인하지 않도록 분리했다. 백운의 회색 발바닥과 창 수문장 정면 접촉 중심에 대한 수동 교정 5개는 [ground-anchor-overrides.json](ground-anchor-overrides.json)에 남겼다. 이는 몸 배율 변경이 아니다.

HP바는 살아 있는 모든 자세의 최대 높이에 여유를 더한 인물별 고정 위치다. 보스 피격이 공격 주기를 가리지 않는다.

## 검사·재현

- `source-review.json`: 420자세의 원본 경계·연결 성분·출처. 잘림·공유 그림·잘린 대체 성분 없음.
- `export-review.json`: 원본 연결 픽셀 RGBA 보존·프레임·여백.
- `encoded-atlas-review.json`: 실제 WebP 재디코딩으로 35시트·420프레임의 저장 경계 밖에 보이는 픽셀이 없는지 확인. 투명 패딩 유지.
- `ground-proposals.json`: 제작 단계 제안과 수동 교정 사유.
- [브라우저 검증](../../verification/tianjian-family-v1/README.md): 자동 검사와 실제 캡처 검토를 구분한다.

프로젝트 루트에서 아래 명령을 실행한다. Sharp는 설정된 `MUGONG_SHARP_PATH`를 사용한다.

```powershell
node scripts/select-tianjian-repairs.mjs
node --experimental-strip-types scripts/analyze-shaolin-family.mjs tianjian
node --experimental-strip-types scripts/propose-tianjian-ground.mjs
node --experimental-strip-types scripts/export-shaolin-family.mjs tianjian
node scripts/verify-native-atlas.mjs tianjian
node scripts/family-review.mjs tianjian
```

관절과 머리 크기를 수학적으로 인증한 기록은 아니다. 생성 그림의 미세한 비율·시점 차이는 남을 수 있다. 사망은 단일 자세 페이드, 공격은 여섯 원화 자세를 재생한다.
