# 설산 전체 행동 원화 / 재현

선택 원본은 `generated/`의 18시트이며, `baixue-back-rejected.png`는 손이 등 앞으로 노출된 오류로 탈락시킨 원본이다. 원본·참고 PNG는 Git에 넣지 않고 개인 제작용 에셋 묶음에 보관한다. 텍스트 프롬프트·선택 기록·발점·SHA256은 소스 저장소에 남는다.

- `generation-jobs.json`: 세 보스 × 다섯 시점의 두 행동씩, 원래 3열×4행 계획과 원본 경로.
- 각 `*.prompt.txt`: 최초 정확한 프롬프트. `generated/*.used-prompt.txt`: 뒤사선/옆/후면 등 실제 호출에 덧붙인 제약까지 포함한 프롬프트. 정면 세 장은 최초 프롬프트 그대로다.
- `contact-jobs.json`, `mokjin-sweep.prompt.txt`, `baixue-left.prompt.txt`, `baixue-stomp.prompt.txt`: 다섯 시점 접촉과 마지막 READY 보정용 그림.
- `references/`: 기존 기본 READY와 넓은 패딩을 사용한 배치 참고. 반복된 대기를 최종 동작으로 사용한 것은 아니다.
- `ground-corrections.json`: 실제 원본 픽셀의 고정 발점. `export-review.json`: 원본 SHA256·경계·한 시트 공통 보정계수·행동별 여섯 단계 연결표.

모든 생성은 기본 ImageGen 도구, 투명 배경 옵션과 해당 참조 경로를 사용했다. 한설 정면만 실제 4×3 배열이며 다른 주요 시트는 3×4, 보강은 2×3이다. 백설노괴 후면은 `baixue-back-repair.used-prompt.txt`로 다시 생성했다. 낮은 알파의 숨은 RGB가 이미지 뷰어에서 색 줄무늬로 표시될 수 있으므로 실제 알파 합성/게임 렌더로 검토한다. 런타임 합성 캡처에서 그 줄무늬는 표시되지 않았다.

복원 후 `MUGONG_SHARP_PATH`를 설치된 Sharp 진입점으로 설정하고 실행한다.

```powershell
node --experimental-strip-types scripts/export-snow-special-complete-v2.mjs
node --experimental-strip-types scripts/snow-complete-review.mjs
node scripts/snow-complete-boards.mjs
node scripts/verify-snow-complete-export.mjs
```

생성과 내보내기를 구분한다. Sharp는 연결된 그림 분리·같은 계수로 비율 유지 리사이즈·패딩 포장·눈금 비교판 제작에만 사용했으며 관절/무기 의미 수정은 생성 도구로 했다. READY는 기본 그림을 직접 재사용해 시트 전환 크기 차이를 막는다. 런타임 선택·테스트는 [설산 적용 문서](../../snow-special-complete-v2.md)를 따른다.
