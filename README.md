# 무공 · MUGONG

탑뷰 무협 액션 로그라이크 브라우저 게임. 새 무인을 Lv.0부터 키우며 강호20웨이브를 진행하고 세가 명부·가방·창고를 관리한다. 현재 소스는 **React19 · Phaser4 · TypeScript · Vite7** 기반이다.

현재 UI는 즉시 체력 감소·흰 피해 잔량·회복·위험 상태, 강도 조절 카메라 충격, 청옥색 궁극기와 방어 준비 표시를 사용한다. [UI 피드백 범위와 검사](docs/ui-feedback-v1.md).

**소스·메타데이터·문서는 GitHub, 그림·소리·폰트는 개인 서버에 별도 보관**한다. 이 브랜치는 Git LFS를 사용하지 않는다. 소스만 복제한 상태에서는 게임을 실행할 수 없으며 일치하는 실행용 에셋 묶음을 복원해야 한다.

## 개인 Linux 서버에서 실행

Docker Engine·Compose가 필요하다. 에셋 묶음과 SHA256 파일을 개인 서버에 먼저 복사한다.

```sh
git clone --branch codex/ui-feedback-v1 https://github.com/ksh00500/mugong.git
cd mugong
# /srv/mugong-assets에 전달받은 에셋이 있다고 가정
(cd /srv/mugong-assets && sha256sum -c mugong-runtime-*.tar.gz.sha256)
tar -xzf /srv/mugong-assets/mugong-runtime-b15bfb5ba50574ab.tar.gz -C .
cp .env.example .env
docker compose up -d --build
curl -f http://127.0.0.1:8080/healthz
```

Docker 빌드는 `asset-manifest.json`과 실행용 에셋1,005개를 SHA256으로 대조한 뒤 진행한다. 기본 접속 주소는 서버의 `127.0.0.1:8080`이며 HTTPS 프록시에서 연결한다. [서버 설치·업데이트·복귀](docs/self-hosting.md) · [에셋 보관·복원](docs/external-assets.md).

게임 저장은 각 브라우저의 IndexedDB를 사용한다. 개인 서버 호스팅만으로 계정·기기 간 저장 공유·온라인 레이드가 추가되지는 않는다.

## 개발과 검사

Node.js22.12이상. `.nvmrc`의 버전을 사용하고 `npm ci`로 시작한다.

```sh
# 에셋 없이 실행할 수 있는 소스 검사
npm run assets:catalog
npm run typecheck
npm run test:source

# 실행용 에셋 복원 후
npm run check:assets
npm test
npm run dev
```

`test:source`는 에셋 참조를 목록과 대조하며 실제 그림 파일을 검증하지 않는다. 실제 파일 검사·Docker/브라우저 검사는 별도다. 개발 주소는 <http://127.0.0.1:5173/>이며 이미 사용 중이면 다른 포트를 지정한다. `npm run build`는 기존 dist를 다시 만들므로 로컬 검토 화면을 보존하려면 별도 출력이나 Docker 빌드를 사용한다.

## 코드와 자료

| 경로 | 내용 |
| --- | --- |
| `src/domain` | 전투·성장·아이템·보스 규칙 |
| `src/game` | Phaser 렌더링·방향·프레임/접지 메타데이터 |
| `src/platform`, `src/ui` | 저장·로딩·소리·사용자 화면 |
| `public` | 런타임 메타데이터·비교 화면·라이선스. 미디어는 별도 복원 |
| `assets`, `docs/source` | 제작 프롬프트·교정 이력. 원본 미디어는 보관용 묶음 |
| `asset-manifest.json` | 외부 미디어2,823개 경로·바이트 수·SHA256 |
| `tests`, `scripts` | 자동 검사·에셋 포장/검증·제작 도구 |
| `Dockerfile`, `compose.yaml` | 개인 Linux 서버 실행 |

[개발 안내](CONTRIBUTING.md) · [저장소 관리](docs/repository-guide.md) · [현재 상태](docs/project-status.md).

## 구현 상태

- 10지역·40보스·8계열 무공·6무기, 모집·성장·20웨이브·가방/창고·정비·강화·정산.
- 소림·천검산·독무곡·청하현73행동, 설산18행동, 서역사막·혈마전·제갈55행동, 고묘·죽림39행동을 합쳐40보스185행동·6,660논리 프레임에 특별 그림을 연결했다. 준비·회수 일부는 기존 원화를 사용한다. [최신 적용·검증](docs/three-complete-v3.md).
- 실제185키트 행동 모두 행동별 시퀀스를 연결했다. 새 접촉과 기존 준비·회수 원화를 조합하며, 모든 논리 프레임이 독립 생성 그림이라는 뜻은 아니다.
- 계정·온라인 저장·실제 다인 레이드·비무/거래는 미구현이다. `/next-stage/`는 설계 UI 시안이다.

WASD 이동, 좌클릭 공격, 우클릭 궁극 행동, Q/E 무공 전환, Space 방어 행동, Tab/I 가방, Esc 일시 정지. 가방은 R 회전과 클릭·키보드 이동도 지원한다.

과거 Phaser3 코드와 Daytona 배포 이력은 Git 이력 및 [이전 README](docs/history/readme-before-github-hosting-v1.md)에 보존한다. 과거 기록을 현재 개인 서버 배포 완료로 해석하지 않는다.
