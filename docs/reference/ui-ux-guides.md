# 적용한 공개 UI·UX Markdown

2026-09-28 확인. 라이브러리 설치 없이 설계·검토 기준으로 사용하는 로컬 참고 문서다. 기업의 브랜드나 웹 업무 도구 화면을 게임에 그대로 옮기지 않는다.

| 문서                                 | 공식 원문                                                                             | 로컬 파일 / 라이선스                                                         | 이 게임에서 적용                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Vercel Labs Web Interface Guidelines | https://github.com/vercel-labs/web-interface-guidelines/blob/main/README.md           | `web-interface-guidelines.md` / `web-interface-guidelines-license.txt` (MIT) | 불필요한 스크롤, 반응형 레이아웃, 클릭 영역, 초점과 드래그 대안, 움직임 줄이기 |
| IBM Carbon Accessibility             | https://github.com/carbon-design-system/carbon/blob/main/docs/guides/accessibility.md | `carbon-accessibility.md` / `carbon-LICENSE.txt` (Apache-2.0)                | 자동 검사와 수동 조작 검토를 구분, 키보드 순서, 배율 변화, 행동 주변 피드백    |
| Radix Primitives Philosophy          | https://github.com/radix-ui/primitives/blob/main/philosophy.md                        | `radix-philosophy.md` / `radix-LICENSE.txt` (MIT)                            | 크기 변화에 적응하는 대화상자, 초점 관리, 예측 가능한 상태 전환                |
| Google Labs DESIGN.md 명세           | 기존 다운로드의 출처는 `design-md-spec.md` 참조                                       | `design-md-spec.md` / `design-md-LICENSE.txt`                                | 게임 고유 색·서체·간격·컴포넌트 토큰을 `DESIGN.md`로 명시                      |

Carbon 원문의 IBM 내부 DAP 도구 설치·인증 절차는 적용하지 않았다. Radix 라이브러리를 새 의존성으로 설치한 것도 아니다. 여기서는 공개 설계 원칙을 기존 React UI에 적용한다.

프로젝트의 `AGENTS.md`가 이 문서와 `DESIGN.md`, `UX.md`를 다음 작업의 시작 기준으로 연결한다. 구체적인 레이아웃·동작 기준과 확인 결과는 `../viewport-ui-v2.md`에 기록한다.
