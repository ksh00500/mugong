import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
// Preserve the prior operating instructions as history before replacing them.
await mkdir('docs/history',{recursive:true});
for(const file of ['external-assets','repository-guide','self-hosting']){
 await copyFile(`docs/${file}.md`,`docs/history/${file}-before-runtime-git-20261020.md`,1);
}
await writeFile('docs/external-assets.md',`# 실행 에셋과 제작 원본 보관

2026-10-20부터 public 미디어1,018개(이미지1,011장·소리4개·폰트3개)를 일반 Git에 포함한다. 이제 이 브랜치를 복제하면 실행용 묶음을 별도 복원하지 않아도 게임을 빌드할 수 있다. 기존 LFS 예산을 사용하거나 유료 설정을 바꾸지 않는다.

제작 원본·참고 자료1,818개는 assets/·docs/source/·docs/references/에 보존하고 외부 authoring 묶음으로 관리한다. 전체 asset-manifest.json은 실행/제작2,836파일의 경로·크기·SHA256을 유지한다. [분류와 삭제 기준](asset-management/README.md).

## 보관본

- runtime: mugong-runtime-d05a97c29b4c392f.tar.gz — 1,018파일, 1,176,113,644바이트. Git 복제와 별도로 로컬 복구용 보존.
- authoring: mugong-authoring-df51005ee5a3d539.tar.gz — 1,818파일, 2,641,160,316바이트. 게임 호스팅에는 불필요하지만 재생성·출력·제작 이력에는 필요.
- [runtime SHA](asset-bundles/runtime.json) · [authoring SHA](asset-bundles/authoring.json).

보관본은 현재 로컬 .asset-bundles에 있다. 개인 서버 전송이나 외부 백업 완료로 해석하지 않는다. 원본을 수정하면 목록을 갱신하고 authoring 묶음을 다시 만든다. Git에서 이전 소스/메타데이터를 복원할 때 해당 버전 파일 SHA를 확인한다.

과거 압축본과 최신 보관본의 내부 파일이 모두 같은 경우에만 이전 압축본을 정리할 수 있다. [전체 대조 결과](asset-management/archive-audit.json)와 [복원 검사](asset-management/restore-verification.json)를 사용한다. 과거 압축본 파일명이 등장하는 이력 문서는 당시 상태이며 현재 복원 안내는 이 문서와 삭제 기록을 따른다. 같은 내용을 복원할 수 있다는 뜻이며 이전 tar.gz의 압축 바이트 자체가 동일하다는 뜻은 아니다.

[이전 외부 분리 방침](history/external-assets-before-runtime-git-20261020.md)은 이력으로 보존한다.
`);
await writeFile('docs/repository-guide.md',`# 저장소와 제작 자료

2026-10-20 요청에 따라 public의 실행·호환·비교용 미디어1,018개를 일반 Git으로 관리한다. 경로와 바이트를 바꾸지 않으며 Git LFS는 사용하지 않는다. 소스·테스트·프롬프트·메타데이터·문서도 Git에 보관한다.

제작 원본 assets/·docs/source/·docs/references/의 미디어1,818개는 외부 authoring 묶음에 보존한다. 사용되지 않는 것으로 보이는 생성본도 재출력/참고/향후 필요를 확인하기 전에는 지우지 않는다. [전체 목록과 정책](asset-management/README.md) · [보관본](external-assets.md).

public 파일을 추가하면 asset-manifest.json을 갱신하고 미디어와 함께 커밋한다. npm run check:assets와 node scripts/audit-github-snapshot.mjs는 실제 바이트/SHA·제작 미디어 오추적·LFS·누락·제한된 자격 패턴을 검사한다. 이 검사가 모든 비밀을 탐지하는 것은 아니다.

node_modules, dist 계열, 캡처/대량 표본, 개인 노트 사본, 환경/인증 정보와 압축본은 Git에서 제외한다. 실행 중인 로컬 출력과 검증·복원 근거는 함부로 지우지 않는다.

기본 CI는 포함된 public 미디어 SHA, 타입, 소스 단위와 전체 빌드를 검사한다. 수동 verify_runtime은 Git 미디어로 Docker/브라우저를 검사하며 외부 다운로드 secret이 필요 없다. 원격 CI 성공 여부는 로컬 검사와 별도다.

[이전 분리 방침](history/repository-guide-before-runtime-git-20261020.md)은 당시 이력이다.
`);
await writeFile('docs/self-hosting.md',`# 개인 Linux 서버에서 실행

React·Phaser4·Vite 정적 게임을 Nginx로 제공한다. 이 브랜치는 public 미디어를 포함하므로 별도 실행 에셋 다운로드나 Git LFS가 필요 없다. 제작 원본은 외부 보관한다. 서버 계정/DB·온라인 저장은 없고 각 브라우저의 IndexedDB를 사용한다.

## 설치

Docker Engine·Compose 플러그인·Git을 준비한다.

\`\`\`sh
git clone --branch codex/asset-inventory-v1 https://github.com/ksh00500/mugong.git
cd mugong
cp .env.example .env
docker compose up -d --build
curl -f http://127.0.0.1:8080/healthz
\`\`\`

Docker 빌드는 asset-manifest.json의 public1,018파일 크기/SHA256을 대조한다. 기본 바인드는 서버127.0.0.1:8080이며 HTTPS 프록시를 앞에 둔다. .env·주소·TLS는 서버에서 설정하고 Git에 올리지 않는다. 최종 컨테이너는 일반 nginx 사용자·읽기 전용 루트·임시 /tmp를 사용한다.

## 업데이트와 복귀

git status로 변경을 확인한 뒤 git pull --ff-only, docker compose build, docker compose up -d --no-build, healthz 순으로 진행한다. 배포 커밋과 Docker 태그를 기록한다. 미디어가 포함된 이 브랜치의 커밋은 소스와 미디어가 함께 복귀한다. 외부 분리 시기의 과거 커밋은 당시 manifest를 최신 보관본과 대조해 복원한다. [보관·압축본 대체 안내](external-assets.md).

주소/포트/프로토콜을 바꾸면 저장 공간도 달라진다. 실제 저장 이동은 게임 내 내보내기/가져오기를 사용하고 배포 검사로 사용자 저장을 초기화하지 않는다.

## 검사

Node22.12이상에서 npm ci, npm run check:assets, npm run typecheck, npm test, npm run build를 수행한다. Docker 실행 뒤 npx playwright install --with-deps chromium을 실행하고 MUGONG_HOSTING_URL=http://127.0.0.1:8080 MUGONG_HOSTING_NGINX=1 npm run test:hosting으로 Nginx를 검사한다. 기본 CI와 수동 Docker 검사는 Git에 포함된 미디어를 사용한다.

이번 Git 정리는 개인 서버 전송/배포·TLS·공개 접속 완료를 뜻하지 않는다. [이전 설치 안내](history/self-hosting-before-runtime-git-20261020.md)는 당시 이력이다.
`);
await copyFile('.asset-bundles/mugong-runtime-d05a97c29b4c392f.tar.gz.json','docs/asset-bundles/runtime.json');
console.log('Updated asset operating docs; preserved prior guides.');
