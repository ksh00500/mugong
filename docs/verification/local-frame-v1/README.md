# 로컬 프레임 검사 — 2026-10-23

이번 결과만 기록한다. 이전 온라인/레이드 검사를 합산하지 않는다. [구현](../../local-frame-v1.md).

| 검사 | 이번 결과 |
| --- | --- |
| 전체 Vitest |100파일,1579통과/0실패 |
| 보간 경계 후속 |같은 런타임에서 저장 교체·새 적·웨이브 assertion을 보강한6개 재실행 통과 |
| 타입/실행 에셋 |통과,1069파일/803참조/누락0/LFS0 |
| Vite |254모듈 성공,`dist-local-frame-v1`, 미디어 junction 연결 |
| 소스 Playwright |5통과/0실패: Canvas/WebGL60·120·144·240Hz 제어 일정2개와 화면별 조작3개 |
| 컴파일 Playwright |3통과/0실패:1440×900·1366×768·1093×614 |
| 로컬 적용 |21 HTML/JS/CSS SHA 일치, 익명 온라인 진입3크기/pageerror0, 기존 API health 정상 |

브라우저 조작은 독립 컨텍스트에 유효한 새 무인 사본을 넣는다. 일정 검사는 가상 적의 공격 준비를 고정해 무작위 피해/메뉴와 분리한다. 실제 키보드 이동·IndexedDB 저장 검증·마우스 공격/attackSeq 저장·가방·일시 정지/재개·작은 HUD 경계를 검사했다. WebGL은 이 호스트의 SwiftShader 감지 확장을 가려 해당 경로를 강제로 검사한다.1093캔버스는1088×612이고 실제 alpha=false/antialias=false/high-performance 요청을 확인했다. 진짜 사용자 저장/계정 시험가입은 하지 않았다.

## 측정 구분

- `refresh-before.json`/`refresh-after.json`: 실제 Scene.update에60/120/144/240Hz 일정을 공급한 화면 위치 표본. 준비 구간까지 포함하므로 수정 후 비율도100% 직전이다. 회귀 검사는 준비 후 전 프레임 이동을 검증한다. 두 측정의 시작 elapsed는 준비 시간 차이가 있어 같지 않다. 같은 틱 수의 실제 상태 동등성은 별도 단위 검사에서 비교했다.
- `gpu-probes.json`:1440×900,18웨이브/적13명, 정상 AI·HP360, 약3초, 전/후 번갈아 각3회. 이전 설정은 응답 라우트에서 투명 버퍼/MSAA/default선호를 재구성했으며 같은 보간 코드를 쓴다. FPS=(표본수−1)/측정시간. FPS 중앙값37.3437→53.2760, 간격P95 중앙값30.8→22.4ms, JS갱신P95 중앙값2.2→2.4ms. 소프트웨어 WebGL 단기 합성 장면이며 실제 기기·전투 전구간의 보장값은 아니다.
- 평범한 Canvas 장면은 수정 전에도 약60FPS였고 사용자 보고10~20FPS는 직접 재현되지 않았다. 실제 GPU/화면/드라이버를 이번에 읽지 못했다. CUA 진입도 호스트 커널 경로 오류로 실패해 사용자 브라우저를 직접 검사한 것으로 기록하지 않는다.

## 실패·시각·증거

최초 브라우저 조작3개는 버튼의 정확한 접근성 이름을 `가방`으로 지정해 실패했다. 실제 이름`가방 Tab`으로 검사만 수정하고 전체 소스5/컴파일3을 통과했다. 최초 프로브는 Phaser가 캡처한 `sys.sceneUpdate` 대신 `scene.update`를 감싸 빈 표본이 나와 폐기했다.144Hz 단위 초기 가정은 부동소수점 경계의59/60틱 차이를 고려해 같은 틱 수 대조로 바꿨다. 실패를 성공 표본으로 합산하지 않는다.

컴파일1093 화면과1440 혼잡 전투 PNG를 직접 열어 HUD/인물·배경 표시를 확인했다. 자동 검사는 시각 검토와 구분하며 관절/전체 원화의 새 미술 승인은 아니다. 원본 그림·크기·필터를 바꾸지 않았다.

요약은`summary.json`, 실제 로컬 적용은`local-build.json`이다. 원시 프레임·PNG·trace는 `.local-preview/frames-*`, `.local-preview/frame-browser-{source,compiled}`, `test-results-local-frame-*`에 보관하며 큰 녹화는 Git에 넣지 않는다. Docker/공개 배포와 온라인 프레임 수정은 미실행이다.

재검사: 별도 Vite5227에 `node node_modules/@playwright/test/cli.js test --config playwright.local-frame.config.ts`; 컴파일 preview5228에는 `MUGONG_FRAME_MODE=compiled`, `MUGONG_FRAME_URL=http://127.0.0.1:5228`을 지정한다. 실제 사용자 세이브 대신 Playwright 독립 컨텍스트만 사용한다.
