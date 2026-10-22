# 세 지역 교정 원본·선택 규칙

2026-10-18. 기존 desert/hyeolma/zhuge-special-v1 시안과 제작 이력은 보존한다. `generated/`의 PNG는 내장 imagegen 결과의 로컬 복사본이며 원본 생성 경로의 파일도 삭제하지 않았다. PNG는 Git 대신 제작용 비공개 에셋 묶음에 포함하고 프롬프트·메타데이터·SHA 목록은 소스에 둔다.

선택:

- 묵연·제갈현 front-right-v2: 각 12자세 모두 선택.
- 진괄 front-right-v2: 12자세 중 걷기 4번째(잘린 창끝)와 공격 준비 2번째(머리 위 들기)는 제외. `jingwal-two-poses.png`의 걷기·수평 찌르기 준비 두 자세로 대체. 합계 12자세.
- `naya-second-contact-rejected-v1.png`: 후면이 오른손 공격이어서 미채택. v2의 다섯 시점만 두 번째 접촉으로 사용하고 여섯 번째 READY는 시트 공통 크기 보정 기준으로만 사용한다.
- 이미지 편집으로 생긴 저알파 외곽 배경은 기존 연결 성분 추출 규칙(alpha>=128)에 포함하지 않는다. 선택된 그림/무기 연결은 확대 비교하고 출력 투명 여백을 픽셀 검사했다. 의미 있는 무기 부분을 지우는 수동 페인팅은 하지 않았다.

`zhuge-basic-before.json`은 교정 전 기본 메타데이터로 재실행 시 보정 기준이 달라지지 않게 한다. `scale-audit.json`은 기존 기본 READY와 특별 READY 열 개의 실측 및 캐릭터 공통 계수다. 이것만으로 머리 치수와 관절이 보증되는 것은 아니다. `ground-corrections.json`은 확대 비교 후 확정한 발점 예외다. 아사르/아르칸의 칼끝을 발로 잡는 오류를 교정한다.

재현은 일치하는 제작/런타임 에셋을 복원하고 Sharp 경로(`MUGONG_SHARP_PATH`)를 지정한 뒤 실행한다.

```sh
node --experimental-strip-types scripts/install-three-special-v2.mjs
node --experimental-strip-types scripts/three-special-review.mjs
node scripts/three-special-boards.mjs
node scripts/verify-three-special-export.mjs
```

`prepare-three-special-v2.mjs`는 최초 감사/생성 기준판을 만드는 도구다. 현재 기본 원화 교정 후 다시 실행해 과거 감사 값을 덮지 않는다. `three-special-ground-review.mjs`는 좌표 눈금이 붙은 발점 검사판을 만든다. 이 검사판과 전투 캡처는 검증 폴더에 보관하고 제작 에셋 묶음과 구분한다.

`export-review.json`은 적용 계수·선택 원본·발점·논리 프레임 수를 기록한다. 명목 소스 칸을 넘은 독립 무기는 연결 성분 전체를 회수하되 원본 캔버스에서 잘린 경우 거부한다. 출력은 무기까지 감싼 사각형에 최소32픽셀 여백을 추가한다. 프레임당 화면 배율 보정이나 실시간 손/발 자동 추정은 없다.
