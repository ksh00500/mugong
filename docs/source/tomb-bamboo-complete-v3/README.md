# 고묘·죽림 추가23행동 제작 자료

기존 주요16행동은 `tomb-bamboo-special-v2`에 그대로 보존한다. 이번 추가870논리 프레임은 새125물리 자세와 기본/이전 특별 준비·회수 그림의 조합이다. `src/game/tomb-bamboo-complete-frames.json`과 `public/art/tomb-bamboo-complete-v3/frames.json`이 새23행동을 담고 게임 등록/검토 화면에서 기존16개와 합친다.

- `preflight.json`: 실제 boss kit에서 빠진 고묘11·죽림12행동과 타격 시간.
- `generation-jobs.json`: 첫 8시트/5시점 다중 동작 입력. 실제 생성 배열을 읽고 선택한다.
- `contact-jobs.json`: 찌르기·손 소유·준비 자세를 위한 13개 집중 보강 입력.
- `generated/*.prompt.txt`: 실제 사용한 프롬프트. 원본/미채택 PNG는 외부 제작용 에셋 묶음에 보관한다.
- `selection.json`: 19선택 원본의 셀·명시 발점·미채택 이유·곽기 시트 공통 교정 높이. 적호 돌진 v2와 청비 역횡격 v2를 사용한다.
- `export-review.json`: 125선택 물리 자세의 입력 SHA·원본 셀·발점·공통 계수와 29접촉의 6단계 조합.
- `boards/`: 8인물의 READY/모든 새 자세를 같은 배율로 접지 비교한 로컬 보관 그림.

첫 8본+집중13본+재교정2본의 23PNG를 이 폴더의 `generated/`에 보존했다. 6본의 일부 열60셀과 집중/교정13본65셀을 선택했다. 전체 시트가 승인됐다는 뜻은 아니다. 적호 최초 잘린 곡괭이, 청비 최초/역횡격v1 손바뀜, 곽기 초기 든 렌치의 여분 팔은 미채택이다. 배경 진단용 별도 생성 시도는 선택하지 않았고 원본 도구 출력에 보존했다. 실제 RGBA 검사에서 원본 배경 알파0임을 확인했으므로 후처리 색상 키 제거를 하지 않았다.

한 원본 시트 전체에 동일한 가로/세로 제작 계수를 적용한다. READY 높이 또는 명시한 곽기 정수리–장화 높이로 교정하며 프레임별 크기 맞춤은 없다. 따라서 보정 출력이 원본 RGBA 1:1이라는 주장은 하지 않는다. 각 선택 자세의 발점을 비교판에서 검토하고 렌치 지면강타5점을 무기 끝에서 장화로 교정했다. 선택 영역에 실제32px 투명 여백을 새로 확보했고 서로 연결된 인물/캔버스 잘림은 export에서 거부한다.

재생성: `prepare-tomb-bamboo-complete-v3.mjs` → `prepare-tomb-bamboo-keyposes-v3.mjs` → `prepare-tomb-bamboo-contact-fixes-v3.mjs` → 내장 imagegen → selection → `export-tomb-bamboo-complete-v3.mjs` → `tomb-bamboo-complete-review.mjs`. 내보내기는 Node22의 `--experimental-strip-types`와 `MUGONG_SHARP_PATH` 또는 로컬 sharp 설치가 필요하다. 기존 파일을 검토 없이 덮어쓰지 않는다.
