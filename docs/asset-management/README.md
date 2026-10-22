# 이미지 보관과 검증 후 정리

후속 실제 쉼터 원화: 마당/NPC 전신4장을 추가해 현재 public 미디어는1,026개다. [첫 쉼터](../waystation-world-v1.md). 기존1,018개 분류 감사·제작 원본·정비 카드 원화는 보존하며 이번 삭제0개다.

2026-10-20 후속: [정비 디자인](../prep-design-v1.md)의 새 원화 네 장을 일반 Git과 실행 manifest에 추가해 현재 public 미디어는1,022개다. 아래1,018개 분류/보관 감사는 추가 전 스냅샷이다. 기존1,818개 외부 제작 원본과 미확인 보존 결정은 유지하며 이번 추가에서 삭제는 없다.

2026-10-20 사용자 요청으로 **public의 실행·호환·검토용 미디어를 일반 Git에 포함**한다. 이전의 미디어 전체 외부 보관 방침을 이 범위에서 변경한다. 파일 경로·픽셀·게임 규칙은 유지한다. Git LFS나 유료 예산을 변경하지 않는다.

- `public/`: 게임·구형 저장 대응·전체 지역/외형·비교 페이지를 포함한 1,018개 미디어. 이미지 외 소리·폰트도 함께 보관해 복제 후 실행할 수 있게 한다.
- `assets/`, `docs/source/`, `docs/references/`: 1,818개 제작 원본·선택/탈락본·참고 자료는 보존하며 외부 제작 묶음과 전체 SHA 목록으로 관리한다. Git에 포함한 게임 텍스처와 구분한다.
- [전체 목록](inventory.json)은 현재 선언된 실행 경로, 호환용, 소스 참조, 비교/재출력, 미확인 보존으로 분류한다. 정적 참조와 동적 외형·지역·음성 경로를 함께 조사한다. 분류는 실제 모든 플레이 상황의 관측이나 미래 불필요함의 증명이 아니다.

## 삭제 기준

삭제 전에 Git 원격 백업을 확인한다. 파일명·날짜·버전 번호·단순 미참조만으로 삭제하지 않는다. 현재 실행, 동적 경로, 구형 저장/대체 동작, 테스트/비교 페이지, 원본 재출력, 계획된 사용과 과거 버전 복원을 각각 확인한다. 불명확하면 보존한다.

압축본은 목록만 비교하지 않고 **모든 내부 파일의 바이트 수와 SHA256**을 현재 목록·남길 압축본과 대조한다. 고유하거나 다른 바이트를 가진 과거 파일, 링크/안전하지 않은 경로, 검증 실패가 있으면 삭제 후보에서 제외한다. 최신 보관본의 압축 SHA·파일 수·내용 전체와 실제 복원본도 확인한다. 실행 중인 서버의 출력 폴더는 삭제하지 않는다.

이번 이미지 삭제 승인은 0개다. 교정 전 원화도 전후 비교와 결정적인 재출력 입력이므로 보존한다. 바이트가 같은 파일도 경로가 필요한 경우 유지한다. 내부 파일 전체가 최신 보관본에 포함된 이전 압축본11개/18,431,739,045바이트는 실제 복원·Git 복제·브라우저 검사 후 삭제했다. [삭제 기록](cleanup-result.json) · [검증](../verification/asset-inventory-v1/README.md).

```sh
node scripts/audit-asset-retention.mjs
node scripts/audit-github-snapshot.mjs
npm run check:assets
python scripts/audit-asset-archives.py
```

GitHub 파일 제한과 push 제한은 [공식 대용량 파일 안내](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github), [저장소 제한](https://docs.github.com/en/repositories/creating-and-managing-repositories/repository-limits)을 확인했다. 이번 public 파일은 각각 약3MB 이하이며 한 번의 미디어 추가는 약1.1GB다. 저장소 복제 비용이 커지므로 무의미한 생성본 누적은 피하고 실제 필요 여부를 먼저 분류한다.
