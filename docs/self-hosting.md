# 개인 Linux 서버에서 실행

React·Phaser4·Vite 정적 게임을 Nginx로 제공한다. 이 브랜치는 public 미디어를 포함하므로 별도 실행 에셋 다운로드나 Git LFS가 필요 없다. 제작 원본은 외부 보관한다. 서버 계정/DB·온라인 저장은 없고 각 브라우저의 IndexedDB를 사용한다.

## 설치

Docker Engine·Compose 플러그인·Git을 준비한다.

```sh
git clone --branch codex/asset-inventory-v1 https://github.com/ksh00500/mugong.git
cd mugong
cp .env.example .env
docker compose up -d --build
curl -f http://127.0.0.1:8080/healthz
```

Docker 빌드는 asset-manifest.json의 public1,018파일 크기/SHA256을 대조한다. 기본 바인드는 서버127.0.0.1:8080이며 HTTPS 프록시를 앞에 둔다. .env·주소·TLS는 서버에서 설정하고 Git에 올리지 않는다. 최종 컨테이너는 일반 nginx 사용자·읽기 전용 루트·임시 /tmp를 사용한다.

## 업데이트와 복귀

git status로 변경을 확인한 뒤 git pull --ff-only, docker compose build, docker compose up -d --no-build, healthz 순으로 진행한다. 배포 커밋과 Docker 태그를 기록한다. 미디어가 포함된 이 브랜치의 커밋은 소스와 미디어가 함께 복귀한다. 외부 분리 시기의 과거 커밋은 당시 manifest를 최신 보관본과 대조해 복원한다. [보관·압축본 대체 안내](external-assets.md).

주소/포트/프로토콜을 바꾸면 저장 공간도 달라진다. 실제 저장 이동은 게임 내 내보내기/가져오기를 사용하고 배포 검사로 사용자 저장을 초기화하지 않는다.

## 검사

Node22.12이상에서 npm ci, npm run check:assets, npm run typecheck, npm test, npm run build를 수행한다. Docker 실행 뒤 npx playwright install --with-deps chromium을 실행하고 MUGONG_HOSTING_URL=http://127.0.0.1:8080 MUGONG_HOSTING_NGINX=1 npm run test:hosting으로 Nginx를 검사한다. 기본 CI와 수동 Docker 검사는 Git에 포함된 미디어를 사용한다.

이번 Git 정리는 개인 서버 전송/배포·TLS·공개 접속 완료를 뜻하지 않는다. [이전 설치 안내](history/self-hosting-before-runtime-git-20261020.md)는 당시 이력이다.
