# 개인 Linux 서버에서 실행

현재 게임은 React·Phaser4·Vite 정적 브라우저 앱이며 Nginx로 제공한다. 소스는 GitHub, 미디어는 개인 서버에 보관한다. Git LFS는 필요 없다. 서버 계정/DB는 없고 저장은 브라우저 IndexedDB에 있다.

## 설치

Docker Engine·Compose 플러그인·Git을 준비하고, 전달받은 실행용 에셋과 SHA256 파일을 `/srv/mugong-assets` 같은 비공개 폴더에 보관한다. 제작용 묶음은 게임 호스팅에 필요 없다.

```sh
git clone --branch codex/tomb-bamboo-complete https://github.com/ksh00500/mugong.git
cd mugong
(cd /srv/mugong-assets && sha256sum -c mugong-runtime-*.tar.gz.sha256)
tar -xzf /srv/mugong-assets/mugong-runtime-03463e6029340b39.tar.gz -C .
cp .env.example .env
docker compose up -d --build
curl -f http://127.0.0.1:8080/healthz
docker compose ps
```

파일명·바이트 수·파일별 SHA256은 [에셋 안내](external-assets.md) 및 `asset-manifest.json`을 기준으로 한다. 압축본은 신뢰하는 개인 보관소에서 받은 뒤 SHA256을 먼저 확인한다. Docker 빌드 안에서도993개 런타임 파일의 바이트/SHA256을 확인하므로 누락되거나 다른 버전이면 실패한다.

기본 바인드는 서버의 `127.0.0.1:8080`이다. HTTPS 역방향 프록시의 upstream으로 연결한다. LAN 직접 접속이 필요하면 `.env`의 `MUGONG_BIND`를 서버 LAN IP로 바꾼다. 도메인·TLS 인증서는 서버 환경에서 설정한다. `.env`는 Git에 올리지 않는다.

컨테이너는 nginx 일반 사용자·읽기 전용 루트·임시 `/tmp`로 실행한다. 최종 이미지는 빌드 결과만 포함하며 원화 제작 자료·사용자 저장·자격 정보는 넣지 않는다.

## 업데이트·복귀

```sh
git status --short
git pull --ff-only
# asset-manifest가 바뀌면 그 버전에 대응하는 runtime 묶음을 먼저 복원
docker compose build
docker compose up -d --no-build
curl -f http://127.0.0.1:8080/healthz
```

배포 전 커밋 ID와 실행용 묶음 ID를 함께 기록한다. 이전 버전으로 돌아갈 때는 이전 Git 커밋과 그때의 에셋 묶음을 조합한다. `MUGONG_TAG`를 커밋 ID로 지정하면 Docker 이미지도 구분할 수 있다. 이미지를 먼저 빌드하므로 실패하면 기존 컨테이너는 계속 실행되며 단일 컨테이너 교체의 무중단은 보장하지 않는다.

서버 주소/포트/프로토콜이 바뀌면 브라우저 저장 공간도 달라진다. 실제 저장을 옮길 때는 게임 내 내보내기/가져오기를 사용한다. 배포 테스트로 사용자 저장을 초기화하지 않는다.

## 검증

Node.js22.12이상에서 다음을 실행한다.

```sh
npm ci
npm run check:assets
npm run typecheck
npm test
```

Docker 컨테이너 실행 후에는 다음을 사용한다.

```sh
npx playwright install --with-deps chromium
MUGONG_HOSTING_URL=http://127.0.0.1:8080 MUGONG_HOSTING_NGINX=1 npm run test:hosting
```

소스만 있는 GitHub CI는 `npm run test:source`로 에셋 참조를 목록과 대조하고 JS/CSS를 컴파일한다. 실제 에셋·게임 실행을 확인한 검사는 아니다. GitHub에서 전체 검사를 수동 실행하려면 `MUGONG_RUNTIME_ASSET_URL` repository secret에 실행용 묶음 다운로드 주소를 설정한 뒤 workflow_dispatch의 `verify_runtime`을 켠다. 파일 SHA는 버전 관리되는 `docs/asset-bundles/runtime.json`으로 검사한다. 해당 secret과 서버 업로드는 이번 소스 정리에서 자동으로 설정하지 않는다.

해시 JS/CSS는 장기 캐시, 재사용되는 art/audio/font 파일은 재검증한다. 없는 파일은404로 응답한다. 실행 기록은 [10월18일 Docker/Nginx 검증](verification/github-self-hosting-20261018/README.md)과 후속 소스/에셋 분리 기록을 따른다.
