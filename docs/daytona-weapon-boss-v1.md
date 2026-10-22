# 무기 부착·보스 개편 배포 · 2026-10-04

[공개 게임](https://8080-aeae46c6-f6b0-455f-878b-f2381900a712.proxy.daytona.work/). 현재 릴리스는 `/srv/mugong/releases/20261004-weapon-boss-v1`이다. 이전 `/srv/mugong/releases/20261003-animation-growth-v3`을 보존했다. 열려 있던 게임은 새로고침으로 최신 빌드를 적용한다. 실제 사용자 브라우저 저장은 변경하지 않았다. SSH 자격 정보는 기록하지 않는다.

## 반영 내용

- [무기 부착 감사](weapon-attachment-v1.md): 외형 10종의 방향/동작 손 기준점 140개, 장착 원화 28개의 손잡이와 회전축, 실제 메시 움직임 연결, 반전·뒤쪽 가림·피격 연결. 전투용 낱개 암기 4종과 한 손 권갑 5종을 추가했다.
- [보스 개편 1차](boss-melee-v1.md)·[2차](boss-melee-v2.md)·[3~5차](boss-followup-v3-v5.md): 현재 로컬 빌드의 40명·185개 전용 행동이 배포됐다. 불필요한 원거리 패턴을 줄이고 무기/개인 콘셉트에 맞는 근접 접촉과 기믹을 반영했다. 최종 실전 난이도 조정까지 검증했다는 의미는 아니다.
- 이번까지 로컬에 반영된 10종 모집 외형, 능력/특성 아이콘과 설명, 삼재 고성급 성장 규칙도 같은 빌드에 포함된다.

## 배포와 검증

최신 `npm run build`와 공개 검증 코드의 타입 검사가 통과했다. 앞선 로컬 검증은 단위 검사 1,158개, 무기 부착/외형/방향 브라우저 검사 12개와 Canvas/WebGL 775,040개 상태를 포함한다. 공개 검사는 아래의 주요 흐름이며 전체 상태 검사를 서버에서 반복한 것은 아니다.

1. 기존 서버 파일과 SHA256을 비교해 변경된 38파일만 전송했다. 압축은 4,752,212 bytes, SHA256 `b982908cb3dafe77012dea876abd9e43213c63cfb803b576513a18faae0c4d2e`다.
2. 새 릴리스에 이전 파일을 복사하고 최신 파일을 적용했다. 로컬 빌드의 318파일 SHA256 검증과 Nginx 설정 검사를 통과한 뒤 current 링크를 원자적으로 전환했다. HTTP 200을 확인했다. 이전 해시 모듈은 shared/assets에 유지한다.
3. 공개 변경 파일 38개를 내려받아 로컬 빌드와 해시 일치를 확인했다. 새 무기/외형/능력 아이콘도 포함한다.
4. 공개 Playwright 5개 검사 통과: 파일 일치, 모집→무공 선택→전투→가방→저장→이어하기→새로고침, 도화 협객의 암기·노년 협객의 권갑·홍의 무인의 검 공격/궁극기/방어/가방/저장 재개. JavaScript 예외와 실패한 그림·모듈·폰트 응답이 없었다.
5. 테스트 저장은 독립 Playwright 컨텍스트에서만 사용했다. 공개 공격 캡처 3장과 모집 화면을 별도로 시각 검토했다. 모집 캡처는 새 초상화/아이콘의 다운로드 완료를 기다리도록 검증을 보강했고, 해당 출전 흐름 1개를 재실행해 통과했다.

증거: `docs/verification/daytona-20261004-weapon-boss-v1/release.json`, `deploy-output.txt`, `public/files.json`, `public/journey/result.json`, `public/appearance-9-dart.json`, `public/appearance-7-gauntlet.json`, `public/appearance-3-sword.json`와 해당 화면 PNG.

검증 명령: `MUGONG_DAYTONA_URL`을 지정하고 `npx playwright test --config playwright.weapon-release.config.ts --reporter=line`. 새 검사 파일은 `tests/e2e/weapon-release.spec.ts`다. 배포 중 기존 사용자 저장을 지우거나 테스트 상태로 대체하지 않는다.
