# 저장소와 제작 자료

2026-10-20 요청에 따라 public의 실행·호환·비교용 미디어1,018개를 일반 Git으로 관리한다. 경로와 바이트를 바꾸지 않으며 Git LFS는 사용하지 않는다. 소스·테스트·프롬프트·메타데이터·문서도 Git에 보관한다.

제작 원본 assets/·docs/source/·docs/references/의 미디어1,818개는 외부 authoring 묶음에 보존한다. 사용되지 않는 것으로 보이는 생성본도 재출력/참고/향후 필요를 확인하기 전에는 지우지 않는다. [전체 목록과 정책](asset-management/README.md) · [보관본](external-assets.md).

public 파일을 추가하면 asset-manifest.json을 갱신하고 미디어와 함께 커밋한다. npm run check:assets와 node scripts/audit-github-snapshot.mjs는 실제 바이트/SHA·제작 미디어 오추적·LFS·누락·제한된 자격 패턴을 검사한다. 이 검사가 모든 비밀을 탐지하는 것은 아니다.

node_modules, dist 계열, 캡처/대량 표본, 개인 노트 사본, 환경/인증 정보와 압축본은 Git에서 제외한다. 실행 중인 로컬 출력과 검증·복원 근거는 함부로 지우지 않는다.

기본 CI는 포함된 public 미디어 SHA, 타입, 소스 단위와 전체 빌드를 검사한다. 수동 verify_runtime은 Git 미디어로 Docker/브라우저를 검사하며 외부 다운로드 secret이 필요 없다. 원격 CI 성공 여부는 로컬 검사와 별도다.

[이전 분리 방침](history/repository-guide-before-runtime-git-20261020.md)은 당시 이력이다.
