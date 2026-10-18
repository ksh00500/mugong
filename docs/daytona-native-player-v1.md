# 방향별 적 원화·플레이어 크기 배포 · 2026-10-06

[공개 게임](https://8080-aeae46c6-f6b0-455f-878b-f2381900a712.proxy.daytona.work/). 사용자의 요청 순서대로 이미지 적용본을 먼저 배포하고, 그 다음 플레이어 표시 크기를 50%로 조정하여 두 번째 릴리스를 적용했다. 기존 릴리스와 서버 설정을 보존했으며 사용자 브라우저 저장과 SSH 접속 자격은 배포 파일에 포함하지 않았다.

첫 릴리스 `/srv/mugong/releases/20261006-native-regions-v1`은 10개 지역의 방향별 적 원화와 지금까지의 플레이어 무기·성장·보스 피격/CC 면역·초기화 개선을 포함한다. 이전 서버는 `/srv/mugong/releases/20261004-hostile-consistency-v3`이었다. 런타임과 검토 페이지 588개를 명세로 만들고 변경된 380개 파일만 전송했다. 압축 465,232,223바이트와 SHA256을 확인했다. 생성 PNG 원본은 포함하지 않고 런타임이 참조하는 PNG 효과·UI는 포함한다. 모든 명세 파일의 서버 해시가 통과한 뒤 현재 링크를 원자적으로 전환했다.

첫 공개 검사 12개가 통과했다. 로컬 빌드와 공개 대표 파일의 SHA256 일치, 10개 지역의 새 원화 로딩 및 실제 이동·공격·가방, 모집→무공 선택→전투→저장→이어하기→새로고침 복원을 확인했다. 각 지역의 새 일반 적·보스 시트가 로드되고 JavaScript 예외 및 실패한 이미지/코드/폰트 응답은 없었다. 지역별 독립 검증 자료는 [지역 원화 현황](enemy-art-status-v1.md)에 연결한다.

두 번째 릴리스 `/srv/mugong/releases/20261006-player-size-v1`은 [플레이어 크기 조정](player-size-v1.md)을 추가했다. 첫 이미지 릴리스를 복사하고 코드 3파일만 변경했다. 전송 압축은 354,015바이트이며 모든 588개 명세 파일의 해시와 Nginx 설정 검사가 다시 통과했다. 이전 두 릴리스는 보존했고 기존 열린 탭의 해시 코드도 shared/assets에 남겼다.

최종 공개 검사 7개가 통과했다. 공개 파일 해시, 모집·출전·전투·가방·저장 복원, 소림 1440×900 및 고묘 1093×614의 이동·공격·가방, 1366×768에서 검·권갑·암기의 공격·궁극·방어·저장 재개를 확인했다. JavaScript 예외와 실패한 이미지/코드/폰트 응답은 없었다. 직접 시각 검토는 소림·고묘 전투 화면과 검·권갑·암기 공격 캡처를 확인한 범위다. 모든 프레임을 사람이 개별 검수했다는 뜻은 아니다.

검증 후 서버의 임시 업로드 압축 두 개만 제거했다. 릴리스와 백업은 유지했으며 정리 후 서버 응답은 HTTP 200, 남은 디스크 공간은 약 1GB였다.

주요 증거:

- [이미지 릴리스 정보](verification/daytona-20261006-native-regions-v1/release.json), [적용 로그](verification/daytona-20261006-native-regions-v1/deploy-output.txt), [공개 검사 12개](verification/daytona-20261006-native-regions-v1/public-browser.log).
- [크기 릴리스 정보](verification/daytona-20261006-player-size-v1/release.json), [적용 로그](verification/daytona-20261006-player-size-v1/deploy-output.txt), [최종 서버 상태](verification/daytona-20261006-player-size-v1/final-server-status.txt), [최종 공개 검사](verification/daytona-20261006-player-size-v1/public-browser.log).
- [임시 파일 정리 후 상태](verification/daytona-20261006-player-size-v1/cleanup-server-status.txt), [검증 요약](verification/daytona-20261006-player-size-v1/summary.json).
- 테스트 저장은 Playwright의 독립 컨텍스트에서만 사용했다. 공개 캡처의 높은 보스 HP와 배치된 적은 테스트 데이터다. 실제 사용자 저장은 수정하지 않았다.

공개 게임은 새로고침으로 최신 코드를 받는다. 이번 배포가 보스 원거리 추격·회피 설계의 구현이나 로비 고해상도 원화 제작까지 완료했다는 뜻은 아니다.
