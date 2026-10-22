# 개인 Linux 서버에서 실행

React·Phaser4·Vite 게임을 Nginx로 제공하고 같은 주소의 `/api/pvp/`를 Node22 비무 서버에 프록시한다. 실행 미디어는 Git에 포함하며 제작 원본은 외부 보관한다. 여정은 브라우저 IndexedDB, 비무 계정·점수·경기는 별도 SQLite 명명 볼륨이다. [친선/순위전 규칙](realtime-biwu-v1.md).

## 설치

Docker Engine·Compose 플러그인·Git을 준비한다.

```sh
git clone --branch codex/realtime-biwu-v1 https://github.com/ksh00500/mugong.git
cd mugong
cp .env.example .env
docker compose up -d --build
curl -f http://127.0.0.1:8080/healthz
curl -f http://127.0.0.1:8080/api/pvp/health
```

Docker 빌드는 manifest의 실행 에셋 크기/SHA256을 대조한다. 기본 바인드는 서버127.0.0.1:8080이다. 공개할 때는 `.env`의 `MUGONG_PUBLIC_ORIGIN=https://실제-도메인`을 정확히 설정하고 HTTPS 프록시를 앞에 둔다. 경로/마지막 슬래시를 넣지 않는다. 운영 Origin 목록에는 HTTPS만 사용해야 세션 쿠키에 Secure가 붙는다. WS 업그레이드·Origin·쿠키를 보존하며 `/api/pvp/`는 캐시하지 않는다. `.env`·주소·TLS·DB는 Git에 올리지 않는다. web/nginx와 pvp/node 컨테이너는 비루트 사용자·읽기 전용 루트·임시 /tmp를 사용한다. pvp는 외부 포트를 열지 않는다.

## 업데이트와 복귀

git status로 변경을 확인한 뒤 git pull --ff-only, docker compose build, docker compose up -d --no-build, 두 health 경로 순으로 확인한다. web과 pvp를 같은 커밋/태그로 빌드한다. 서버 교체 시 진행 중 비무는 무효이며 Elo는 변경하지 않는다. 배포 커밋과 Docker 태그를 기록한다. 미디어가 포함된 커밋은 소스와 미디어가 함께 복귀한다. 외부 분리 시기의 커밋은 당시 manifest를 보관본과 대조한다. [보관·복원](external-assets.md).

`pvp-data` 볼륨은 삭제하지 않는다. `docker compose down -v`는 계정/점수를 삭제하므로 사용하지 않는다. 백업은 pvp를 정상 종료한 뒤 `/app/data`의 SQLite 파일과 남아 있는 WAL/SHM을 함께 보관하고 재시작한다. 실행 중 DB 파일 하나만 복사하는 백업은 일관성을 보장하지 않는다. 복구도 서버를 멈춘 상태에서 같은 스키마의 검증된 백업 전체를 복원하고 소유권을 확인한다. DB에는 인증 해시가 있으므로 백업을 공개하지 않는다. 한 DB에는 서버 한 개만 연결한다. 이전 스키마를 모르는 바이너리로 되돌리기 전에 호환성을 확인한다.

주소/포트/프로토콜을 바꾸면 저장 공간도 달라진다. 실제 저장 이동은 게임 내 내보내기/가져오기를 사용하고 배포 검사로 사용자 저장을 초기화하지 않는다.

## 검사

Node22.16이상에서 npm ci, npm run check:assets, npm run typecheck, npm test, npm run build를 수행한다. Docker 실행 뒤 npx playwright install --with-deps chromium을 실행하고 MUGONG_HOSTING_URL=http://127.0.0.1:8080 MUGONG_HOSTING_NGINX=1 npm run test:hosting으로 Nginx를 검사한다. PvP 테스트는 **운영과 다른 Compose 프로젝트·볼륨/DB**에서 `MUGONG_PVP_URL=http://127.0.0.1:테스트포트 npx playwright test --config playwright.pvp.config.ts`로 실행한다. 테스트는 새 계정을 생성하므로 운영 DB에 실행하지 않는다.

이번에는 두 이미지 빌드와 Compose 구성 검사까지 통과했다. Docker 데몬 미응답으로 최종 컨테이너 실행 검증은 완료하지 못했고 집 서버 전송·TLS·공개 접속도 아직이다. [이번 검증](verification/realtime-biwu-v1/README.md), [이전 설치 안내](history/self-hosting-before-runtime-git-20261020.md).
