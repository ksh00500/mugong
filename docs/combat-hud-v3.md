# 전투 HUD · 펼친 부채와 무협 재질

2026-09-29. v2의 반복 사각 프레임과 떨어진 카드가 참고 이미지의 자연스러운 무협 화면과 달랐다. 전투 세계와 캐릭터는 유지하고, HUD의 실루엣·그림·텍스트 위치를 새로 구성했다.

- 상단 왼쪽: 원형 초상과 종이 상태판을 한 그래픽으로 묶고 이름·레벨·체력·경험치를 종이의 깨끗한 면에 배치한다.
- 상단 가운데: 지역 또는 보스. 오른쪽은 웨이브와 가방·정지 행동을 작은 리본과 버튼으로 표시한다.
- 하단 왼쪽: 실제 펼친 부채 안에 배운 무공을 배치한다. 현재 무공은 원형 선택 표시와 이름으로 구분한다. Q/E, 전환 버튼, 각 무공 직접 클릭이 같은 실제 전환 명령을 사용한다.
- 가운데 하단: 옥과 청동 장식에 궁극기 게이지·개방 조건·발동 안내를 결합한다. 준비 상태의 강조는 과도한 반복 발광을 사용하지 않는다.
- 오른쪽 하단: 현재 방어 행동과 Space, 각 무공의 실제 재사용 시간·무장 필요 상태를 표시한다. 무공에 맞춰 회피·반격·혈기탈취·방어가 바뀐다.

장식은 투명 래스터, 내용과 클릭 영역은 별도 DOM이다. 장식의 먹선에 글자가 겹치지 않도록 안쪽 여유 공간을 따로 잡았다. 프레임을 박스 전체에 9분할 반복하는 v2 방식을 이 화면에서 교체했다. 큰 글씨·고대비 설정과 움직임 줄이기를 유지한다. 작은 화면에서는 각 영역의 배치를 바꾸며 화면 전체를 축소하지 않는다.

## 그림과 로딩

내장 이미지 생성 도구를 사용했다. [원본](../public/art/ui/hud-atlas-v3.png)은 1670×942 RGBA, [전송 사본](../public/art/delivery-v1/ui/hud-atlas-v3.webp)은 품질 90, 371,124 bytes다. 해상도와 alpha는 동일하다. 이전 그림을 덮어쓰지 않았으며 새 파일명으로 캐시를 분리했다.

전투 시작 전에 이 그림도 내려받고 해독한다. 실제 준비가 끝난 뒤 HUD를 표시한다. DOM에서만 사용하는 그림을 Phaser 텍스처에 추가하지 않아 불필요한 중복 텍스처를 피한다.

최종 생성 프롬프트:

> Create a transparent game HUD art sheet for a Korean wuxia action game. Reference image is for the warm parchment, ink-brush and aged bronze aesthetic only. Four separate blank elements arranged in a precise 2×2 grid with transparent gutters: top left a wide irregular parchment nameplate with a dark round portrait setting on its left; top right a wide compact parchment ribbon with bronze end ornaments; bottom left an opened semicircular paper martial-arts fan with dark bamboo ribs and a bronze pivot; bottom right a long dark ink-brush gauge setting with a round jade-and-bronze medallion at its left. Painted game art, expressive natural edges, restrained bamboo flourishes, strong readable silhouettes. Spacious clean centers for runtime text. No lettering, icons, numbers, bars or background scene. Every element wholly inside its own equal grid cell.

사용자가 제공한 전투 화면은 분위기 참고 이미지다. 동작 자세를 세세하게 지정하는 프롬프트는 사용하지 않았다.

## 검증

자동 검사 결과와 수동 시각 검토는 구분한다. 실제 사용자 저장에 테스트 상태를 넣지 않았다. Playwright의 독립 브라우저 컨텍스트에서 무공 0·1·4개, 궁극 개방, 보스, 5개 언어, 기본·큰 글씨·고대비, 움직임 줄이기, 가방 열기·닫기와 초점 복원을 확인한다. 기준 크기는 1440×900, 1366×768, 1093×614이며 작은 배치의 760×614, 520×700도 검사한다.

최종 로컬 전체: **56개 통과, 공개 전용 1개 제외, 실패 0개**. Vitest 게임 규칙 검사 **48개 통과**. 창 너비·높이를 연속 변경하는 한국어 180개 상태와 영문 25개 상태에서 행동 겹침·박스 넘침이 없다. 첫 전체 실행에서 발견한 761px 너비의 13px 넘침은 두 줄 HUD 전환 시점을 820px로 옮겨 수정했다. 최종 전체 실행에서 재확인했다.

- [전체 자동 검사](verification/combat-hud-v3/full-result.json)
- [실행 화면 1093×614](verification/combat-hud-v3/combat-1093x614.png)
- [실행 화면 1440×900](verification/combat-hud-v3/combat-1440x900.png)
- [보스·궁극 준비](verification/combat-hud-v3/state-ko-4.png)
- [무공을 배우기 전](verification/combat-hud-v3/state-ko-0.png)
- [영문 보스 화면](verification/combat-hud-v3/state-en-4.png)
- [공개 실행본 HUD 검증](verification/daytona-20260929-combat-hud-v3/suite-result.json)
- [공개 출전·저장 흐름 검증](verification/daytona-20260929-combat-hud-v3/journey-suite-result.json)
- [공개 가방 수납·정리판 검증](verification/daytona-20260929-combat-hud-v3/bag-suite-result.json)
- [공개 실행본 HUD 캡처](verification/combat-hud-v3/daytona/combat-1093x614.png)

최종 공개 실행본에서도 HUD, 출전·저장 복원, 가방 수납·정리판의 세 시나리오가 각각 통과했다. 출전 흐름의 JavaScript 예외와 실패한 그림·폰트·모듈 응답은 없었다.

Daytona `/srv/mugong/releases/20260929-combat-hud-v3`에 배포했다. 업로드 SHA256은 `4bb7a21c66020cddb924f03aa33dd60e0a0879f80bdf9e9eff35be2008ca893a`이며 원격에서 일치한다. Nginx 구문 검사와 HTTP 200을 확인했다. 실제 사용자 브라우저의 로비가 `/assets/index-DFS3MMpI.js`를 사용하는 것도 확인했다. 공개 HUD의 Q/E·직접 클릭·회피 재사용·화면 안 배치는 독립 브라우저에서 통과했다. 공개 검증용 Chromium은 프록시의 이미지 수신 지연을 피하기 위해 HTTP/1.1로 실행했으며 TLS 검증은 유지했다.

수동 검토에서는 위 실제 실행 캡처를 열어 종이의 먹선과 글자, 선택 표시와 부채 면, 게이지와 장식의 일치, 빈 패널과 겹침을 확인했다. 자동 치수 검사가 통과해도 먹선 위의 글자가 읽기 어려울 수 있어 내용을 안쪽으로 옮기고 경험치 배경 대비를 보강했다. 모바일 터치 조작 완성, 실제 사용자 사용성 조사, 접근성 인증을 의미하지 않는다.
