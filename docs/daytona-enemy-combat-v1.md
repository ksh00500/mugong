# Daytona 적 전투 수정 배포

2026-10-02 · [공개 게임](https://8080-aeae46c6-f6b0-455f-878b-f2381900a712.proxy.daytona.work/)

[기마·암살자·조준·투사체·얼음 폭탄·창병 수정](enemy-combat-v1.md)을 공개 서버에 반영했다. 기존 구역 그림과 사용자 저장을 유지한다.

| 항목 | 확인 값 |
| --- | --- |
| 현재 릴리스 | `/srv/mugong/releases/20261002-enemy-combat-v1` |
| 이전 릴리스 | `/srv/mugong/releases/20261002-zone-art-v2` |
| 전송 크기 | 631,045 bytes · 코드 변경분 |
| 압축 SHA256 | `770e18ff1a8e159faafba510bd778bee9c6ae67d3e6f39dff0611060f29aee9f` |
| 원격 전체 명세 검사 | 191파일 일치 |
| 설정/이전 릴리스 백업 | `/srv/mugong/backups/20261002-enemy-combat-v1/` |
| 최종 HTTP | 200 |
| Nginx 오류 로그 | 0 bytes |

기존 릴리스의 그림·폰트·소리를 복사하고 코드만 전송했다. 전체 빌드 명세와 Nginx 설정 검사 후 현재 링크를 원자적으로 전환했다. 이전 릴리스와 기존 탭의 해시 코드도 보존했다. 사용자 IndexedDB·첨부·생성 원본·SSH 자격 정보는 배포에 포함하지 않는다.

로컬 단위 검사 403개, 브라우저 검사 18개와 빌드가 통과했다. 공개 주소에서는 출전·이동·공격·가방·전투 중 소모품 제한·종료/저장 재개·새로고침 복원, 1093×614 가방/필드 진행 버튼과 키보드 다음 웨이브의 독립 브라우저 검사 2개가 통과했다. JavaScript 예외와 실패한 에셋 요청은 없었다. 공개 코드·전투 모듈과 기마/투사체/구역 그림 등 11파일의 SHA256이 로컬 빌드와 일치했다.

증거: [릴리스](verification/daytona-20261002-enemy-combat-v1/release.json), [배포 결과](verification/daytona-20261002-enemy-combat-v1/deploy-output.txt), [서버 상태](verification/daytona-20261002-enemy-combat-v1/final-server-status.txt), [공개 파일 해시](verification/daytona-20261002-enemy-combat-v1/public-files.json), [공개 게임 흐름](verification/daytona-20261002-enemy-combat-v1/public/result.json), [작은 화면 가방](verification/daytona-20261002-enemy-combat-v1/public/wave-progression/bag-1093-ko-KR.png).

필요하면 현재 링크를 이전 릴리스로 전환하고 `/srv/mugong/start.sh`를 실행해 서버 코드만 복구한다. 사망 이전 사용자 저장으로 되돌리지 않는다. 전투 난이도의 장시간 수동 검증과는 구분한다.
