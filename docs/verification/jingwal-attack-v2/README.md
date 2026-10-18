# 진괄 창 동작 검증 · 2026-10-04

## 자동 검사

- `scripts/verify-jingwal-attack-v2.mjs`: 새 공격 30장, 진괄의 기존 30장 및 다른 여섯 인물 360장의 출처·외곽·접지점 보존. 다른 인물의 전달 시트 30개 SHA-256 일치. [기록](preservation.json).
- 선택한 제갈 전체 420장: 시트 경계 잘림 0, 다른 자세와 공유된 그림 0. 원본 RGBA 값 보존, 전달 여백 최소 32픽셀. 원화 분석과 내보내기 보고서는 `docs/source/zhuge-family-v1/source-review.json`, `export-review.json`에 있다.
- 전체 단위 테스트: **51개 파일, 1,245개 통과**. 처음 빌드·브라우저와 함께 실행했을 때 기존 방향 애니메이션의 대량 기하 검사 한 건이 5초 제한을 초과했다. 테스트·판정 코드를 완화하지 않고 `--maxWorkers=2`로 전체를 다시 실행해 통과했다.
- `npm run build`: 통과. 배포 entry는 `main-DvULhO9j.js`다.
- `authored-zhuge.spec.ts`: **4개 통과**. Canvas/WebGL × 일반/움직임 감소 각각 7인물·8방향·7상태의 1,960개 표본과 보스 타격 시점 192개를 확인했다. 배율 0.225 고정, native sprite 사용, 방향/반전 대응, 고정 HP바와 공격 프레임 대응을 검증한다. 일반 모드의 최소 HP바 간격은 11.225픽셀, 감소 모드는 12.125픽셀이다. 페이지 오류 0.
- `local-preview-zhuge.spec.ts`: **세 해상도 통과** — 1440×900, 1366×768, 1093×614. 로컬 production build의 원화 35개 응답, 전투 입력, 리뷰의 7인물 선택·걷기·프레임 진행, 가로 넘침 여부를 확인했다. 1440에서는 진괄 여섯 공격 자세를 실제 다음 프레임 버튼으로 진행해 추가 캡처했다. 초기 캡처 도우미가 모듈 내부 함수에 직접 접근해 실패한 것은 테스트 코드 오류였고, 실제 버튼 조작으로 교체 후 해당 해상도를 다시 검증했다.

## 시각 검토

자동 합격과 별도로 선택 원화에서 분리된 두 손, 연결된 팔·창대, 낮은 준비 자세, 후면의 북쪽 찌르기와 접지점을 검토했다. Canvas/WebGL의 `*-full-windup.png`, `*-full-strike.png`, `*-full-recover.png`에서 진괄 행(여섯 번째)의 실제 합성과 HP바를 확인했다. `production/jingwal-pose-2.png`와 `jingwal-pose-3.png`에는 타격·후속 여덟 방향이 게임 배율의 두 배로 나온다.

단위·브라우저 검사는 인체 관절의 완전성을 인증하지 않는다. 시각 검토는 이번 선택 원화와 합성 화면의 판단이다. 보스 기술별 독립 원화 제작 여부와 변경 범위는 [작업 기록](../../jingwal-attack-v2.md)에 명시했다.

## 재실행

```text
node node_modules/vitest/vitest.mjs run --maxWorkers=2
```

브라우저 검사 시 `MUGONG_ZHUGE_PROOF=docs/verification/jingwal-attack-v2`, 개발 검사에는 `MUGONG_E2E_PORT=5174`, 배포 검사에는 `MUGONG_PRODUCTION_VERIFY=1`을 설정한다. 개발은 기본 Playwright 설정의 `authored-zhuge.spec.ts`, 배포는 `playwright.production.config.ts`의 `local-preview-zhuge.spec.ts`를 사용한다. 사용자 저장 대신 독립 브라우저 컨텍스트의 테스트 데이터를 사용한다.
