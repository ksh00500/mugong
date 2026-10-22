# Daytona 배포 · 2026-10-02 · 무기와 획득 물품

이 릴리스는 이전 기록이다. 현재는 [지역 전투 정체성 릴리스](daytona-regional-identity-v1.md)를 참조한다.

[무공 플레이](https://8080-aeae46c6-f6b0-455f-878b-f2381900a712.proxy.daytona.work/)

[실제 연결 무기·성장 선택·획득 물품 통합](pending-weapon-growth-v1.md)을 배포했다. 무기 없는 주인공 그림에 현재 연결 물품을 따로 표시하고 소림 타격의 긴 봉 모양을 제거했다. 성장 선택의 중복 시간 검사를 제거하고 저장 상태·거절 안내를 표시한다. 정리판을 없애고 구매품·드랍·꺼낸 물품을 획득 물품으로 모으며 이전 저장의 물품을 보존해 옮긴다.

## 배포 결과

| 항목 | 값 |
| --- | --- |
| 현재 릴리스 | `/srv/mugong/releases/20261002-pending-weapon-v1` |
| 이전 릴리스 | `/srv/mugong/releases/20261001-ui-boss-v1` |
| 압축 크기 | 62,945,661 bytes |
| SHA256 | `9d549532922759e871c49e12d22af6717ec2740072ec0fb590dba501596d9bef` |
| 런타임 파일 | 188개 · 원격 해시 확인 |
| 백업 | `/srv/mugong/backups/20261002-pending-weapon-v1/` |

런타임 WebP·필수 PNG·폰트·소리를 포함했다. 생성한 원본 PNG와 첨부 파일·사용자 저장·SSH 자격 정보는 배포하지 않았다. 기존 릴리스·설정·시작 스크립트·이전 링크를 보존하고 파일 해시와 Nginx 설정을 검사한 뒤 현재 링크를 원자적으로 교체했다. 기존 탭의 이전 해시 코드도 공유 경로에 유지한다. 샌드박스 종료 정책은 변경하지 않았다.

## 검증

로컬 단위 테스트 247개, 관련 브라우저 검사 74개, 프로덕션 빌드를 통과했다. 공개 주소에서는 독립 Playwright 컨텍스트로 출전·이동·공격·가방·전투 중 소모품 제한·저장·재개·새로고침 복원과 1093×614 화면의 가방 닫기·필드 진행·키보드로 다음 웨이브 진입을 검증해 2개 테스트가 통과했다. 실제 사용자 저장은 변경하지 않았다.

공개 파일 7개의 해시가 로컬 빌드와 일치했다. 새 무기 없는 주인공 WebP도 포함한다. 공개 게임 검사에서 JavaScript 예외와 실패한 에셋 요청은 없었다. 최종 서버 확인 결과 현재 릴리스 경로가 일치하고 HTTP 200, Nginx 오류 로그 0 bytes였다.

직접 시각 검토는 보스 권갑을 연결한 로컬 전투 캡처와 공개 1093×614 가방 캡처를 열어 수행했다. 검이 남지 않는 주먹 자세, 정리판 없는 획득 물품 한 영역, 두 격자·선택 정보·큰 진행 버튼을 확인했다. 검증 범위는 위 흐름과 화면이며 서비스 수준이나 접근성 인증을 주장하지 않는다.

증거: [릴리스 정보](verification/daytona-20261002-pending-weapon-v1/release.json), [배포 결과](verification/daytona-20261002-pending-weapon-v1/deploy-output.txt), [서버 상태](verification/daytona-20261002-pending-weapon-v1/final-server-status.txt), [공개 파일 해시](verification/daytona-20261002-pending-weapon-v1/public-files.json), [공개 게임 검사](verification/daytona-20261002-pending-weapon-v1/public/result.json), [작은 화면의 가방](verification/daytona-20261002-pending-weapon-v1/public/wave-progression/bag-1093-ko-KR.png).

이전 릴리스 복구가 필요하면 `/srv/mugong/current`를 이전 릴리스로 교체하고 `sh /srv/mugong/start.sh`를 실행한다. 사용자 저장은 브라우저 IndexedDB에 속하며 사망 이전 저장으로 되돌리지 않는다. 온라인 레이드·PVP 서버 구현은 이 정적 게임 배포와 별개다.
