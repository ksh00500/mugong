# 애니메이션·모집 배율 배포

2026-10-03. [공개 게임](https://8080-aeae46c6-f6b0-455f-878b-f2381900a712.proxy.daytona.work/).

현재 릴리스는 `/srv/mugong/releases/20261003-animation-growth-v3`. 이전 `20261003-character-growth-v2a`를 보존했다. 새 릴리스에 이전 파일을 복사하고 최신 정적 빌드를 적용한 뒤 파일 검증을 통과하여 current 심볼릭 링크를 원자적으로 전환했다. 기존 해시 이름의 JS/CSS는 shared/assets에 보존한다. 사용자 브라우저 저장은 변경하지 않는다. 자격 정보는 기록하지 않는다.

## 반영 범위

- [전체 캐릭터 동작 개선](animation-rebuild-v2.md): 528칸의 새 키 원화, 실제 이동 기반 보행, 피격·사망 크기 보정, 공격 자세 잔류 수정, 기병 보행 방향과 드론 날갯짓.
- [모집 배율 분포](recruitment-growth-distribution.md): 신규 후보 추가 합계 +0.5~+1.5, +1.0을 중심으로 집중. 개별 ×0.8~×2.0. 기존 후보/출전 무인 유지.
- 앞선 캐릭터 증강 아이콘, 모집 초상화, 자세 전환 및 효과음 개선도 최신 빌드에 포함한다.

## 검증

- 최신 빌드 및 타입 검사 성공. 단위 검사 894개, 로컬 모집 브라우저 검사 4개, 애니메이션 브라우저 검사 37개 통과 기록을 기반으로 배포했다.
- 전송 압축 SHA256 `0ebffff7165efd2e6871bf0e27526c0da5ae06111278aeab848b1b92c6b8f80f`, 232,923,265 bytes. 원격 287개 파일의 해시 일치. Windows 체크섬 목록의 CRLF는 검증 입력에서 CR을 제거해 읽었다. 실제 파일 내용은 바꾸지 않았다.
- Nginx 설정 검사 성공, 8080 HTTP 200. 공개 경로의 HTML/JS/CSS 및 새 원화·초상화 28파일을 받아 로컬 SHA256과 모두 일치함을 확인했다.
- 공개 Playwright 1개 흐름 통과: 모집 후보 3명과 새 합계 범위 → 출전 → 무공 선택 → 이동·공격 → 가방 → 저장 후 일시 종료 → 이어하기 → 새로고침 복원. 새 hero/hero-reactions/지역 animation-rebuild-v2 경로 로딩 확인. JavaScript 예외와 실패 에셋 응답 없음.
- 공개 모집·전투 캡처를 육안으로 확인했다. 테스트는 독립 Playwright 저장 컨텍스트만 사용했다.

증거: `docs/verification/daytona-20261003-animation-growth-v3/public-files.json`, `public/result.json`, `public/recruitment.png`, `public/combat.png`, `public/bag.png`.

애니메이션 원화의 남은 한계는 연결 문서에 기록했다. 배포가 모든 방향을 독립 프레임으로 다시 그렸다는 의미는 아니다.
