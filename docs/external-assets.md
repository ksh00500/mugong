# 외부 에셋 보관·복원

GitHub LFS 예산 초과 이후 사용자가 **소스는 GitHub, 에셋은 개인 서버 별도 보관**을 선택했다. 원본 파일을 삭제하거나 리사이즈하지 않는다. 서버 주소·비밀번호·임시 SSH 명령은 저장소/문서에 기록하지 않는다.

## 묶음

| 구분 | 파일 | 용도 |
| --- | --- | --- |
| 실행용 | `mugong-runtime-c5ec33e56608e7ce.tar.gz` | public 아래 그림·소리·폰트863개, 게임 실행/호스팅에 필요 |
| 제작용 | `mugong-authoring-db6da21c5778d77d.tar.gz` | 원본·교정/참고 미디어1,551개, 원화 제작/복원용 |

최신 SHA256·압축 크기는 `docs/asset-bundles/runtime.json`, `authoring.json`에 기록한다. 압축본과 `.sha256` 사이드카는 로컬 `.asset-bundles/`에 생성하며 개인 서버에 복사해 보관한다. GitHub에는 올리지 않는다. 실제 개인 서버 전송 여부는 작업 기록에서 별도로 확인한다.

`asset-manifest.json`은 전체 파일의 상대 경로·바이트 수·SHA256을 관리한다. 코드 커밋과 manifest를 함께 저장한다. 묶음 ID는 파일 경로·바이트 수·SHA256 목록에서 계산하므로 소스 수정만으로 에셋 버전이 바뀌지 않는다. 묶음은 바이너리만 담고 HTML/JSON/라이선스·프롬프트 등 텍스트는 Git에서 받는다.

## 복원

신뢰하는 보관소에서 받은 압축본의 SHA256을 먼저 확인하고 저장소 루트에 푼다.

```sh
(cd /srv/mugong-assets && sha256sum -c mugong-runtime-*.tar.gz.sha256)
tar -xzf /srv/mugong-assets/mugong-runtime-c5ec33e56608e7ce.tar.gz -C .
npm run check:assets
```

제작 자료도 필요하면 `authoring` 압축본을 같은 방식으로 확인/해제하고 `node scripts/asset-bundles.mjs verify all`로 확인한다. 라이선스는 Git의 `public/fonts/*-OFL.txt`, 참고 문서와 함께 보존한다.

## 새 에셋을 추가·교체할 때

```sh
node scripts/asset-bundles.mjs refresh
node scripts/asset-bundles.mjs verify all
node scripts/asset-bundles.mjs pack runtime
node scripts/asset-bundles.mjs pack authoring
```

`refresh`는 public·assets·docs/source·docs/references의 미디어만 대상으로 한다. 검증 캡처나 실제 사용자 저장은 포함하지 않는다. 새로 생성된 `.tar.gz.json`을 각각 `docs/asset-bundles/runtime.json`, `authoring.json`에 복사하고 문서의 파일명을 갱신한다. 서버에 새 묶음을 올린 뒤 코드/manifest를 커밋한다. 이전 묶음도 롤백을 위해 보관한다.

소스 저장소 검사: `node scripts/audit-github-snapshot.mjs`. 바이너리나 LFS 필터 파일이 추적되면 실패한다. 기본 단위 검사는 실제 파일 존재를 확인하며 `test:source`는 CI에서 명시적으로 목록만 대조한다. 게임 실행 전에는 반드시 실제 SHA256 검사를 수행한다.
