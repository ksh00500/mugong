# Daytona 배포 · 2026-10-02 · 지역 전투 정체성

[무공 플레이](https://8080-aeae46c6-f6b0-455f-878b-f2381900a712.proxy.daytona.work/)

[10지역 적·40보스 개인 패턴·가방 도구](regional-identity-v1.md)를 배포했다. 독병은 날아간 후 고정한 착지 지대에 피해를 남기며, 서역 기마는 별도 방향 그림과 돌진 경로를 사용한다. 지역별 적의 거리 유지·측면 이동·방어·투척과 보스 개인별 순서·범위·연사·회수 여부를 적용했다. 성장 카드의 무공 그림 잘림과 hover 이동을 고치고 자동 정리를 가방 제목 옆의 큰 도구 버튼으로 이동했다.

## 릴리스

| 항목 | 값 |
| --- | --- |
| 현재 | `/srv/mugong/releases/20261002-regional-identity-v1` |
| 이전 | `/srv/mugong/releases/20261002-pending-weapon-v1` |
| 압축 크기 | 63,283,180 bytes |
| SHA256 | `49eb576d8fff960d05b0b704105178251b42cb1c102f6c04dbfcb4c0098ad6df` |
| 런타임 파일 | 189개 · 원격 전체 해시 확인 |
| 백업 | `/srv/mugong/backups/20261002-regional-identity-v1/` |

생성 원본 PNG·첨부 파일·사용자 저장·SSH 자격 정보는 제외한다. 실제 실행 WebP·필수 PNG·코드·폰트·소리를 포함한다. 이전 릴리스와 설정을 보존하고, 전체 파일 해시 및 Nginx 설정을 검사한 다음 현재 링크를 원자적으로 전환했다. 기존 탭의 해시 코드도 공유 경로에 유지한다.

## 확인 범위

로컬 단위 검사 304개, 최종 로컬 브라우저 검사 40개, TypeScript·Vite 빌드가 통과했다. 20창 크기의 화면/박스/텍스트와 긴 영어, 3핵심 해상도 × 5언어의 성장 선택·자동 정리, 기마 8방향, 독병 투척, 네 보스의 공격 경고/실행, 기존 가방·물품 조작·저장 복원을 검증했다. 개별 캡처의 실제 시각 검토 범위는 [구현 기록](regional-identity-v1.md)에 구분해 기록했다.

공개 파일 8개를 내려받아 로컬 빌드와 해시가 일치함을 확인했다. 신규 기마 WebP도 포함한다. 서버 최종 확인은 현재 릴리스 일치·HTTP 200·Nginx 오류 로그 0 bytes였다.

공개 독립 브라우저 검사 2개가 통과했다. 출전·이동·공격·가방·전투 중 소모품 제한·일시 종료·저장 재개·새로고침 복원과 1093×614의 가방 닫기·필드 진행 버튼·키보드 다음 웨이브를 확인했다. JavaScript 예외와 실패한 에셋 요청은 없었다. 자동 정리 도구가 제목 영역에 추가되므로, 기존 진행 테스트의 “제목 영역에 버튼은 하나”라는 선택자 가정을 실제 닫기 버튼의 접근성 이름에 맞게 수정한 뒤 통과했다. 실제 사용자 저장을 변경하지 않으며 모든 테스트 상태는 독립 Playwright 컨텍스트에만 사용한다. 사람에 의한 40보스 전체 난이도 반복 검증과 기마의 새 다리 연속 프레임은 이번 자동/시각 검증과 별개다.

증거: [릴리스](verification/daytona-20261002-regional-identity-v1/release.json), [배포 실행](verification/daytona-20261002-regional-identity-v1/deploy-output.txt), [서버 상태](verification/daytona-20261002-regional-identity-v1/final-server-status.txt), [공개 해시](verification/daytona-20261002-regional-identity-v1/public-files.json).

복구가 필요하면 이전 릴리스로 `/srv/mugong/current` 링크를 전환하고 `sh /srv/mugong/start.sh`를 실행한다. 사용자 IndexedDB를 사망 이전 상태로 되돌리지 않는다.

공개 증거: [게임 흐름](verification/daytona-20261002-regional-identity-v1/public/result.json), [작은 가방](verification/daytona-20261002-regional-identity-v1/public/wave-progression/bag-1093-ko-KR.png).
