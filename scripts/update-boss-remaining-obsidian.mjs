import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const vault='C:/Users/user/Documents/AI-Memory/projects/murim-roguelike/murim-roguelike';
const bundle='docs/obsidian-sync/2026-10-08-boss-remaining-v1',root=bundle+'/notes';
await mkdir(root,{recursive:true});
const names=['README.md','project-overview.md','current-status.md','decisions.md','art-and-assets.md','gameplay-systems.md','architecture.md','known-issues.md','backlog.md'];
const docs='file:///C:/Users/user/Documents/ChatGPT/MUGONG/docs/';
const scope='소림8·천검산11·독무곡10·청하현12개,16보스의 나머지41행동을 게임에 연결하고 로컬에 적용했다. 네 지역의 실제 kit73행동 모두 행동별 시퀀스를 갖는다. 설산 목진2행동을 포함한 현재 게임 등록은17보스75행동/2,610논리 프레임이다. 다른 지역의 특별 검토 시안을 등록한 것으로 해석하지 않는다.';
const art='내장 imagegen 선택18시트/방향별 새 접촉90그림을 제작했다. 기존 준비·힘 싣기·회수와 새 접촉/접촉 유지 후속을 조합해 추가1,590논리 프레임을 만들었으며,1,590장을 새로 생성했다는 뜻이 아니다. 실제 연격의 매 접촉은 독립6단계 시퀀스로 전환한다. 공허 잘못된 왼손, 청린 뒤쪽 검 방향, 무명 잔상 인물의 찌르기 재사용을 교정했다.';
const sizes='이번 새 출력은 생성 시트의 READY를 기존 남향 READY에 맞추는 시트 전체의 단일 정규화다. 원본 PNG를 보존하고 같은 배율을5시점에 적용했으며 개별 자세 맞춤 축소는 없다. 따라서 새 접촉 출력은 생성 원본 RGBA1:1가 아니다.32px 패딩·90장화 기준점·고정 전투0.225·인물별 고정 HP바 간격을 사용한다. 기존 준비/회수 그림의 세부 원근·관절·손 전환 미술은 후속 검토다.';
const checks='이번 타입·분리 빌드186모듈/20.77초·단위9검사를 통과했다. 네 지역 Canvas/WebGL×일반/움직임 줄이기16검사 후 바뀐 천검산·독무곡8검사를 다시 통과했고 최신16구성52,864렌더 표본이다. 비교 UI3해상도984조작·키보드/재생/초점 검사와21로컬 art 파일 SHA가 통과했다.4지역 판정 캡처·1093비교 화면을 직접 검토했다. 초기 테스트 서버 준비 시간 초과와 비교 화면 빠른 전환 오류는 실패/수정/재실행을 별도 기록했다.1800kB 초과 번들 경고는 남는다.';
const limits='피해·CC·추격 AI·판정 시간·실제 저장은 바꾸지 않았다. 로컬 게임/비교 화면에 적용했고 공개 배포는 실행하지 않았다. 제갈의 기본 방향·몸 치수·손·접지 교정, 혈마전·서역사막의 적용 전 교정, 설산 나머지3·죽림·고묘의 미완성 특별 원화는 그대로 남아 있다. 과거 생성429 기록을 이번 한도 실패로 해석하지 않는다.';
const evidence='[이번 구현]('+docs+'boss-remaining-v1.md) · [자동/직접 검증]('+docs+'verification/boss-remaining-v1/README.md) · [원본·선택·배율]('+docs+'source/boss-remaining-v1/provenance.json) · [실제 완료 범위]('+docs+'source/boss-remaining-v1/completion.json)';
const expected=[];
for(const name of names){
 const prior=await readFile(vault+'/'+name,'utf8');expected.push({name,sha256:createHash('sha256').update(prior).digest('hex')});
 let s=prior.replace(/as_of: '[^']+'/,'as_of: \'2026-10-08\'').replaceAll('## 현재 작업 — 제갈 특별 원화 두 번째 교정','## 이전 작업 — 제갈 특별 원화 두 번째 교정');
 if(name==='backlog.md'){
  s=s.replace(/\| 소림의 나머지 행동[^\n]+/,'| 소림의 나머지8행동 | 게임 연결·로컬 적용 완료. 기존+새 접촉 시퀀스, 실제 접촉별 검증 |');
  s=s.replace(/\| 천검산 나머지11행동[^\n]+/,'| 천검산 나머지11행동 | 게임 연결·로컬 적용 완료. 무명 찌르기/횡소 전용 원화 포함 |');
  s=s.replace(/\| 독무곡 나머지10행동[^\n]+/,'| 독무곡 나머지10행동 | 게임 연결·로컬 적용 완료. 검/술병/역손 부채/지팡이 접촉 포함 |\n| 청하현 나머지12행동 | 게임 연결·로컬 적용 완료. 진각/지면 타격·연격 차수 연결 |');
  s=s.replace('청하현 나머지12행동은 기존 기본 원화를 재사용하며 추가 전용 자세가 남아 있다.','2026-10-08 갱신: 청하현 나머지12행동도 연결했다. 위 표의 완료 행을 다음 제작 후보로 반복 선택하지 않는다.');
 }
 const front=s.indexOf('---',4)+3,heading=s.indexOf('\n# ',front),end=s.indexOf('\n',heading+1);
 if(end<0)throw Error('Heading missing '+name);
 s=s.slice(0,end)+'\n\n## 현재 작업 — 네 지역 보스 나머지41행동 적용\n\n2026-10-08. '+scope+'\n\n'+art+'\n\n'+sizes+'\n\n'+checks+'\n\n'+limits+'\n\n'+evidence+'. 이전 제갈 교정과 기존 제작/미완료 기록을 보존한다.\n\n'+s.slice(end);
 await writeFile(root+'/'+name,s);
}
const name='worklog-2026-10-08.md',daily=await readFile(vault+'/'+name,'utf8');expected.push({name,sha256:createHash('sha256').update(daily).digest('hex')});
await writeFile(root+'/'+name,daily+'\n\n## 네 지역 보스의 나머지41행동 구현·로컬 적용\n\n'+scope+'\n\n'+art+'\n\n'+sizes+'\n\n'+checks+'\n\n'+limits+'\n\n'+evidence+'.\n');
await writeFile(bundle+'/staging-source-hashes.json',JSON.stringify(expected,null,2)+'\n');
for(const e of expected)if(createHash('sha256').update(await readFile(vault+'/'+e.name)).digest('hex')!==e.sha256)throw Error('Concurrent source edit '+e.name);
console.log(JSON.stringify({prepared:10,sourceHashes:expected.length,publicDeployment:false}));
