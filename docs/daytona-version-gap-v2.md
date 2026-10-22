# Daytona 실행 버전 차이 확인

2026-10-02. 사용자가 설산의 활/폭탄 및 죽림의 창/함정 그림 불일치와 밸런스 미반영을 보고했고, 플레이 주소가 Daytona라고 확인했다.

공개 주소 `https://8080-aeae46c6-f6b0-455f-878b-f2381900a712.proxy.daytona.work/`를 읽기 전용 HTTP로 확인했다. HTTP 200이며 진입 코드는 `main-DqrbSjbd.js`다. 이 코드에는 `enemy-role-directions-v2`, `zone-art-v2`, `hostile-projectiles-v2` 경로가 모두 없다. 최신 로컬 빌드의 진입 코드는 `main-ApMssI4L.js`다. 따라서 서버 배포와 로컬 구현이 다른 상태임은 확인됐으며, 브라우저 캐시만의 문제로 단정하지 않는다.

최신 구현: [적 그림과 공격 연결](hostile-presentation-v2.md), [장비 정밀도와 보스 난이도](balance-v2.md). 최신 렌더링은 저장된 적 역할을 사용하여 그림을 선택하므로 기존 판 종료가 그림 변경의 전제는 아니다. 저장된 기존 적 HP는 보존하고 새 소환부터 강화 HP를 적용한다. 설산의 궁수 역할은 정상적으로 활/화살을 쓰며 얼음 투척수와 구분한다.

이번 재검증: TypeScript/Vite 빌드 성공, 밸런스 및 적 공격 연결 단위 검사 78개 통과, 독립 브라우저 10지역 그림/5방향/공격 상태 검사 10개 통과. 사용자 저장은 변경하지 않았다.

최신 `dist` 전체 배포 압축을 `.cache/releases/mugong-20261002-hostile-balance-v2.tar.gz`에 준비했다. 217,934,288 bytes, SHA256 `f91452d9b6d5b8201cc07f567e0716f4d8e557f7207e9884c2f5f3d9d90bb167`. 코드와 공개 그림/폰트/소리만 포함하며 저장 데이터와 인증정보는 포함하지 않는다.

## 실제 배포

사용자가 새 SSH 접속을 제공한 뒤 `/srv/mugong/releases/20261002-hostile-balance-v2`에 배포했다. 접속으로 확인한 이전 릴리스는 `20261002-combat-presentation-v1`이었다. 이전 릴리스 경로와 Nginx 설정을 `/srv/mugong/backups/20261002-hostile-balance-v2`에 보관했다. 압축 SHA256 및 264개 파일 SHA256을 확인하고 `current` 링크를 전환했다. 최초 명세 검사는 Windows CRLF로 실패하여 링크 전환 전에 LF로 수정하고 전체 검사를 통과했다. Nginx 설정 검사와 최종 HTTP 200을 확인했다.

공개 index, main, mount 및 신규 그림 3개의 SHA256이 로컬 빌드와 일치했다. 증거: `docs/verification/daytona-20261002-hostile-balance-v2/public-files.json`. 공개 출전·이동·공격·가방·저장 복원 브라우저 검사 통과. 개발용 지역 검사에는 Vite 원본 import가 있어 배포 서버에서 실행할 수 없었으며, 원본 import 없는 `tests/e2e/daytona-hostile-v2.spec.ts`를 별도로 추가했다. 검사 데이터는 독립 브라우저 컨텍스트에만 기록한다.

추가한 공개 지역 검사 2개도 통과했다. 설산의 얼음 투척수/얼음 폭탄과 죽림의 함정꾼/쇠가시 폭탄, 윤곽선 없는 장판을 실제 캡처에서 확인했다. 최초 테스트 데이터의 지역 경로가 1개여서 저장 유효성 검사에 거부되는 문제는 규칙에 맞는 서로 다른 4지역으로 수정했다. 게임 규칙이나 사용자 저장을 변경하지 않았다. 공개 검증 총 3개 통과, JavaScript 예외 및 실패한 에셋 요청 없음. 캡처와 JSON은 `docs/verification/daytona-20261002-hostile-balance-v2/public/`에 있다.
