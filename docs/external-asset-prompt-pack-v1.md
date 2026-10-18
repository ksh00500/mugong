# 무공 — 외부 에셋 제작용 프롬프트 팩 v1

이전 장문 요청의 기록이다. 현재 제작은 사용자가 승인한 카툰풍과 [v2 짧은 프롬프트 팩](external-asset-prompt-pack-v2.md)을 사용한다. 아래 공통 블록과 동작 세부 지시를 새 요청에 합쳐 보내지 않는다.

작성일: 2026-09-27

새 개발의 기획과 사용자 참고 이미지에 맞춘 도구 독립형 초안이다. 아래 색상·복장·픽셀 규격은 첫 제작의 일관성을 위한 시안이며 전체 게임의 확정 규격이 아니다. 사용할 생성 도구의 기능에 맞춰 최종 입력 형식은 조정한다.

## 1. 제작과 전달 방식

Codex가 화풍·시점·에셋별 요청·동작 기준을 작성하고, 사용자가 외부에서 원본을 생성해 가져오면 Codex가 실제 파일의 크기·알파·동작·기준점을 검사하고 게임에 연결한다. 외부 생성 결과도 원화와 실행 화면을 각각 검수한다.

먼저 **기준 무인 한 명 → 한 방향 베기 → 한 방향 걷기**를 맞춘다. 이 세 가지가 맞기 전에는 다른 방향·여러 무인·아이템 전체를 일괄 생성하지 않는다. 무인 얼굴·무기·무공 이름과 전체 콘텐츠 수는 이 문서로 새로 확정하지 않는다.

복사할 때는 **공통 화풍 블록 + 해당 에셋 블록 + 공통 제외 블록**을 한 요청으로 사용한다. 캐릭터 동작 요청에는 승인한 기준 원화를 반드시 첨부한다. 현재 생성된 검사는 참고 후보이며 사용자가 새 외형을 고르면 그 원화를 기준으로 바꾼다.

## 2. 공통 화풍 블록

```text
Project: MUGONG, a manual-control overhead martial-arts action game.
Visual direction: grounded wuxia, hand-painted brush shading with restrained ink edges, natural adult human anatomy, readable silhouettes at small game scale. Muted earth, stone, bamboo green, ivory cloth and aged metal; restrained red accents. Rich material detail without noisy tiny ornament. Soft consistent daylight from screen upper-left. Characters and combat environments use the SAME fixed elevated three-quarter overhead camera, approximately 40 degrees looking down. No camera roll, no perspective change between animation frames.
Use the supplied reference images for painterly atmosphere and camera direction, not for copying UI text, numerical values, layouts, exact characters or existing game assets.
```

## 3. 공통 제외 블록

```text
No chibi or oversized heads. No modern clothing, sci-fi elements, oversized fantasy weapons, plastic 3D appearance, photorealistic photographic skin, neon outlines or excessive glow. No watermark, signature, logo, labels, captions, embedded UI or written statistics. No cropped hair, hands, feet or weapon tips. No duplicate limbs, detached weapons, extra fingers or changing weapon hand. For transparent assets: actual alpha transparency, no painted checkerboard, no background vignette and no floor baked into the sprite.
```

## 4. P01 — 기준 무인

목적: 얼굴·복장·체격·카메라·주손을 정할 한 장. 현재 흰 도포와 붉은 허리띠는 후보 외형이다. 이 단계에서 사용자가 외형을 바꾸어도 된다.

```text
Asset: one single full-body playable swordsman reference, isolated on actual transparent background.
Young adult martial artist, slender athletic build with natural human proportions. Black hair tied in a practical high ponytail. Worn ivory wrap robe over a charcoal inner tunic and trousers, muted dark red sash, leather wrist wraps, cloth boots. Practical clothing for fast movement, not ceremonial armor.
Fixed elevated overhead three-quarter camera. Face and torso point toward screen southeast. Visible top of head and shoulders, believable foreshortening of the legs. Balanced neutral ready stance with both boots visible.
Hold one modest straight steel jian sword in ONE clearly established anatomical hand. Use the same anatomical weapon hand in every later pose and direction. The free hand is relaxed in guard. Visible contact between hand and grip. Small aged brass crossguard, charcoal wrapped grip, no scabbard on the body for this test.
Include the whole body and sword with generous empty margins. No action trail. One figure only, not a turnaround board or sprite sheet. This image is the identity and camera master for subsequent assets.
```

파일명 예시: `hero_master_se_v1.png`. 고해상도 원본을 받아 실제 게임 표시 크기는 가져올 때 검증한다.

## 5. A01 — 베기 동작 설계

현재 베기는 준비에서 적중으로 이어지는 허리·어깨 회전이 약하고 적중과 마무리 자세가 비슷하다. 다음 제작은 **읽히는 준비 → 빠른 적중 → 분명한 마무리 → 자연스러운 복귀**를 구분한다.

### 자세별 이미지를 만드는 경우

먼저 자세 설계도 한 장을 만든다. 자세 비교용 자료이며 그대로 잘라 쓰는 완성 스프라이트 시트는 아니다.

```text
Asset: a SIX-POSE action study of ONE coherent sword slash, using the attached approved character master as the exact identity reference.
Keep the same face, hair, robe, sash, boots, body proportions, anatomical weapon hand, weapon length, camera and lighting in all poses. Character faces screen southeast throughout. No new character design.
Pose 1 READY: balanced guard, relaxed knees, sword held near the weapon-side hip.
Pose 2 ANTICIPATION: weight settles into the rear leg; hips and shoulders visibly wind back; sword hand draws back beside and above the weapon-side shoulder. Do not only raise the forearm while keeping the torso unchanged.
Pose 3 CONTACT: rear foot pushes; front knee flexes and accepts weight; hips rotate first, shoulders and sword arm follow. The blade cuts diagonally through the forward target area. This pose must have a distinctly different torso rotation and arm extension from anticipation and follow-through.
Pose 4 FOLLOW-THROUGH: blade continues past the contact line; shoulders and hips complete the turn; front foot is planted. Hair and robe trail behind the body rotation. Do not reset to guard immediately.
Pose 5 SETTLE: weight stabilizes; sword slows below the contact line; the free hand restores balance. Less rotation than follow-through, no extra strike.
Pose 6 RECOVERY: return naturally to the original ready pose, with the same footprint and weapon hand.
One attack only. Keep the blade firmly in the same gripping hand. No extra swords, no weapon-hand transfer, no weapon trail or hit effect baked into the poses. Use full bodies, generous space, and consistent body size. Show all six distinct phases without text or labels.
```

자세 설계를 확인한 뒤 같은 여섯 자세를 **한 자세당 한 파일**로 받는다. 중간 프레임 수는 움직임 확인 후 정한다. 여섯 장만 있으면 완성 애니메이션이 된다는 의미는 아니다.

```text
Asset: ONE individual full-body animation key pose, not a sheet.
Use the attached approved character master and approved six-pose action study as references. Render ONLY [POSE NUMBER AND DESCRIPTION] from the approved action. Preserve the exact anatomical weapon hand, face, camera, body scale, costume, blade length and lighting.
Use the same square canvas and the same ground-plane anchor as the other poses. Leave at least 12% transparent safety margin on all sides, enough for the entire weapon in this pose. Do not rescale the body to fit the sword; increase safe canvas space consistently across the set if needed.
Actual transparent alpha. No shadow, labels, slash trail, hit flash or extra pose. Return the original PNG, not a screenshot or compressed chat preview.
```

파일명 예시: `hero_slash_se_key_01.png`부터 `hero_slash_se_key_06.png`까지.

### 영상·애니메이션을 만드는 경우

```text
Animate the attached approved swordsman performing ONE decisive diagonal sword slash toward screen southeast, then returning to the identical ready stance. Locked elevated overhead camera and fixed framing. Preserve identity, natural anatomy, costume, body size and the same anatomical weapon hand throughout.
Clear rhythm: a readable short anticipation with hips winding back; a much faster committed contact driven by rear-foot push and hip rotation; a distinct follow-through with cloth and ponytail lagging; a controlled recovery. Do not move every phase at the same speed. No repeated attack, no idle sword waving, no hand switching, no floating feet, no sliding planted foot, no morphing costume or changing blade length.
Keep the entire body and blade in frame. No camera movement, scene transition, motion blur hiding the anatomy, baked-in sword trail, particles, text or background action. End on the same ready pose as the start. If alpha output is supported, use transparent background. Otherwise use one perfectly uniform plain background with no shadows or texture.
```

원본 영상 또는 연속 이미지와 해상도·FPS를 함께 받는다. 영상을 게임용 투명 스프라이트로 가져오기 위해 프레임 추출·배경 처리가 필요한지 확인한다.

## 6. A02 — 걷기

베기와 같은 기준 원화를 사용한다. 좌우 발이 번갈아 움직이고 접지한 발이 뒤로 미끄러지지 않는지 확인한다.

```text
Asset: a looping WALK cycle for the attached approved character, facing screen southeast with a locked elevated overhead camera.
Preserve the same face, body size, clothing and anatomical weapon hand. Distinct alternating right-leg and left-leg steps: right contact, weight passing over right foot, left contact, weight passing over left foot. Both knees articulate naturally and both boots remain readable beneath the robe. Torso remains stable with subtle vertical movement, not a large bouncing head.
Free arm counter-swings. Weapon arm carries the same sword safely beside the body; no hand switching. Hips and shoulders counter-rotate slightly. Cloth and ponytail follow with restrained lag. The first and final states join smoothly into a loop. No walking backward, running, attack, floating feet, camera movement or costume morphing.
Use the same ground-plane anchor, body scale and transparent canvas safety margins as the approved ready stance. No floor shadow, motion trail, text or labels.
```

이미지 제작에서는 주요 네 자세를 한 장씩, 애니메이션 제작에서는 반복 가능한 루프를 받는다. 이동 속도와 재생 속도는 게임에서 함께 조정한다.

## 7. A03 — 대기·피격·사망

첫 베기와 걷기가 맞은 뒤 제작한다. 동작별로 별도 요청을 보낸다.

| 동작 | 개별 추가 지시 |
|---|---|
| 대기 | `Subtle breathing in balanced ready stance, small chest and shoulder movement, minimal cloth and hair motion. Both feet stay planted. No sword waving. Seamless loop.` |
| 피격 | `One short readable recoil from a frontal hit, torso and shoulders react, one controlled balance correction, same sword stays in the same hand. Return to ready. No blood or VFX baked in.` |
| 사망 | `One readable loss of balance and collapse to the ground, same overhead camera and identity, final prone pose held. No disappearance, dissolution, resurrection or text. Keep any weapon release separately visible and consistent.` |

사망 시 물품 드랍은 게임 처리로 표현하므로 가방이나 많은 전리품을 사망 이미지에 함께 그리지 않는다.

## 8. D01 — 방향 확장

한 방향의 품질을 맞춘 뒤 진행한다. 여덟 방향은 검토 후보이며 최종 방향 수와 애니메이션 방식은 아직 확정하지 않았다.

```text
Using the approved character master, render ONE [DIRECTION] ready pose at the SAME elevated overhead camera pitch, body scale and lighting. Rotate the character in world space; do not rotate the entire flat image on the canvas. Preserve the same anatomical weapon hand, face, hairstyle, costume and sword. Its screen-side hand position may change naturally with the view direction.
Direction is [south / southwest / west / northwest / north / northeast / east / southeast] in screen/world terms. Show correct front, side or back view for this direction. Maintain the same ground-plane anchor and safe transparent margins. One full-body pose, no sheet, no text.
```

단순 좌우 반전만으로 최종 방향 에셋을 대신하지 않는다. 뒷머리·깃·허리띠와 몸 앞뒤의 검 가림 순서를 확인한다.

## 9. W01 — 독립 무기

처음은 실용적인 철검 한 자루다. 창·부채·권갑 등은 이후 무공 검증에 맞춰 추가한다.

```text
Asset: one isolated practical straight jian sword for a grounded wuxia game.
Narrow tapered steel blade with restrained central ridge, small aged brass crossguard, dark wrapped grip and simple pommel. Hand-painted material treatment consistent with the approved character. Entire sword vertical: blade tip at top, pommel at bottom, no perspective tilt. Clear grip area for attaching to a hand in runtime.
Actual transparent alpha, generous margins, no cast shadow, halo, scabbard, hands, character, text or decorative glow. One weapon only. Return original PNG.
```

검과 캐릭터가 함께 그려진 동작은 동작 검토 자료로 사용할 수 있다. 독립 무기로 연결할 경우 **모든 프레임에서 검을 제외하고 쥐는 손 위치를 유지한 몸체 이미지**를 별도로 받는다. 동작 제작 단계에서 분리 여부를 지정한다.

## 10. E01 — 첫 근접 적

플레이어와 축척·시인성을 비교할 한 종류다. 이 요청으로 적 종류와 이름을 확정하지 않는다.

```text
Asset: one full-body ordinary melee opponent for the same overhead wuxia game.
Use the approved player and combat scene as camera, scale and material references. Adult human anatomy, practical weathered dark earth-tone martial clothing, restrained silhouette clearly distinguishable from the ivory-robed player. One modest melee blade, no giant boss body or extravagant armor. Ready stance, facing screen southwest toward the player.
Keep the entire body and weapon inside transparent safety margins. Same light direction and ground-plane perspective as the player. Actual alpha transparency, no ground, shadow, health bar, text, blood or hit effects.
```

적의 걷기·준비·공격·피격·사망도 승인한 적 원화를 기준으로 동작별로 제작한다. 보스는 일반 적의 기준이 맞은 뒤 개별 설계한다.

## 11. B01 — 전투 배경

```text
Asset: one playable wuxia forest clearing environment, with NO characters and NO UI.
Painterly earth path, scattered stones, bamboo and muted wild plants, weathered timber or low stone structures toward the outer edges. Use the same fixed elevated three-quarter overhead camera and soft upper-left daylight as the approved character. Center roughly two-thirds remains open and readable for movement and combat, with restrained ground contrast. Rich edge detail, quieter central floor.
No huge foreground tree obscuring the player, extreme depth of field, exaggerated perspective, forced cinematic close-up, perspective grid, text, health bars, characters, enemies, loot or sword effects. Do not copy the reference scene exactly. Return a clean environment illustration without baked-in gameplay elements.
```

먼저 한 장으로 시점과 색을 검토한다. 지형 판정·레이어·타일화는 별도로 설계하며 배경 한 장을 완성 맵으로 취급하지 않는다.

## 12. F01 — 검흔·적중 효과

각각 별도 출력으로 받는다. 캐릭터나 공격 판정은 함께 그리지 않는다.

```text
Asset: one isolated restrained sword-slash trail for a grounded painterly wuxia action game.
A slender curved white-silver brush arc with tapered beginning and end, subtle cool highlight and transparent falloff. Suggest one quick steel blade sweep, not a huge magical explosion. Viewed in the same overhead ground-plane perspective as the approved combat scene. Leave the center and surrounding area transparent. No sword, hand, person, enemy, terrain, text or opaque rectangular background.
```

```text
Asset: one isolated small impact flash for a melee sword hit.
Compact ivory-white brush burst with a few restrained aged-gold sparks, asymmetric crisp core and soft transparent edge, legible at small game scale. No blood for this initial readability test. Actual transparent alpha. No character, weapon, enemy, ground, text, large explosion or persistent glowing sphere.
```

정지 효과를 원형으로 수명·크기·잔상을 게임에서 검토한다. 영상이라면 한 효과가 나타났다가 사라지는 동작을 별도로 요청한다.

## 13. I01 — 가방·시장 아이템

격자·수량·가격·품질·이름은 UI에서 표시한다. 아이템 이미지에는 넣지 않고 물품별로 개별 생성한다.

```text
Asset: one isolated inventory item illustration: [ITEM DESCRIPTION].
Grounded wuxia materials and hand-painted ink-edged style consistent with the approved weapon and character. Readable whole-object silhouette on actual transparent alpha, soft upper-left light, restrained detail suitable for a small inventory view. No grid, slot frame, background card, label, quantity, price, rarity badge, quality bar, text, shadow halo or extra items.
Object orientation: [ORIENTATION]. Keep the entire object and comfortable padding. Return one item only, not a contact sheet.
```

첫 소재 후보는 기존 컨셉의 무기·의복·신발·장신구·약병·약초·광석·두루마리·비급이다. 구체적 이름과 수량은 채택 목록에 맞춘다. 종류 식별과 가방 안의 축척을 먼저 확인한다.

## 14. U01 — UI 장식 소재

```text
Asset: an EMPTY reusable UI ornament for a painterly wuxia game: [panel frame / corner ornament / separator / button frame].
Ivory parchment, restrained ink-brush accent and subtle aged brass edging, elegant but quiet enough for clear readable UI. Clean empty interior for programmatically rendered text and controls. Ornament should be sparse, consistent in stroke weight and visual scale with the approved inventory reference mood.
No words, numbers, logo, character portrait, item icon, health bar, menus, active controls or assembled full-screen mockup. Return the isolated ornament on actual transparent alpha. If a panel is requested, keep corners and borders clear so it can be adapted for resizing later.
```

글자·수치·버튼 상태·시장 목록은 코드로 만든다. 전투 화면 위에 로비 메뉴를 그리는 이미지는 요청하지 않는다.

## 15. 전달·검수

원본 PNG를 받고 비교용 보드와 게임용 이미지를 구분한다. 채팅 화면 캡처나 비율이 변한 미리보기를 원본 에셋으로 쓰지 않는다.

각 출력에 에셋명·기준 원화·방향·동작 또는 자세·투명 배경 여부를 적는다. 영상·연속 이미지는 FPS도 기록한다. 시안의 작업 캔버스는 정사각형 1024px, 지면 기준점은 `(512, 800)`을 초기 후보로 삼는다. 검 여백이 부족하면 한 세트의 캔버스를 함께 넓힌다. 게임의 고정 픽셀 규격은 아니다.

Codex에서 확인할 항목:

- 얼굴·체격·옷·주손·검 길이·카메라·빛 방향이 유지되는가.
- 검의 쥐기·발 접지·허리와 어깨 회전·적중과 마무리가 읽히는가.
- 투명 배경·머리와 검과 발의 여백·이미지 경계·필요한 파일이 맞는가.
- 원화 크기와 게임 크기에서 각각 읽히는가.
- 실제 이동 속도·공격 타이밍·그리는 순서와 조합할 때 자연스러운가.

맞지 않는 결과는 채택 파일과 구분하고, 고칠 점을 특정한 수정 프롬프트를 하나씩 작성한다.
