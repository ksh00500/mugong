# UI 최우선 수정 검증

2026-10-20. [구현](../../ui-priority-v1.md). 이전 감사/과거 UI 피드백 검사를 이번 실행 결과로 합산하지 않는다. 기준은 aa1fc18이며 현재 작업 브랜치는 `codex/ui-priority-v1`이다.

## 자동 검사

- 전체/소스 전용 각각 **77파일·1,377테스트 통과**. 소스 전용 모드는 manifest 경로 검사이며 실제 미디어 검증과 구분한다. 카메라가 살아 있음/이미 사라짐/manager가 사라짐의 반복 cleanup3검사를 추가했다.
- 타입 검사 통과. 런타임 에셋1,058개, 정적 참조792개, 누락0·LFS포인터0. Vite 최종 빌드 성공. 기존 큰 mount 청크 경고(약5.45MB)는 남아 있으며 이번 수정으로 로딩 성능 향상을 주장하지 않는다.
- `ui-priority.spec.ts` 소스8검사: 세 해상도의 모집/HP/성장, Canvas·WebGL 각2회 저장 종료/재개,5언어+큰HUD+고대비+동작 감소/긴 이름, 실제 모집 출전,5언어 모집 행동 노출.
- 기존 `details.spec.ts` 성장 Shift/설명/Esc/키보드3검사와 `ui-feedback.spec.ts` 실제 체력·흰 잔량·회복3해상도/카메라/실제WebGL5검사. 실제 값과 흰 잔량의 분리·감쇠·회복·동작 감소를 확인한다.
- 배포 빌드5227의3검사와 실제 적용5205의 별도3검사: 각 renderer에서2회 저장 종료/재개 후 같은 무인/웨이브 보존,1093 모집 출전→첫 성장 설명/선택. 컴파일 검사는 소스 모듈을 주입하지 않고 독립 IndexedDB 테스트 저장과 실제 UI를 사용한다.

주요 결과는 `layout-*.json`, `language-preferences.json`, `resume-*.json`, `feedback-regression/*.json`, `local5205/*.json`에 남긴다. 전체/소스 raw 결과 JSON과 PNG는 로컬 증거이며 저장소의 미디어 제외 규칙을 따른다. 모든 캡처가 수동 승인되었다는 뜻은 아니다.

## 직접 시각·조작 검토

1440 전투/모집/성장 설명,1093 전투/모집/성장 설명, 영어 큰HUD/긴이름과 성장 설명, 실제5205 첫 성장 설명 캡처를 직접 확인했다. HP 숫자 바탕 제거·막대와 분리, 프레임 여백, 모집 CTA 전체 노출, 설명과 카드/선택 버튼이 겹치지 않는 구성을 검토했다. 원래 화면에서 키보드 후보 선택·이름 입력·닫기 초점 복귀·성장 Enter 선택을 자동 조작했고, 모든 자연 플레이 상황이나 접근성 인증을 보장하는 결과와는 구분한다.

## 검사 준비 중 교정한 실패

- 새 모집으로 출전한 뒤 로비를 기대하는 seed를 같은 페이지에 호출한 초기 준비 오류를 고쳤다. 수련 포인트가 남으면 성장 화면이 다시 열리는 정상 규칙을 초기 검사에서 잘못 기대해, 실제 선택 레벨과 비용으로 검사하도록 교정했다.
- 기존 피드백 테스트의 가상 시계를 시작 전에 설치하면 다음 RAF를 기다리는 scene hook이 멈추고, 설치 후 Performance 기록이 바뀌면 Vite 모듈을 다른 URL로 다시 가져올 수 있었다. live scene/기존 store 모듈을 먼저 확보한 뒤 가상 시계를 설치한다. 50ms 뒤 시각을 pause 대상으로 쓰던 경합도 충분한 미래 시각으로 바꿨다. 이는 테스트 준비 수정이며 실제 게임 로딩/저장 버그로 집계하지 않는다.
- 테스트의 this/Map tuple 타입 오류도 교정 후 최종 타입 검사를 통과했다. 실패한 실행을 통과 수에 포함하지 않는다.
- 모집 키보드 검사는 저장 중 비활성 후보에 focus만 호출하지 않고, 활성/초점/선택 결과를 확인한 뒤 진행한다. 소스/컴파일 동시 실행의 추적 파일 폴더 충돌도 결과 디렉터리를 분리해 교정했다. 최종 결과는 교정 후 실행 기준이다.

## 재실행

독립 개발 서버5225를 실행한 뒤 PowerShell에서:

```powershell
$env:MUGONG_E2E_PORT='5225'
node node_modules/@playwright/test/cli.js test tests/e2e/ui-priority.spec.ts
$env:MUGONG_FEEDBACK_PROOF='docs/verification/ui-priority-v1/feedback-regression'
$env:MUGONG_DETAILS_PROOF='docs/verification/ui-priority-v1/details-regression'
node node_modules/@playwright/test/cli.js test tests/e2e/ui-feedback.spec.ts tests/e2e/details.spec.ts --grep '실제 HP|카메라 강도|WebGL 체력|무공 Shift'
```

이미 실행 중인 최종 빌드 주소 검사는 `MUGONG_PRIORITY_COMPILED=1`, `MUGONG_PRIORITY_URL`과 `MUGONG_E2E_PORT`를 해당 origin/port로 맞추고, 별도 증거 경로를 `MUGONG_PRIORITY_PROOF`에 지정한다. 사용자 브라우저 저장을 테스트 fixture로 바꾸지 않는다.
