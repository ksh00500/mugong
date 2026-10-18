# 소림 봉 승려 · 8방향 실행 시범

2026-10-04. 내장 image generation 도구로 생성·수정했다. 사용자가 승인한 [봉 승려 대표 자세](../shaolin-motion-v1/02-staffguard.png)를 인물 기준으로 사용했다.

소림 일반 봉 승려 한 종만 게임에 연결했다. 앞·앞 대각선·옆·뒤 대각선·뒤의 다섯 원화 시점을 만들고 세 대각/옆 방향을 좌우 반전하여 8방향을 표시한다. 각 시점은 보행/반응 6개와 공격 6개, 총 **60개 원화**다. 사망은 방향별 한 개의 쓰러진 자세와 기존 0.38초 페이드이며 쓰러지는 전 과정을 여러 장으로 그린 애니메이션은 아니다.

## 원본과 프롬프트

| 시점 | 보행·반응 원본 및 프롬프트 | 공격 원본 및 최초 프롬프트 |
|---|---|---|
| 앞 | [PNG](front-locomotion.png) · [프롬프트](front-locomotion.prompt.txt) | [PNG](front-combat.png) · [프롬프트](front-combat.prompt.txt) |
| 앞 대각선 | [PNG](front-right-locomotion.png) · [프롬프트](front-right-locomotion.prompt.txt) | [PNG](front-right-combat.png) · [프롬프트](front-right-combat.prompt.txt) |
| 옆 | [PNG](right-locomotion.png) · [프롬프트](right-locomotion.prompt.txt) | [PNG](right-combat.png) · [프롬프트](right-combat.prompt.txt) |
| 뒤 대각선 | [PNG](rear-right-locomotion.png) · [프롬프트](rear-right-locomotion.prompt.txt) | [PNG](rear-right-combat.png) · [프롬프트](rear-right-combat.prompt.txt) |
| 뒤 | [PNG](back-locomotion.png) · [프롬프트](back-locomotion.prompt.txt) | [PNG](back-combat.png) · [프롬프트](back-combat.prompt.txt) |

뒤 대각선 공격은 [보행 기준 수정](rear-right-combat-match-locomotion.prompt.txt) 이후 [배경 투명도 정리](rear-right-combat-cutout.prompt.txt)를 적용했다. 뒤 공격은 [머리만 수정](back-combat-head.prompt.txt)을 적용했다. 최초 공격 원본과 탈락한 수정본은 `attempts/`에 보존했다. 전체를 10% 크게 하라는 수정은 실제로 너무 크게 생성됐고, 다른 뒤 공격 수정은 북쪽 공격의 봉을 옆으로 향하게 하여 제외했다. 한 뒤 대각선 수정본은 배경 알파가 남아 연결 영역 검사를 통과하지 못해 배경을 다시 제거했다.

도구의 기본 저장 원본은 `C:/Users/user/.codex/generated_images/01a0e1f0-638e-7b20-9e28-1f0d4d39d935/`에 보존되어 있다. 이 폴더의 PNG는 게임 작업 공간으로 복사한 선택본이다. 최초 작업 순서와 프롬프트 파일은 [generation-jobs.json](generation-jobs.json)에 기록했다.

## 원본 픽셀과 여백

생성 원본은 1536×1024, 3×2 배치다. 봉이 원래 512칸을 넘은 그림은 연결된 인물 전체를 추출하여 끝까지 보존한다. 추출은 내보내기 단계에서만 하고, 게임에서는 저장된 프레임 좌표만 읽는다.

704×576의 공통 전달 칸에 **최소 32픽셀 투명 여백**을 둔다. 원본 RGBA 픽셀을 1:1로 복사하며 `fit`, `contain`, 프레임별 리사이즈를 하지 않는다. 발 좌표는 프레임마다 기록한 원본 접지점을 동일하게 평행 이동한다. 투명 부분을 제외하는 패킹은 몸·무기의 픽셀 크기를 바꾸지 않는다.

[export-review.json](export-review.json)은 원본 SHA-256, 추출 영역, 발 좌표, 여백 및 모든 불투명 연결 픽셀의 RGBA 복사 대조 결과다. 전달 WebP는 lossless다. 원본 10장의 전달 파일 용량은 약 4.4MB이며 GPU에서 디코딩된 텍스처 용량은 이보다 크다.

[anatomy-review.json](anatomy-review.json)은 가장 큰 연결 피부 영역의 측정이다. 살아 있는 그림의 가로 폭은 104~124픽셀, 같은 시점의 최대/최소 비는 약 1.05~1.14다. 원근·숙임·얼굴 방향에 영향을 받는 보조 측정이며 머리의 실제 3D 지름을 뜻하지 않는다. 초안의 엄격한 ±5% 후보 기준을 모든 그림이 수치상 만족한다는 의미로 승인하지 않는다. 더 세밀한 원화 비율 정리는 후속 검수 대상으로 남긴다.

## 실제 연결

플레이 화면: [localhost:5173](http://127.0.0.1:5173/)

정지·한 프레임 이동·동작 선택이 가능한 [8방향 검토 화면](http://127.0.0.1:5173/art/shaolin-staff-v1/review.html). 미리보기 배율은 게임의 두 배이며 방향·프레임마다 달라지지 않는다.

구현과 검증 결과는 [shaolin-staff-v1.md](../../shaolin-staff-v1.md)에 정리했다. 이번 결과는 전체 지역·보스·플레이어 무기 작업의 완료를 뜻하지 않는다.
