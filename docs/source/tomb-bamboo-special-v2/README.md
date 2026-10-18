# 고묘·죽림 특별 원화 입력·선택

2026-10-18, 기본40시트(8캐릭터×5원화 시점)의12후보 자세와 보강/교정15시트를 생성했다. 총55파일을 `generated/`에 보존한다. 최종 선택은 기본40시트와 보강13시트의 일부 셀이다. 원본 이미지와 가이드는 미디어 제작 묶음에, 프롬프트·선택·SHA·내보내기 스크립트는 Git에 보관한다.

- `generation-jobs.json`: 실제 캐릭터ID·bossId·두 행동·시간·시점·입력 원본과 간격 가이드.
- `generated/*.prompt.txt`: 최초12자세 요청. `*.used-prompt.txt`가 있으면 해당 실제 호출에 덧붙인 제한까지 포함한다. `*-v2`, `*-release`, `*-stance` 프롬프트는 부분 교정/보강의 정확한 입력이다.
- `references/*-layout.png`:1920×2560의3×4 간격 가이드. 완성 원화가 아니다. 기본 원본은 기존 `tomb-special-v1/references/`, `bamboo-special-v1/references/`의 한 캐릭터 READY다.
- `selection.json`: 채택/보강 셀, 실제2×1 또는3×4배열, 공통 제작 보정, 접촉 단계, 명시한 발 좌표. 긴 칼/봉 끝을 발점으로 채택하지 않는다.
- `export-review.json`: 원본 SHA·사각형·발점·시트 공통 계수·보강 경로. 선택 프레임의 원본 정보는 런타임 메타데이터에도 기록한다.
- `source-audit.json`: 기본40시트와 보강13시트의 실제 독립 그림·선택 셀 잘림 검사. 사용하지 않는 후보 셀은 성공으로 위장하지 않고 기록한다.
- `review-issues.json`: 생성 오류와 선택/재생성 조치.

초기 청비 후면은 오른손 암기를 던지고 왼손 단도를 그대로 들고 있어 탈락했다. 두 자세 보강을 재생성해 왼손 단도→빈손과 오른손 암기 유지를 분리했다. 순수 후면 첫 보강도 손이 반대라 좌우 교정을 다시 요청했다. 석문·월령·연청·송월 후사선, 월령·연청 정후면은 소품 소유가 바뀌거나 여분 손이 생긴 후보를 전용 두 자세로 교체했다. 곽기 후면 수리 손은 몸 앞에서 가리도록 다시 그렸다. 원본 파일은 보존했다.

재현 순서(저장소 루트):

```powershell
$env:MUGONG_SHARP_PATH='<sharp의 절대 경로>'
node --experimental-strip-types scripts/inspect-tomb-bamboo-source.mjs
node --experimental-strip-types scripts/export-tomb-bamboo-special-v2.mjs
node scripts/verify-tomb-bamboo-export.mjs
node scripts/tomb-bamboo-boards.mjs
node --experimental-strip-types scripts/tomb-bamboo-review.mjs
node scripts/tomb-bamboo-coverage.mjs
```

`prepare-tomb-bamboo-special-v2.mjs`는 최초 프롬프트/간격 가이드 준비용이다. 이미 선택된 원본을 새로 생성하거나 덮어쓰지 않는다. `adjust-tomb-bamboo-boots.mjs`는 초기0.40배율 비교판의 제안을 수정한 일회성 보조 도구이며 중복 적용을 차단한다. 이후 재현은 저장된 `selection.json`을 직접 사용한다. 연청의 추가20발점도 이 파일에 고정했다. 내보내기는 의미 있는 그림을 다시 그리지 않고 원본 실루엣 추출·같은 시트 계수·투명 패딩·명시 발점으로 포장한다.

5시점×2행동×6단계×8캐릭터=480논리 프레임이며,160개는 기본 READY 재사용이다.315포장 셀과299선택 원본 자세는 다른 수다. 자세별 바운딩박스에 맞춘 런타임 확대/축소는 없다. 공개 배포·서버 전송은 이 제작 기록의 범위가 아니다.
