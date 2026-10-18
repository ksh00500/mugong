# 제갈 7종 원화와 생성 기록

기본 제공 **image_gen**으로 생성·보정했다. API/CLI 이미지 생성은 사용하지 않았다. 적용 원본 PNG와 프롬프트를 이 폴더에 보관하고, lossless WebP 전달 시트는 `public/art/zhuge-family-v1`에 저장한다.

한 인물의 앞 대각선 기준 원화에 기존 인물의 역할·복장 자료와 소림 원화의 표현 방식을 참고했다. 이후 같은 기준 원화를 참조해 정면·측면·뒤 대각선·후면을 만들었다. 단일 무기, 손의 연결, 지지발, 같은 카메라 거리·몸 비율, 실제 투명 배경과 효과 없는 외곽을 요구했다. 준비·타격·회수를 도구별로 구분했다.

## 적용본 선택

`generation-jobs.json`은 35개 묶음과 0부터 시작하는 자세 번호별 선택본을 지정한다. `*.prompt.txt`는 기본 규칙, `*.generation.prompt.txt`는 추가 방향을 실제 생성한 프롬프트, `*repair*.prompt.txt` 등은 보정 프롬프트다. `provenance.json`은 기본 도구의 출력 경로와 참조·선택 정보를 기록한다. 원본·보정 전 그림은 덮어 지우지 않고 `attempts`에 보관했다.

부분 보정이 다른 칸에 새 잘림을 만든 경우, 문제없는 이전 칸을 유지했다. 다음은 명시적으로 다른 파일에서 가져오는 적용 자세다.

- engineer-right 8: `attempts/engineer-right-before-repair.png`
- jingwal-right 3: `attempts/jingwal-right-before-repair.png`
- crossbow-back 9·10: `crossbow-back-padding-repair.png`

따라서 기본 PNG의 모든 칸이 최종 적용본이라는 뜻은 아니다. 최종 manifest의 각 프레임 `source`와 `sourceBounds`가 실제 출처다. 보정본을 자동으로 전체 승인하지 않는다.

진괄의 공격 자세 6~11은 다섯 시점 모두 `jingwal-attack-v2-*` 선택본으로 교체했다. 원본의 3×3 격자와 자세 번호는 `poseSourceCells`에 명시한다. 측면·뒤 대각선·후면의 추가 보정본은 대상 칸만 선택하며 다른 칸은 해당 방향의 기본 공격 원화를 유지한다. [변경 이유와 생성 규칙](../../jingwal-attack-v2.md), [도구 출력 경로](jingwal-attack-v2-provenance.json)를 참고한다. 이전 적용 목록과 manifest는 `attempts/jingwal-attack-v2-before`에 보존한다.

## 내보내기

`scripts/export-shaolin-family.mjs zhuge`는 선택한 그림의 픽셀을 1:1로 복사하고 공통 캔버스·최소 32픽셀 여백을 만든다. 원본 그림을 축소·변형하지 않는다. `.ts` 유틸리티를 읽기 위해 Node 22에서는 `--experimental-strip-types`를 사용하고, `MUGONG_SHARP_PATH`로 Sharp 설치 경로를 지정할 수 있다. 런타임은 프레임 manifest만 읽는다.

`source-review.json`은 **선택한** 420장의 경계 잘림과 공유 그림 검사를 기록한다. `export-review.json`은 출처 SHA-256, 원본 RGBA 보존 검사와 전달 여백을 기록한다. `ground-anchors.json`은 지면 좌표이며 [수동 보정 기록](ground-anchor-review.md)을 함께 둔다. 이 자동 검사는 인체 비율·관절의 완전성을 인증하지 않는다.
