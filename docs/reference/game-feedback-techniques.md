# 게임 피드백 기법 조사와 적용

2026-10-18. 실제 개발 발표·엔진 문서를 확인하고 현재 React/Phaser 구조에 맞게 구현했다. 아래 자료의 코드를 복제하거나 엔진/라이브러리를 추가한 것은 아니다. 구체적인 색과 시간은 이 게임의 설계 선택이다.

| 자료 | 확인한 원리 | MUGONG 적용 |
| --- | --- | --- |
| [Squirrel Eiserloh, GDC 2016: Juicing Your Cameras With Math](https://www.gdcvault.com/play/1023557/Math-for-Game-Programmers-Juicing), [슬라이드](https://media.gdcvault.com/gdc2016/Presentations/Eiserloh_Squirrel_JuicingYourCameras.pdf) | 충격량 누적·감쇠와 비선형 곡선. 기본 카메라와 시각 충격 분리 | trauma 상한 0.85·제곱 곡선·감쇠·smooth value noise. 슬라이드의 Perlin 구현과 동일하다고 주장하지 않는다. 회전/확대 없이 작은 평행 이동만 사용 |
| [Godot Engine 공식 Tween 문서](https://docs.godotengine.org/en/stable/classes/class_tween.html) | 동적 값의 시간·easing 보간, 지연과 순차 동작 구성 | 실제 체력은 즉시, 손실 잔량은 지연 뒤 cubic ease-out. 엔진 노드 대신 공유 순수 모델과 DOM/Graphics로 구현 |
| [Game Accessibility Guidelines: camera movement](https://gameaccessibilityguidelines.com/avoid-or-provide-option-to-disable-any-difference-between-controller-movement-and-camera-movement/) | 입력과 별개인 카메라 움직임에 끄기 옵션 제공 | 끄기/약하게/보통, 기본 약하게. OS 움직임 감소 우선. HUD와 논리 조준 고정 |

‘5단계’는 특정 공인 표준이나 HP를 5칸으로 나누는 규칙으로 해석하지 않았다. 즉시 감소→흰 접촉 강조→잠깐 유지→감쇠→안정의 시간 단계로 구현한다. 회복과 궁극/방어 준비는 독립된 피드백이다.

전체 화면 플래시, 반복 맥동, 모든 작은 타격의 카메라 진동, 시뮬레이션 hit-stop은 넣지 않았다. 전장의 작은 적과 패턴을 가리지 않고 이동·방어 입력을 유지하기 위한 선택이다. [현재 구현 수치와 범위](../ui-feedback-v1.md)를 따른다.
