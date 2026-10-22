# 무공 · MUGONG

2026-10-22: 사망 원인·웨이브/보스 전투 기록, 기연6종, 저장 성공 후 NPC 작업 모션을 추가했다. 현재 지역만 모션 표를 읽도록 분리해 mount를5,461.89KB에서444.98KB로 줄였다. [구현·호환 경계](docs/remaining-gameplay-v1.md) · [이번 검증](docs/verification/remaining-gameplay-v1/README.md). 집 Linux PC의 Docker + Cloudflare Tunnel 설치는 [서버 안내](docs/home-server-cloudflare.md)를 따른다. 실제 집 서버 연결과 공개 주소 확인은 별도다. 로컬 최신 빌드는 http://127.0.0.1:5205/ 이다.

2026-10-21 추천 2·3·4: 혼잡 전투의 공격 예고·장판 경계·화면 밖 사격 방향을 강화하고, 비용/보상/한 번의 선택을 저장하는 맵 기연 3종을 연결했다. 4·9·14·19웨이브 모두 가까이 이동해 NPC·기연·출구와 상호작용한다. 후반 쉼터는 현재 지역의 배경과 배치를 사용한다. [구현·저장 경계](docs/rest-clarity-v1.md) · [이번 검증](docs/verification/rest-clarity-v1/README.md).

2026-10-21 일반 적 협공: 근접 압박/측면 접근·창병의 이동 방향 견제·다른 각도의 사격을 연결했다. 먼 사격자도 공격 슬롯을 차지하고 일반 적의 새 준비 시작을 최소0.22초씩 나눈다. [동작·예고·저장 경계·전후 비교](docs/enemy-coordination-v1.md) · [검증](docs/verification/enemy-coordination-v1/README.md).

2026-10-21 전체 밸런스1차: 중후반 적·보스 압박과 회복/상점 비용을 단계별로 조정했다. 삼재·천마의 후반 화력과 자동 방어 유지를 줄이고 개방·제갈을 보완했다. 원거리 공격 중 이동·사거리에 비용을 두며 근접 반격 기회는20%로 강화했다. [수치·전후 비교·저장 호환](docs/global-balance-v1.md) · [검증](docs/verification/global-balance-v1/README.md).

정비4·9·14·19웨이브는 실제 쉼터 맵에서 의원·상인·대장장이에게 걸어가 `E`로 상호작용한다. 인물/표식을 선택하면 그 앞까지 걸어가고 출구 확인으로 보스전을 시작한다. [첫 쉼터의 조작·원화](docs/waystation-world-v1.md) · [현재 후반 쉼터·기연](docs/rest-clarity-v1.md).

4·9·14·19웨이브 정비 화면에 쉼터 배경과 의원·상인·대장장이 원화를 추가했다. 실제 회복·구매·강화·가방·다음 보스 행동을 연결한다. [정비 디자인·원화](docs/prep-design-v1.md).

탑뷰 무협 액션 로그라이크 브라우저 게임. 새 무인을 Lv.0부터 키우며 강호20웨이브를 진행하고 세가 명부·가방·창고를 관리한다. 현재 소스는 **React19 · Phaser4 · TypeScript · Vite7** 기반이다.

현재 UI는 즉시 체력 감소·흰 피해 잔량·회복·위험 상태, 강도 조절 카메라 충격, 청옥색 궁극기와 방어 준비 표시를 사용한다. [UI 피드백 범위와 검사](docs/ui-feedback-v1.md).

UI 감사의 높음15항목(U06–U20)은 행동/입력/비활성 사유, 가방 목적지/수량/표시 정밀도, 상인 장비 비교, 다음 보스 안내, 실제 상태 이상과 설정·로딩/복구 안내를 정리했다. [높음 변경 범위](docs/ui-high-v1.md).

보통 U21–U24도 로컬5205에 적용했다. 빈 명부·전사·완주의 안내와 다음 행동, 공통 표면/선택/초점, 로비10외형의 원본 크기 상한을 정리하고 가방 Tab 초점 복구 경합을 수정했다. [보통 변경 범위](docs/ui-medium-v1.md) · [이번 검증](docs/verification/ui-medium-v1/README.md). 새 고해상도 원화 생성과 공개 배포는 이번 범위와 구분한다.

보스는 일반 원화 기준보다20% 크게 표시하며 고정 피격 캡슐·그림자·HP바를 함께 맞춘다. 베기·찌르기·돌진·발사·설치의 준비 예고와 실제 교전/추격/수세/격화 전환을 표시한다. [보스 가독성](docs/boss-readability-v1.md).

보스 기본 접근·추격과 새 보스 HP/피해를 높였다. 큰 근접 기술 뒤에는 이동 없는 반격 시간을 보장하고 `반격 기회` 배지/잔여 막대를 표시한다. 이때 실제 근접 기본 접촉은20% 추가 피해를 준다. [현재 전체 조정](docs/global-balance-v1.md) · [이전 압박/반격 설계와 검증](docs/boss-balance-v1.md).

10지역70캐릭터의 방향별 크기를 조사하고 제갈현·양기·묵연·진괄·설산 창병의 원화 묶음 크기를 교정했다. 고정0.225 배율·발점·32px 여백과 게임 규칙을 유지한다. [교정 범위](docs/native-size-v1.md) · [로컬 전후 비교](http://127.0.0.1:5205/art/native-size-v1/review.html).

몸통 캡슐 피격과 높이를 맞춘 투사체/조준을 사용하며 적 HP·피해·후반 적 수를 높였다. 4·9·14·19웨이브는 의원·상인·강화·다음 보스를 연결한 정비 화면이다. [전투·정비 변경](docs/combat-prep-v1.md). 로딩은 현재 전투의 그림만 먼저 준비하며 다음 보스는 정비 중 선읽기한다. [로딩 개선·측정](docs/loading-v2.md). 컴파일 로컬 실행은 http://127.0.0.1:5205/ 이다.

**실행·호환·검토용 public 미디어1,026개를 소스와 함께 GitHub에 보관**한다. 정비 카드 원화 네 장과 이동 쉼터 원화 네 장을 기존1,018개에 추가했다. Git LFS를 사용하지 않으며 복제 후 별도 실행 에셋 다운로드 없이 빌드할 수 있다. 제작 원본1,818개는 외부 보관본과 SHA 목록을 유지한다. [이미지 분류·안전한 정리](docs/asset-management/README.md).

## 개인 Linux 서버에서 실행

Docker Engine·Compose가 필요하다. 이 브랜치는 실행 미디어를 포함한다.

```sh
git clone --branch codex/enemy-coordination-v1 https://github.com/ksh00500/mugong.git
cd mugong
cp .env.example .env
docker compose up -d --build
curl -f http://127.0.0.1:8080/healthz
```

Docker 빌드는 `asset-manifest.json`과 실행용 에셋1,026개를 SHA256으로 대조한 뒤 진행한다. 기본 접속 주소는 서버의 `127.0.0.1:8080`이며 HTTPS 프록시에서 연결한다. [서버 설치·업데이트·복귀](docs/self-hosting.md) · [에셋 보관·복원](docs/external-assets.md).

게임 저장은 각 브라우저의 IndexedDB를 사용한다. 개인 서버 호스팅만으로 계정·기기 간 저장 공유·온라인 레이드가 추가되지는 않는다.

## 개발과 검사

Node.js22.12이상. `.nvmrc`의 버전을 사용하고 `npm ci`로 시작한다.

```sh
# 에셋 없이 실행할 수 있는 소스 검사
npm run assets:catalog
npm run typecheck
npm run test:source

# Git에 포함된 실행용 에셋 검증 후
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
| `public` | 실행·호환·검토용 미디어·메타데이터·라이선스 |
| `assets`, `docs/source` | 제작 프롬프트·교정 이력. 원본 미디어는 보관용 묶음 |
| `asset-manifest.json` | 전체 미디어2,836개 경로·바이트 수·SHA256 |
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
