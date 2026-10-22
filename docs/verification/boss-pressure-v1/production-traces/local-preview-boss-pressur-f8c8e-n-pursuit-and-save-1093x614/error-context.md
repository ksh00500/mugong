# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: local-preview-boss-pressure.spec.ts >> production pursuit and save 1093x614
- Location: tests\e2e\local-preview-boss-pressure.spec.ts:7:3

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
```

```
Error: browserContext._wrapApiCall: file data stream has unexpected number of bytes
```

# Page snapshot

```yaml
- generic [ref=f2e3]:
  - main [ref=f2e4]:
    - generic [ref=f2e5]:
      - generic:
        - generic:
          - region "무인 상태":
            - generic:
              - generic:
                - generic "지역 검증"
                - generic: Lv.16
              - generic:
                - generic:
                  - generic: 체력
                  - generic: 120 / 120
                - meter
              - generic:
                - generic:
                  - generic: 경험치
                  - generic: 0 / 100
                - meter
          - generic:
            - generic:
              - generic: 파계승 공허
              - generic:
                - meter
                - generic: 100000 / 100000
          - region "강호 진행":
            - generic:
              - generic: 강호
              - generic: 5 / 20 웨이브
            - generic:
              - button "가방 Tab" [ref=f2e8] [cursor=pointer]:
                - text: 가방
                - generic [ref=f2e9]: Tab
              - button "일시 정지" [ref=f2e10] [cursor=pointer]
        - generic:
          - region "무공 전환":
            - generic:
              - button "이전 무공" [disabled] [ref=f2e11]: Q ‹
              - generic "미숙한 기본 공격"
              - button "다음 무공" [disabled] [ref=f2e12]: › E
            - button "미숙한 기본 공격" [disabled] [ref=f2e13]:
              - generic [ref=f2e15]: —
              - generic [ref=f2e16]: Lv.0
          - generic:
            - generic:
              - generic: 궁극
              - generic: 미개방
            - meter
            - generic: 무공 Lv.5 개방
          - region "방어 행동":
            - generic:
              - generic: 방어 행동
              - generic: Space
            - generic: 첫 레벨에서 무공을 선택합니다
  - dialog "여정을 잠시 멈추다" [ref=f2e18]:
    - banner [ref=f2e19]:
      - heading "여정을 잠시 멈추다" [level=2] [ref=f2e20]
    - generic [ref=f2e21]:
      - button "계속하기" [ref=f2e22] [cursor=pointer]
      - button "저장하고 일시 종료" [ref=f2e23] [cursor=pointer]
      - button "화면 설정" [active] [ref=f2e24] [cursor=pointer]
      - button "소리 끄기" [ref=f2e25] [cursor=pointer]
      - paragraph [ref=f2e26]: 강호에서 귀환하는 것이 아닙니다.이 무인의 여정을 다음에 이어갑니다.
```