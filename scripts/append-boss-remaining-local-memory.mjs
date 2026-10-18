import {readFile,writeFile,mkdir} from 'node:fs/promises';
const vault='C:/Users/user/Documents/AI-Memory/projects/murim-roguelike/murim-roguelike';
const root='docs/obsidian-sync/2026-10-08-boss-remaining-local-v1/notes';await mkdir(root,{recursive:true});
const names=['README.md','project-overview.md','current-status.md','decisions.md','art-and-assets.md','gameplay-systems.md','architecture.md','known-issues.md','backlog.md','worklog-2026-10-08.md'];
const extra='최종 로컬 컴파일 배포본5검사도 통과했다(1.1분). 인덱스/자산 HTTP SHA, 네 지역 새18텍스처 로드·전투 입력·가방 열기/닫기를 독립 컨텍스트에서 확인했다. 사용한 새/재사용133텍스처의 public/dist SHA가 일치했다.1093소림·1440천검산 실제 전투 캡처도 직접 확인했다. 사용자 저장과 공개 배포는 변경하지 않았다.';
for(const name of names){let s=await readFile(vault+'/'+name,'utf8');
 if(name.startsWith('worklog-'))s+='\n\n### 나머지41행동의 로컬 배포본 최종 확인\n\n'+extra+'\n';
 else{const marker='1800kB 초과 번들 경고는 남는다.';const p=s.indexOf(marker);if(p<0)throw Error('Latest checkpoint missing '+name);s=s.slice(0,p+marker.length)+'\n\n'+extra+s.slice(p+marker.length);}
 await writeFile(root+'/'+name,s);
}
console.log('Prepared10 local-check addenda; all previous content preserved.');
