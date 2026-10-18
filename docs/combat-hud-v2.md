# 무협 전투 HUD · 2026-09-29

배경과 캐릭터의 카툰 화풍은 유지하고 전투 HUD를 한지·먹색·대나무·절제한 청동 장식으로 바꿨다. 이미지의 장식선을 임의 배경 크기로 늘리지 않고 9분할 테두리로 실제 박스에 맞춘다. 장식과 글자가 같은 영역을 차지하지 않게 안쪽 여백을 둔다.

## 배치와 동작

- 왼쪽 아래: 현재 무공과 부채꼴 비급. 현재 무공은 중앙 쪽에서 강조하며 앞뒤 무공을 Q/E로 순환한다. 비급 클릭과 Q/E 버튼도 같은 전환 명령을 실행한다. 공격 동작 중에는 기존 전환 규칙에 따라 잠시 비활성화된다.
- 가운데 아래: 현재 무공의 궁극기 게이지·개방 상태. 기존 우클릭 궁극 행동과 충전 규칙을 유지한다.
- 오른쪽 아래: 현재 방어 행동과 배운 무공별 재사용 표시. 회피·반격·혈기탈취·방어의 실제 defenseCd를 원형 진행 표시와 남은 초로 보여준다. Space는 현재 무공의 행동을 실행한다. 독립적인 새 회피·반격 규칙을 추가하지 않았다. 무공에 무장이 연결되지 않으면 `무장 필요`를 표시한다.
- 왼쪽 위: 작은 초상·이름·레벨·체력·경험치. 오른쪽 위: 작은 웨이브·가방·일시 정지. 보스는 위 가운데에 표시한다. 전투 중앙을 차지하던 큰 패널과 설명을 줄였다.
- 좁은 세로 창: 위 정보 두 열, 아래 무공/방어 두 열, 궁극기 가운데의 별도 줄. 작은 창에서도 필수 정보와 버튼이 남는다.

재사용 시간은 시뮬레이션 값을 그대로 읽는다. 화면 표시용 타이머나 가짜 숫자를 따로 만들지 않았다. 무공·피해량·입력·저장 형식은 바꾸지 않았다. reduced-motion에서는 비급 움직임을 생략한다.

## 생성 자산

`image_gen` 내장 도구로 [HUD 프레임 PNG](../public/art/ui/hud-frame-v1.png)를 생성하고 전송용 `public/art/delivery-v1/ui/hud-frame-v1.webp`로 변환했다. PNG는 1254×1254, 실제 투명도가 있다. 전송용 WebP는 187,164 bytes, 품질 90이다. 원본은 보존한다.

사용한 짧은 프롬프트:

> A single square ornamental frame for a wuxia game HUD. Warm aged ivory paper edges, fine dark ink vines and bamboo at the four corners, small muted bronze accents. Thin quiet borders and very wide clean transparent center. Straight edges, same border thickness on every side, corner decorations confined to the outer 12 percent so this can be used as a nine-slice UI frame. No text, characters, icons or background scene.

## 검증과 한계

빌드 성공. HUD 3개 크기의 Q/E 순환·실제 회피 쿨타임, 한국어/영어 반응형, 로딩·복구 흐름 관련 13개 검사 통과. 부채꼴 가장자리 여백을 추가한 최종 상태의 로컬 전체 55개 중 54개 통과, 공개 전용 1개 제외, 실패 0개였다. 단위 검사 48개 통과 기록도 유지한다. 자동 검사는 동작·범위를, 직접 시각 검토는 문구 대비·패널 크기·이미지 정렬·전투 가림 정도를 확인했다. 테스트 저장은 독립 Playwright 컨텍스트에만 생성한다.

공개 연결의 느린 첫 다운로드에서 기존 20초 이미지 제한에 걸리는 사례가 있었다. 그림 용량을 줄인 것에 더해 이미지 대기 60초·전투 준비 65초로 바꿨다. 느린 연결 안내와 실패 후 재시도/기본 화면은 유지한다. 서버의 연결 상태나 공개 프록시 응답 속도를 보장하는 변경은 아니다.

공개 검증의 headless Chromium에서 HTTP/2 이미지 응답 본문이 오래 멈추는 현상이 관찰됐다. 검증용 브라우저를 HTTP/1.1로 실행해 새 HUD 전환·쿨타임과 가방 수납 시나리오의 통과를 확인했다. TLS나 실제 게임의 네트워크 설정을 변경한 것은 아니다. 실제 Codex 브라우저에서도 최신 로비가 정상 표시되고 새 JavaScript·재질 경로를 확인했다. 모든 환경의 첫 접속 속도를 보장하지 않는다.

- [관련 13개 검사](verification/combat-hud-v2/related-result.json)
- [전체 회귀 검사](verification/combat-hud-v2/full-result.json)
- [1093×614 실제 전투 화면](verification/combat-hud-v2/combat-1093x614.png)
- [1366×768](verification/combat-hud-v2/combat-1366x768.png), [1440×900](verification/combat-hud-v2/combat-1440x900.png)
- [공개 주소의 HUD](verification/combat-hud-v2/daytona/combat-1093x614.png), [공개 가방](verification/glance-v2/daytona/loot-before-1093x614.png)
- [공개 출전·전투·저장 복원 결과](verification/daytona-20260929-combat-hud/result.json)
- [가방·재질·효과 정렬](glance-ui-v2.md), [배포 기록](daytona-deployment.md)
