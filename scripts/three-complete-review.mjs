import {readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {bossMotionClock} from '../src/game/boss-motion.ts';
import {bossMotionCycle} from '../src/game/boss-motion-cycle.ts';
const old=JSON.parse(await readFile('src/game/three-special-frames.json')),extra=JSON.parse(await readFile('src/game/three-complete-frames.json'));
const art={textures:{...old.textures,...extra.textures},characters:old.characters.map(a=>{const b=extra.characters.find(b=>b.id===a.id);return {...a,moves:[...a.moves,...b.moves],frames:[...a.frames,...b.frames],healthClearance:Math.max(a.healthClearance,b.healthClearance)}})};
const bases={};for(const f of ['desert','hyeolma','zhuge'])bases[f]=JSON.parse(await readFile(`src/game/${f}-family-frames.json`));
const bundle=await build({entryPoints:['src/domain/combat.ts'],bundle:true,platform:'node',format:'esm',write:false});
let timings={};
try {
 const {enemyAttack}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
 for(const a of art.characters) {
  timings[a.bossId]={};
  for(const move of a.moves){const p=enemyAttack({kind:'chief',bossId:a.bossId,move,pattern:0});timings[a.bossId][move]={...p.melee,windup:p.windup,recovery:p.recovery};}
 }
} finally {}
await writeFile('public/art/three-complete-v3/review.html',`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>서역사막·혈마전·제갈 전체 행동</title>
<style>body{margin:0;background:#ede6d5;color:#203b30;font:16px system-ui}main{max-width:1440px;margin:auto;padding:20px}h1{font-size:26px}nav{display:flex;gap:12px;flex-wrap:wrap;align-items:center}button,select{font:inherit;padding:9px;background:#fff9eb;color:#203b30;border:1px solid #967b46;border-radius:6px}button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid #2b7886;outline-offset:2px}#grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0}.card{background:#faf4e5;border:1px solid #b5a681;border-radius:8px;padding:8px;text-align:center}canvas{width:100%;height:auto}p{line-height:1.6}#phase{min-height:28px}@media(max-width:1100px){#grid{grid-template-columns:repeat(2,minmax(0,1fr))}}</style>
<main><h1>서역사막·혈마전·제갈 전체 행동</h1><p>12보스·55행동 게임 적용본입니다. 왼쪽은 기본 대기, 오른쪽은 특별 자세입니다. 준비·접촉·복귀는 실제 공격 시간에 연결됩니다.</p><nav><label>보스 <select id="character"></select></label><label>행동 <select id="move"></select></label><button id="play">재생</button><button id="next">다음 자세</button><label>자세 <select id="pose"></select></label><label>연격 <select id="cycle"><option value="0">첫 타격</option><option value="1">두 번째</option><option value="2">세 번째</option></select></label></nav><p id="phase" aria-live="polite"></p><div id="grid"></div><p>확대 비교 화면입니다. 게임 배율은 고정 0.225이며 원화의 가로세로 비율을 유지합니다. 기존 주요 24행동과 추가 31행동을 함께 표시합니다. 연격은 각 타격을 따로 선택할 수 있습니다.</p></main>
<script>const ART=${JSON.stringify(art)},BASE=${JSON.stringify(bases)},TIMING=${JSON.stringify(timings)},clock=${bossMotionClock.toString()},chooseCycle=${bossMotionCycle.toString()};
const names=['아사르','나야','발타','아르칸','저구','연살','소홍','적천','양기','묵연','진괄','제갈현'],views=[2,1,0,1,2,3,4,3],flips=[0,0,0,1,1,1,0,0],labels=['동','남동','남','남서','서','북서','북','북동'],stages=['준비','힘 싣기','접촉','후속','회수','대기'];
const $=s=>document.querySelector(s),actor=$('#character'),move=$('#move'),pose=$('#pose'),cycle=$('#cycle'),play=$('#play');
ART.characters.forEach((a,n)=>actor.add(new Option(names[n],n)));stages.forEach((p,n)=>pose.add(new Option(p,n)));let running=false,time=0,last=performance.now();
function choose(){move.replaceChildren();ART.characters[+actor.value].moves.forEach(m=>move.add(new Option(TIMING[ART.characters[+actor.value].bossId][m].name,m)));time=0;pose.value='0';resetCycles()}function resetCycles(){cycle.replaceChildren();const t=TIMING[ART.characters[+actor.value].bossId][move.value];t.contacts.forEach((_,n)=>cycle.add(new Option((n+1)+'번째 타격',n)))}choose();actor.onchange=choose;move.onchange=()=>{time=0;pose.value='0';resetCycles()};
function stop(){running=false;play.textContent='재생'}play.onclick=()=>{running=!running;play.textContent=running?'정지':'재생'};pose.onchange=stop;cycle.onchange=stop;$('#next').onclick=()=>{stop();pose.value=String((+pose.value+1)%6)};
const canvases=labels.map(label=>{const card=document.createElement('div');card.className='card';const t=document.createElement('div');t.textContent=label;const c=document.createElement('canvas');c.width=1200;c.height=520;card.append(t,c);$('#grid').append(card);return c}),images=new Map();
let imageRevision=0,paintKey=""; function image(f,a){if(!images.has(f.texture)){const im=new Image();im.onload=()=>imageRevision++;im.src=ART.textures[f.texture]??('/art/'+a.family+'-family-v1/'+f.texture.replace(a.family+'-family-','')+'.webp');images.set(f.texture,im)}return images.get(f.texture)}
function draw(ctx,f,a,x,flip){const im=image(f,a);if(!im.complete||!im.naturalWidth)return;ctx.save();ctx.translate(x,430);ctx.scale(flip?-.5:.5,.5);ctx.drawImage(im,f.x,f.y,f.width,f.height,-f.footX,-f.footY,f.width,f.height);ctx.restore()}
function tick(now){if(running)time+=Math.min(.05,(now-last)/1200);last=now;const a=ART.characters[+actor.value],m=move.value,t=TIMING[a.bossId][m];let p=+pose.value,c=+cycle.value;
if(running){const total=t.windup+t.duration+t.recovery+.2,age=time%total;let action,progress;if(age<t.windup){action='windup';progress=age/t.windup}else if(age<t.windup+t.duration){action='strike';progress=(age-t.windup)/t.duration}else{action='recover';progress=Math.min(1,(age-t.windup-t.duration)/t.recovery)}const motion=clock(m,action,progress,t);p=motion.pose;c=chooseCycle(motion,action,progress,t);pose.value=String(p);cycle.value=String(c)}
$('#phase').textContent=names[+actor.value]+' · '+t.name+' · '+stages[p]+' · '+(c+1)+'번째 타격';
const key=[actor.value,m,p,c,imageRevision].join("/");if(key!==paintKey){paintKey=key;canvases.forEach((canvas,d)=>{const ctx=canvas.getContext('2d');ctx.clearRect(0,0,1200,520);ctx.strokeStyle='#b7a77f';ctx.beginPath();ctx.moveTo(0,430);ctx.lineTo(1200,430);ctx.stroke();const b=BASE[a.family].characters.find(b=>b.id===a.id),ready=b.frames.find(f=>f.view===views[d]&&f.kind==='locomotion'&&f.pose===0),f=a.frames.find(f=>f.name===views[d]+'-'+m+'-cycle-'+c+'-'+p)??a.frames.find(f=>f.name===views[d]+'-'+m+'-'+p);draw(ctx,ready,a,300,flips[d]);draw(ctx,f,a,900,flips[d]);ctx.fillStyle='#b94330';ctx.fillRect(875,430-a.healthClearance/a.pixelScale*.5,50,5)});}requestAnimationFrame(tick)}requestAnimationFrame(tick);
matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',e=>{if(e.matches)stop()});</script></html>`);
console.log('three-complete-v3/review.html generated from current production timing');
