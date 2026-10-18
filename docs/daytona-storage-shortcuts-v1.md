# Daytona 창고와 단축키 배포

2026-10-02. [공개 게임](https://8080-aeae46c6-f6b0-455f-878b-f2381900a712.proxy.daytona.work/)에 `20261002-storage-shortcuts-v1`을 배포했다.

이전 `20261002-enemy-combat-v1` 릴리스는 보존한다. 서버의 전체 실행 파일 191개 해시와 빌드가 일치하며 공개 HTML·JS·CSS·주요 그림 11개도 일치한다. HTTP 200, 서버 오류 로그 0바이트를 확인했다.

공개 빌드의 독립 Playwright 컨텍스트에서 4개 시나리오를 통과했다: 작은 화면 창고 전용 목록/검색/페이지/단축키/초점/저장 복원, 가방↔창고 이동과 T 정리, 전투 후 획득 물품 이동, 만석 및 귀환 무인 없는 상태에서 물품 보존. 실제 사용자 저장은 수정하지 않았다.

검증 자료: `docs/verification/daytona-20261002-storage-shortcuts-v1/`. 동작·로컬 검증은 [창고와 단축키](storage-shortcuts-v1.md)에 기록한다.
