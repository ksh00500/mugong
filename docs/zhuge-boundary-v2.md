# 제갈 원화 프레임 침범 수정 · 2026-10-06

기관병 앞 대각선의 공격 후속·회수 원화와 진괄 측면 사망 원화를 built-in `image_gen`으로 다시 제작하고 로컬 게임과 검토 페이지에 적용했다. 연결된 이웃 그림을 칸 경계로 잘라 쓰던 기존 세 프레임을 독립된 완전한 그림으로 교체했다. 공개 서버의 이전 릴리스는 이번 작업에서 변경하지 않았다.

기관병은 하나의 기관함을 기존 왼손으로 지지하고, 다른 손이 방출 후 레버·뚜껑으로 돌아오는 동작이다. 완전한 기관함·뚜껑·술 장식을 유지한다. 진괄은 양발·머리·창날을 모두 포함하는 사망 그림이며 창은 한 자루다. 생성 결과 중 큰 크기로 그려진 초기 후보는 제외하고 크기 기준을 다시 제시한 결과를 선택했다. 머리 크기 ±5%를 수치 인증한 것은 아니다.

## 선택 원본과 포장

- [기관병 원본](source/zhuge-family-v1/engineer-front-right-boundary-v2.png), [최종 프롬프트](source/zhuge-family-v1/engineer-front-right-boundary-v2.prompt.txt): 1448×1086, 3×3 시트의 인덱스 3과 5를 후속·회수 자세로 선택했다. 선택한 그림의 높이는 각각 321px·319px이다. 생성 요청의 번호를 믿지 않고 실제 그림을 보고 선택했다.
- [진괄 원본](source/zhuge-family-v1/jingwal-right-prone-boundary-v2.png), [최종 프롬프트](source/zhuge-family-v1/jingwal-right-prone-boundary-v2.prompt.txt): 1448×1086, 2행 오른쪽의 사망 자세를 선택했다. 검토한 원본 영역 `[684,520,1400,805]` 안에 완전한 그림과 여백이 들어간다. 이전과 같은 좁은 칸으로 강제 자르지 않는다.
- [선택·출처·해시](source/zhuge-family-v1/boundary-v2-provenance.json), 적용 스크립트 `scripts/apply-zhuge-boundary-v2.mjs`, 프레임 manifest `src/game/zhuge-family-frames.json`.

선택 원화는 리사이즈하지 않고 RGBA를 1:1 복사했다. 모든 방향·자세의 배율 0.225와 발 기준 표시를 유지한다. 진괄은 완전한 사망 그림을 담기 위해 공통 칸 너비가 640에서 704px로 늘었다. 이는 여백·캔버스 확대이며 다른 자세의 몸체 배율을 바꾼 것이 아니다. 새 세 그림의 접지 좌표는 부츠·몸체 접촉 높이를 확인해 별도로 지정했다.

## 검증

- 제갈 35시트·420프레임의 원화 연결 성분 분리 검사에서 모호한 분리 0건. 인코딩된 WebP의 모든 보이는 픽셀이 저장한 그림 영역 안에 있으며 최소 32px 여백을 유지한다.
- 변경 대상 외 **417프레임의 보이는 RGBA, 선택 원본 영역, 발 좌표**가 이전 빌드와 일치한다. 모든 캐릭터의 배율·HP 바 고정 높이는 같다.
- 관련 단위 검사 7개, 타입 검사·프로덕션 빌드 통과.
- Canvas/WebGL × 일반/움직임 감소의 브라우저 검사 4개 통과: 7종·8방향·7동작·진행 구간을 포함하는 총 7,840상태와 보스 접촉 768건. HP 바 간격, 방향, 고정 배율 및 예외 부재를 확인한다.
- 로컬 프로덕션 전투·검토 화면 조작 3개 통과: 1440×900, 1366×768, 1093×614. 테스트 저장은 독립 브라우저 컨텍스트만 사용했다.
- 직접 시각 검토: 세 개의 새 추출 프레임과 Canvas/WebGL의 전체 회수 비교 캡처. 전체 7,840상태를 사람이 하나하나 육안 검수한 것은 아니다.

[증거 폴더](verification/zhuge-boundary-v2/)에 원화 검사, 픽셀 보존 비교, 브라우저 캡처·로그, 단위 결과와 빌드 로그를 저장했다. [기관병 후속](verification/zhuge-boundary-v2/engineer-followthrough.png), [회수](verification/zhuge-boundary-v2/engineer-recover.png), [진괄 사망](verification/zhuge-boundary-v2/jingwal-death.png).

로컬 검토: `http://127.0.0.1:5173/art/zhuge-family-v1/review.html`. 기관병의 앞 대각선 후속·회수와 진괄의 측면 사망에서 확인할 수 있다. 기존 초기 원본·검토 기록은 보존했다.
