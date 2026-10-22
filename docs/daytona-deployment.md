# Daytona 배포 · 2026-09-29

최신 배포는 [2026-10-04 무기 부착·보스 개편 배포](daytona-weapon-boss-v1.md)를 참조한다. 아래는 2026-09-29 릴리스의 기록이다.

[무공 플레이](https://8080-aeae46c6-f6b0-455f-878b-f2381900a712.proxy.daytona.work/)

[타격감·전투 가독성 개선](combat-feel-v1.md)을 배포했다. 실제 접촉 시점의 검격·반동·소리, 판정과 같은 적 공격 예고, 반격·방어 피드백과 짧은 클릭 보호를 적용한다. 기존 [무협 HUD](combat-hud-v3.md), 가방·전리품·정리판을 함께 보는 UI, 5개 언어와 저장 보호를 유지한다. 첫 방문에 Daytona 안내가 나타나면 `I Understand, Continue`로 게임을 연다. SSH 접속 자격 정보는 이 문서나 배포 파일에 저장하지 않았다.

## 환경과 실행

| 항목                    | 실제 확인 값                                                       |
| ----------------------- | ------------------------------------------------------------------ |
| OS                      | Ubuntu 22.04.5 LTS, x86_64                                         |
| 자원 제한               | 2 vCPU / 메모리 4 GiB / 디스크 8 GiB                               |
| 제공 방식               | 로컬에서 Vite 빌드 → Nginx 정적 파일 제공                          |
| 포트                    | 8080                                                               |
| 릴리스                  | `/srv/mugong/releases/20260929-combat-feel-v1`                          |
| 현재 릴리스 링크        | `/srv/mugong/current`                                              |
| 설정 / 로그             | `/srv/mugong/nginx.conf`, `access.log`, `error.log`                |
| 업로드 압축 파일 SHA256 | `e701b039441ccecdcde84affbd04a62e704e2c436bd186a7f42f9e42a0e78acd` |

업로드 압축 파일은 5,581,587 bytes, 약 5.32 MiB다. `dist`에서 현재 코드가 쓰는 art/delivery-v1 WebP·폰트·HTML·CSS·JavaScript를 포함하고 원본 PNG와 미사용 이전 그림은 제외했다. 전송용 WebP는 품질 90으로 RGB를 압축했으며 해상도·alpha는 원본과 동일하다. PNG는 로컬과 이전 릴리스에 보존한다. 소스 코드, 로컬 저장, 첨부 파일, 개발 서버는 원격에 올리지 않았다. 원격에 Node.js나 GPU는 필요하지 않다. 서버는 문서와 그림을 전달하고 게임은 접속자의 브라우저에서 실행한다.

이전 릴리스 `20260929-combat-hud-v3`, `20260929-combat-hud-v2`, `20260929-glance-v3`, `20260929-glance-v2`, `20260929-audit-v1`, `20260929-layout-v3`, `20260929-text-loading-v3`, `20260929-readability-v2`, `20260928-language-v1`, `20260928-graphic-v1`는 `/srv/mugong/releases/`에 롤백용으로 보관한다. 다국어 적용 기록은 [언어 지원](language-v1.md), 확대 UI는 [UI 확대와 가방 개선](readability-bag-v2.md), 텍스트·로딩은 [해당 기록](text-loading-v3.md), 배치는 [배치·간격 점검](layout-spacing-v3.md), 저장 검토는 [전체 검토](audit-v1.md), 최신 화면은 [한눈에 보는 UI](glance-ui-v2.md)에 둔다.

샌드박스가 실행 중일 때 접속할 수 있다. 샌드박스 자동 정지 정책은 변경하지 않았다. 컨테이너에 systemd가 없으므로 자동 부팅 서비스는 설정하지 않았다. 샌드박스가 다시 켜진 후 SSH 셸에서 다음 명령으로 Nginx를 실행한다. 이미 실행 중이면 설정만 다시 읽는다.

```sh
sh /srv/mugong/start.sh
```

시작 스크립트의 원본은 `deploy/start.sh`, Nginx 설정의 원본은 `deploy/nginx.conf`다. 저장은 브라우저의 IndexedDB에 속한다. localhost 저장과 Daytona 주소의 저장은 별개다. 계정 서버나 온라인 레이드·PVP 서버는 이번 배포에 포함하지 않는다.

## 이후 갱신

1. 로컬 Node.js 22.12 이상에서 `npm ci`, `npm run build`를 실행한다.
2. `dist`의 내용을 tar.gz로 묶어 새 릴리스 이름으로 업로드한다. 원본 PNG를 제외할 때는 현재 코드가 WebP만 사용하는지 먼저 확인한다. `deploy/upload.ps1`은 PowerShell의 텍스트 변환 없이 SSH 표준 입력으로 파일 바이트를 전달한다.
3. 새 릴리스 디렉터리에 압축을 풀고 로컬과 원격 SHA256을 비교한다.
4. `/srv/mugong/current`를 새 릴리스로 연결하고 `sh /srv/mugong/start.sh`로 제공한다. 이전 릴리스는 롤백을 위해 보관한다.
5. `MUGONG_DAYTONA_URL` 환경 변수에 공개 주소를 지정한 뒤 `npx playwright test --config playwright.daytona.config.ts`를 실행한다.

해시 이름의 `/assets/`는 장기 캐시, `index.html`은 재검증, `/art/`는 1시간 캐시로 제공한다. 동일 파일명 그림을 변경하는 다음 릴리스에서는 그림 이름도 갱신해 이전 캐시가 남지 않게 한다.

## 검증 기록

자동 검사: 최신 로컬 전체 결과와 공개 주요 흐름은 아래 기록을 따른다. 이전 audit-v1의 공개 14개 시나리오 통과 기록은 이전 결과 링크에 보존한다. 이번 공개 첫 다운로드 검사에서는 프록시 수신 지연으로 일부 초기 로딩 실패가 발생했다. 원본 보존·전송 용량 감소와 준비 대기 조정을 적용했다. 사용자 실제 저장에는 테스트 데이터를 넣지 않았다.

최신 로컬 전체 60개 통과, 공개 전용 1개 제외, 실패 0개. 게임 규칙 63개도 통과했다. 공개 검사에서는 Chromium의 HTTP/2 응답 수신이 멈추는 사례가 있어 검증용 브라우저만 HTTP/1.1로 실행했다. 이번 첫 공개 검사의 두 시나리오는 페이지 진입에서 DNS·네트워크 변경 오류가 발생했고 해당 검사만 재실행해 통과했다. 실제 사용자 브라우저에서도 최신 로비를 확인했다. 공개 첫 방문의 지연은 남을 수 있다.

공개 출전·전투·가방 사용 제한·저장·새로고침·이어하기도 새 빌드에서 검증했다. JavaScript 예외와 400 이상 그림·폰트·모듈 응답은 없었다. 실행 메타데이터 `result.json`과 JSON 리포터 파일을 분리했다. 이전 v2에서 발견한 리포터 파일 충돌 기록은 이전 결과에 보존한다.

최종 공개 실행본의 실제 공격·회피·가방 열기/닫기, HUD 전환·실제 재사용 시간, 출전·저장 복원의 세 시나리오가 각각 통과했다. 가방 수납·정리판의 자세한 검사는 이번 로컬 전체 실행과 이전 공개 기록에 포함한다.

수동 시각 검토: Codex 브라우저에서 실제 최신 로비와 전송용 재질 경로를 확인했다. 독립 검증 캡처에서 가방 격자·물품·전리품의 정렬과 무협 HUD의 대비·크기·부채꼴 가장자리를 확인했다. 사용자 브라우저에서 새 무인을 만들지는 않았다.

원격 검사: Nginx 구문 검사 통과, 시작 스크립트 재호출 성공, HTTP 200, 업로드 압축 파일 해시 일치. 실제 공개 브라우저에서 `/assets/index-CUH4lm2N.js`를 확인했다. 큰 무손실 이미지의 공개 수신 지연을 발견해 전송용 사본으로 변경한 뒤 실제 로비 정상 표시를 확인했다. 이전 릴리스의 로그 검사 기록은 이전 검증 자료에 보존한다.

검증 범위는 현재 브라우저 빌드의 주요 흐름이다. 동시 접속 부하, 멀티플레이, 장기 가용성을 검증한 결과는 아니다.

- [타격감·가독성 전체 검증](verification/combat-feel-v1/full-result.json)
- [최신 공개 공격·회피·HUD 검사](verification/combat-feel-v1/public-retry-result.json)
- [최신 공개 출전·저장 결과](verification/combat-feel-v1/daytona-journey/result.json)
- [첫 공개 검사·네트워크 오류 기록](verification/combat-feel-v1/public-first-result.json)
- [타격감·가독성 기록](combat-feel-v1.md)
- [이전 무협 HUD 전체 검증](verification/combat-hud-v3/full-result.json)
- [이전 공개 주요 흐름](verification/daytona-20260929-combat-hud-v3/result.json)
- [이전 공개 HUD 검사](verification/daytona-20260929-combat-hud-v3/suite-result.json)
- [이전 공개 출전·저장 검사](verification/daytona-20260929-combat-hud-v3/journey-suite-result.json)
- [이전 공개 가방 검사](verification/daytona-20260929-combat-hud-v3/bag-suite-result.json)
- [이전 v2 전체 검사](verification/combat-hud-v2/full-result.json)
- [이전 v2 공개 파일 충돌 기록](verification/daytona-20260929-combat-hud/first-suite-result.json)
- [무협 HUD 기록](combat-hud-v3.md)
- [텍스트·로딩 전체 검증](verification/text-loading-v3/result.json)
- [배치·간격 전체 검증](verification/layout-v3/result.json)
- [공개 자동 검사 결과](verification/daytona-20260929-audit/result.json)
- [로비](verification/daytona-20260929-audit/lobby.png)
- [전투](verification/daytona-20260929-audit/combat.png)
- [가방](verification/daytona-20260929-audit/bag.png)
- [이전 텍스트·로딩 공개 검증](verification/daytona-20260929-text-loading/result.json)
- [이전 확대 UI 검증](verification/daytona-20260929-readability/result.json)

운영 동작 참고: [Daytona Preview](https://www.daytona.io/docs/en/preview/), [Sandbox lifecycle](https://www.daytona.io/docs/en/sandboxes/).

