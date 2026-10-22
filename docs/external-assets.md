# 실행 에셋과 제작 원본 보관

2026-10-20부터 public 미디어1,018개(이미지1,011장·소리4개·폰트3개)를 일반 Git에 포함한다. 이제 이 브랜치를 복제하면 실행용 묶음을 별도 복원하지 않아도 게임을 빌드할 수 있다. 기존 LFS 예산을 사용하거나 유료 설정을 바꾸지 않는다.

제작 원본·참고 자료1,818개는 assets/·docs/source/·docs/references/에 보존하고 외부 authoring 묶음으로 관리한다. 전체 asset-manifest.json은 실행/제작2,836파일의 경로·크기·SHA256을 유지한다. [분류와 삭제 기준](asset-management/README.md).

## 보관본

- runtime: mugong-runtime-d05a97c29b4c392f.tar.gz — 1,018파일, 1,176,113,644바이트. Git 복제와 별도로 로컬 복구용 보존.
- authoring: mugong-authoring-df51005ee5a3d539.tar.gz — 1,818파일, 2,641,160,316바이트. 게임 호스팅에는 불필요하지만 재생성·출력·제작 이력에는 필요.
- [runtime SHA](asset-bundles/runtime.json) · [authoring SHA](asset-bundles/authoring.json).

보관본은 현재 로컬 .asset-bundles에 있다. 개인 서버 전송이나 외부 백업 완료로 해석하지 않는다. 원본을 수정하면 목록을 갱신하고 authoring 묶음을 다시 만든다. Git에서 이전 소스/메타데이터를 복원할 때 해당 버전 파일 SHA를 확인한다.

과거 압축본과 최신 보관본의 내부 파일이 모두 같은 경우에만 이전 압축본을 정리할 수 있다. [전체 대조 결과](asset-management/archive-audit.json)와 [복원 검사](asset-management/restore-verification.json)를 사용한다. 과거 압축본 파일명이 등장하는 이력 문서는 당시 상태이며 현재 복원 안내는 이 문서와 삭제 기록을 따른다. 같은 내용을 복원할 수 있다는 뜻이며 이전 tar.gz의 압축 바이트 자체가 동일하다는 뜻은 아니다.

[이전 외부 분리 방침](history/external-assets-before-runtime-git-20261020.md)은 이력으로 보존한다.
