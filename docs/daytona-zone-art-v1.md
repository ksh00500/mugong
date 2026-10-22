# Daytona 배포 · 2026-10-02 · 전장 구역 그림

[무공 플레이](https://8080-aeae46c6-f6b0-455f-878b-f2381900a712.proxy.daytona.work/)

[제단 제거·구역 그림 12종·가방 도구 위치](zone-art-v1.md)를 공개 서버에 반영했다. 제단의 실제 보상·강화 로직을 제거하고, 정상적인 기존 저장은 제단 정보만 정리하여 진행·물품·금화를 유지한다. 자동 정리는 일반 가방 상단 중앙으로 이동했다. 투명 구역 그림 두 장을 로드하며 공격 경고·발동 시점·실제 반지름은 기존 판정 데이터와 함께 표시한다.

## 릴리스

| 항목 | 값 |
| --- | --- |
| 현재 | `/srv/mugong/releases/20261002-zone-art-v2` |
| 이전 | `/srv/mugong/releases/20261002-zone-art-v1` |
| 최종 코드 전송 압축 크기 | 629,798 bytes |
| SHA256 | `595ef5f927c21c9c46e96f68ae184c22cc4e70c60ae425e77ca1317f12672def` |
| 런타임 파일 | 191개 · 원격 전체 해시 확인 |
| 백업 | `/srv/mugong/backups/20261002-zone-art-v2/` |

생성 원본 PNG·첨부·사용자 저장·SSH 자격 정보는 배포에서 제외한다. 두 신규 WebP·필수 코드·폰트·소리를 포함한다. 기존 버전과 설정을 보존한 후 전체 파일 해시·Nginx 설정을 검사하고 현재 링크를 원자적으로 전환했다. 기존 탭의 해시 코드는 공유 경로에 유지한다.

## 확인 범위

로컬 단위 검사 324개, 서로 다른 로컬 브라우저 시나리오 57개와 TypeScript·Vite 빌드가 통과했다. 최종 UI 보정 및 애니메이션 종료 시점 측정 후의 재검 범위는 [구현 기록](zone-art-v1.md)에 별도로 기록했다. 기존 저장의 실제 IndexedDB 로드·자동 저장, 구역 그림의 표시·깊이·소멸·풀 재사용, 20창 크기·긴 영어·3핵심 크기 × 5언어 가방 도구와 다음 웨이브를 확인했다.

공개 파일 10개를 내려받아 로컬 빌드와 해시가 일치함을 확인했다. 신규 `zones.webp`와 `special.webp`도 포함한다. 서버는 현재 릴리스 일치·HTTP 200·Nginx 오류 로그 0 bytes를 확인했다.

공개 독립 브라우저 검사 2개가 통과했다. 출전·이동·공격·가방·전투 중 소모품 제한·일시 종료·저장 재개·새로고침 복원과 1093×614에서 가방 닫기·필드 진행 버튼·키보드 다음 웨이브를 확인했다. JavaScript 예외와 실패한 에셋 요청은 없었다. 실제 사용자 저장은 테스트 상태로 바꾸지 않았다. 40보스의 난이도 전체를 사람이 반복 플레이한 검증과는 구분한다.

최종 v2는 정상적인 이전 저장의 선택적 값과 손상된 구역 ID를 더 엄격히 구분한다. v1 전체 배포(64,169,804 bytes)의 그림을 새 릴리스에 복사해 재사용하고 코드만 전송한 후, 새 빌드 명세의 191개 파일을 다시 해시 검사했다. 두 릴리스는 각각 보존된다.

증거: [릴리스](verification/daytona-20261002-zone-art-v2/release.json), [배포 출력](verification/daytona-20261002-zone-art-v2/deploy-output.txt), [서버 상태](verification/daytona-20261002-zone-art-v2/final-server-status.txt), [공개 해시](verification/daytona-20261002-zone-art-v2/public-files.json), [게임 흐름](verification/daytona-20261002-zone-art-v2/public/result.json), [작은 가방](verification/daytona-20261002-zone-art-v2/public/wave-progression/bag-1093-ko-KR.png).

서버 복구가 필요하면 이전 릴리스로 `/srv/mugong/current` 링크를 전환하고 `sh /srv/mugong/start.sh`를 실행한다. 사용자 IndexedDB를 사망 이전 기록으로 되돌리지 않는다.
