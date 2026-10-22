# 집 Linux PC · Docker · Cloudflare Tunnel

사용자 확정 환경: 개인 Linux PC에서 Docker로 실행하고 Cloudflare Tunnel로 공개한다. `compose.cloudflare.yaml`은 web과 tunnel 사이의 Docker 내부 통신만 사용한다. 공유기 포트 포워딩은 이 구성에 필요하지 않다. 원격 관리형 Tunnel과 `--token-file`은 [Cloudflare 시작 안내](https://developers.cloudflare.com/tunnel/get-started/)와 [실행 매개변수](https://developers.cloudflare.com/tunnel/reference/run-parameters/#token-file)를 기준으로 했다.

## 서버에서 최초 실행

Docker Engine과 `docker compose`가 있는 Linux에서 저장소를 복제한다. 토큰은 이 서버의 파일에만 두며 Git이나 이 대화에 붙여 넣지 않아도 된다.

```bash
git clone https://github.com/ksh00500/mugong.git
cd mugong
# 배포할 검증 커밋/브랜치를 선택한 후:
mkdir -p .secrets
chmod 700 .secrets
read -r -s -p 'Cloudflare Tunnel token: ' token; echo
printf '%s' "$token" > .secrets/cloudflared-token
unset token
chmod 644 .secrets/cloudflared-token
MUGONG_TAG="$(git rev-parse --short HEAD)" bash deploy/home-server.sh up
```

Cloudflare에서 Tunnel을 만들고 공개 애플리케이션 경로의 원하는 호스트 이름을 등록한다. **Service URL은 `http://web:8080`** 이다. tunnel 컨테이너 안의 localhost는 web 컨테이너를 가리키지 않는다. Tunnel의 Healthy 상태와 공개 주소 `/healthz`가 `ok`인지 확인하고 브라우저에서 출전·가방·저장·새로고침까지 확인한다. 토큰 파일 변경 시 tunnel을 재생성한다.

상위 `.secrets` 디렉터리는700으로 유지한다. 파일644는 bind 방식으로 마운트되는 Compose secret을 cloudflared 이미지의 비루트 사용자가 읽을 수 있게 하기 위한 것이다. 호스트의 다른 사용자는700 디렉터리를 통과할 수 없다.

기본 cloudflared 이미지는 이번에 실제 실행한 2026.10.3의 digest에 고정했다. 다른 검증 버전이 필요하면 `CLOUDFLARED_IMAGE`를 지정한다. 토큰 파일 방식은 cloudflared 2025.4.0 이상에서 지원한다. 파일을 다른 위치에 둘 경우 `CLOUDFLARE_TOKEN_FILE`을 지정한다.

## 업데이트·확인·되돌리기

```bash
git status --short            # 로컬 변경이 있으면 먼저 보존
git pull --ff-only
MUGONG_TAG="$(git rev-parse --short HEAD)" bash deploy/home-server.sh update
bash deploy/home-server.sh status
bash deploy/home-server.sh logs
bash deploy/home-server.sh rollback PREVIOUS_IMAGE_TAG
```

업데이트 스크립트는 Git 내용을 강제로 초기화하거나 이전 이미지를 삭제하지 않는다. 새 빌드를 만든 뒤 web의 healthcheck를 확인하고 Tunnel을 실행한다. Tunnel이 연결됐다는 사실과 공개 게임의 동작 검증은 별개다. 설치 실패 시 기존 이미지/커밋을 보존해 되돌린다.

## 저장과 주소

게임은 브라우저 IndexedDB에 세가를 저장한다. Docker 컨테이너에 사용자 저장을 보관하는 서버 DB는 없다. `127.0.0.1`, 새 도메인, 다른 브라우저의 저장은 서로 다르며 서버 업데이트가 사용자 브라우저 저장을 자동으로 옮기지 않는다. 운영 도메인을 정한 뒤 같은 주소를 유지한다. HTML은 재검증하고 해시 JS/CSS는 장기 캐시한다. 사용자 데이터나 토큰을 컨테이너 이미지에 넣지 않는다.

## 실제 적용 범위

이 문서는 설치 가능한 구성이다. 집 서버의 접속 정보·Tunnel 토큰·공개 도메인이 제공되지 않은 상태에서는 집 서버 배포/공개 주소 확인을 완료했다고 기록하지 않는다. 이번 로컬 Docker 빌드/브라우저 검증 여부는 `verification/remaining-gameplay-v1/README.md`에 별도로 기록한다.
