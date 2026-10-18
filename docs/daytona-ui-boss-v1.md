# Daytona 배포 기록 · 2026-10-02 · UI와 보스 이름표

현재 최신 배포는 [무기·획득 물품 수정본](daytona-pending-weapon-v1.md)이다.

[무공 플레이](https://8080-aeae46c6-f6b0-455f-878b-f2381900a712.proxy.daytona.work/)

최신 빌드와 런타임 그림·폰트·사운드를 배포했다. [보스 이름표](boss-nameplate-v1.md), [전투 후 가방과 웨이브 진행](wave-progression-v1.md), 무공 연결·자동 정리, 전용 투사체·착용 비교, 92종 물품 그림과 10지역·40보스 콘텐츠를 포함한다. 온라인 레이드·PVP 서버 구현 여부와 정적 게임 배포는 별개다.

## 배포 결과

| 항목 | 확인 값 |
| --- | --- |
| 현재 릴리스 | `/srv/mugong/releases/20261001-ui-boss-v1` |
| 이전 릴리스 | `/srv/mugong/releases/20260930-inventory-summary-v5-final` |
| 제공 방식 | Ubuntu 22.04.5 LTS x86_64 · Nginx · 8080 |
| 압축 파일 크기 | 62,491,548 bytes |
| SHA256 | `a759c0b809d96c8c84dc5fd491f76b69b65837dffc4da8506e5df7cb6b2ca84e` |
| 런타임 파일 | 187개 · 원격 해시 검증 완료 |
| 현재 링크 | `/srv/mugong/current` |
| 복구 기록 | `/srv/mugong/backups/20261001-ui-boss-v1/` |

코드가 사용하는 WebP와 필수 PNG 4개를 포함하고 미사용 원본 PNG는 제외했다. SSH 접속 자격 정보, 사용자 저장과 첨부 파일은 배포하지 않았다. 8개 조각으로 압축 파일을 전송한 뒤 압축 파일과 개별 파일의 해시를 검증했다. Windows 체크섬 목록의 CRLF는 검증 입력에서만 LF로 정규화했다.

이전 릴리스와 설정·시작 스크립트·이전 링크 경로를 보관한 뒤 `/srv/mugong/current` 링크를 원자적으로 교체했다. Nginx 설정 검사·재로드와 실제 제공 HTML 비교를 통과했다. 기존 탭이 사용하는 이전 해시의 JavaScript·CSS도 공유 경로에 유지한다. 샌드박스 종료 정책은 변경하지 않았다.

## 검증과 증거

로컬 검증은 단위 테스트 243개, 관련 브라우저 테스트 64개와 프로덕션 빌드를 통과했다. 공개 주소에서는 독립 Playwright 컨텍스트로 아래 3개 테스트를 추가 실행해 모두 통과했다. 실제 사용자 저장은 변경하지 않았다.

- 새 무인 출전·이동·공격·가방·전투 중 소모품 제한·중단 저장·재개·새로고침 복원.
- 1093×614 한국어 화면에서 가방 닫기·필드 진행 버튼·초점 복원·키보드로 다음 웨이브 진입.
- 같은 화면에서 보스 이름·체력·그림 프레임의 중앙 정렬과 HUD 간격.

별도로 공개 파일 7개의 해시가 로컬 빌드와 일치함을 확인했다. 공개 게임 테스트에서 JavaScript 예외와 실패한 에셋 요청은 없었다. 최종 원격 검사에서 HTTP 200, Nginx 오류 로그 0 bytes를 확인했다.

실제 시각 검토는 공개 주소에서 캡처한 1093×614 보스 화면과 가방을 닫은 필드 화면을 열어 수행했다. 이름표 내부의 텍스트 배치와 큰 진행 버튼을 확인했다. 이는 테스트한 화면과 흐름의 검증이며 서비스 수준·접근성 인증을 뜻하지 않는다.

증거: [배포 메타데이터](verification/daytona-20261001-ui-boss-v1/release.json), [원격 배포 결과](verification/daytona-20261001-ui-boss-v1/deploy-output.txt), [최종 서버 상태](verification/daytona-20261001-ui-boss-v1/final-server-status.txt), [공개 파일 해시](verification/daytona-20261001-ui-boss-v1/public-files.json), [공개 게임 검증](verification/daytona-20261001-ui-boss-v1/public/result.json).

화면 캡처: [보스 화면](verification/daytona-20261001-ui-boss-v1/public/boss-nameplate/boss-1093-ko-KR.png), [전투 후 필드](verification/daytona-20261001-ui-boss-v1/public/wave-progression/field-1093-ko-KR.png), [가방](verification/daytona-20261001-ui-boss-v1/public/wave-progression/bag-1093-ko-KR.png).

## 복구와 실행

필요한 경우 이전 릴리스로 링크를 교체하고 시작 스크립트를 실행한다. 사용자 저장은 브라우저 IndexedDB에 속하며 릴리스 복구 시 과거 사용자 저장으로 되돌리지 않는다.

```sh
ln -s /srv/mugong/releases/20260930-inventory-summary-v5-final /srv/mugong/current.rollback
mv -Tf /srv/mugong/current.rollback /srv/mugong/current
sh /srv/mugong/start.sh
```

샌드박스가 다시 켜진 뒤 Nginx 실행이 필요한 경우에도 `sh /srv/mugong/start.sh`를 사용한다.
