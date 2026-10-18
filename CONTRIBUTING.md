# 개발·검증·원화 관리

작업 전 [프로젝트 지침](AGENTS.md)과 [현재 상태](docs/project-status.md)를 확인한다. UI를 변경할 때는 DESIGN.md·UX.md·docs/reference/ui-ux-guides.md도 읽는다.

## 시작

Node.js 버전은 `.nvmrc`를 사용하고 `npm ci`로 시작한다. 소스 검사만 할 때는 `npm run assets:catalog`, `npm run typecheck`, `npm run test:source`를 사용한다. 게임 실행에는 개인 서버에서 실행용 에셋 묶음을 받아 복원해야 하며 Git LFS는 사용하지 않는다. [에셋 보관·복원](docs/external-assets.md)과 [저장소 관리](docs/repository-guide.md)를 따른다.

```sh
npm run check:assets
npm run typecheck
npm test
npm run build
```

브라우저 검사는 `npx playwright install chromium` 후 `npm run test:hosting`으로 실행한다. 테스트용 상태는 독립 브라우저 컨텍스트에서만 사용하며 실제 사용자 저장을 초기화하지 않는다. 실제 Nginx 검사는 [개인 서버 가이드](docs/self-hosting.md)를 따른다.

## 변경 제출

`codex/` 등 작업 브랜치에서 변경하고 PR에 목적·검증 결과·남은 제한을 적는다. 기존 main 이력을 유지한다. 기본 CI는 에셋 목록·타입·소스 단위 검사·JS/CSS 컴파일이며 실제 미디어/Docker 검사는 별도 수동 실행이다. CI는 배포나 이미지 레지스트리 업로드를 하지 않는다.

새 바이너리를 추가하면 manifest와 개인 서버 에셋 묶음을 갱신한다. 커밋 전 `node scripts/audit-github-snapshot.mjs`로 미디어/LFS 오추적과 자격 정보 패턴을 점검한다. 이 검사는 완전한 비밀 탐지를 보장하지 않으므로 실제 저장/자격 정보·개인 노트 사본을 저장소에 추가하지 않는다.

원화 생성·시안 선택·게임 적용·로컬 검증·공개 배포는 별개 상태로 기록한다. 완료한 변경의 기능 문서·검증 요약과 프로젝트 기억을 함께 갱신한다.
