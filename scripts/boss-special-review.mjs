import { readFile, writeFile } from 'node:fs/promises';
import { bossMotionClock } from '../src/game/boss-motion.ts';
const family = process.argv[2] ?? 'shaolin';
const draft = process.argv.includes('--draft');
if (!['shaolin', 'tianjian', 'dokmu', 'qingha', 'snow', 'desert', 'hyeolma', 'zhuge'].includes(family))
  throw new Error('Unknown family');
const title = {
  shaolin: '소림',
  tianjian: '천검산',
  dokmu: '독무곡',
  qingha: '청하현',
  snow: '설산',
  desert: '서역사막',
  hyeolma: '혈마전',
  zhuge: '팔진고성',
}[family];
const art = JSON.parse(await readFile(draft ? `public/art/${family}-special-v1/frames-draft.json` : `src/game/${family}-special-frames.json`));
const base = JSON.parse(await readFile(`src/game/${family}-family-frames.json`));
// Read timing from the same production kit, never a separate preview multiplier.
const kitPaths = {
  shaolin: 'src/domain/boss-melee.ts',
  tianjian: 'src/domain/boss-wave3.ts',
  dokmu: 'src/domain/boss-wave5.ts',
  qingha: 'src/domain/boss-melee.ts',
  snow: ['src/domain/boss-wave3.ts', 'src/domain/boss-wave5.ts'],
  desert: ['src/domain/boss-wave4.ts', 'src/domain/boss-wave5.ts', 'src/domain/boss-melee.ts'],
  hyeolma: ['src/domain/boss-wave4.ts', 'src/domain/boss-wave5.ts'],
  zhuge: ['src/domain/boss-wave4.ts', 'src/domain/boss-wave5.ts'],
}[family];
const kit = (await Promise.all([kitPaths].flat().map((path) => readFile(path, 'utf8')))).join('\n');
const timings = {};
for (const a of art.characters) {
  const block = kit.split(`'${a.bossId}': {`)[1].split(/\n  '\d-\d':/)[0];
  timings[a.bossId] = {};
  for (const move of a.moves) {
    const spec = block.split(new RegExp(`${move}: (?:punch|a)\\(`))[1].split('}),')[0];
    const value = (key, fallback) =>
      Number(spec.match(new RegExp(key + ': ([\\d.]+)'))?.[1] ?? fallback);
    timings[a.bossId][move] = {
      name: spec.match(/^'([^']+)'/)?.[1] ?? move,
      holdEligible: move === 'grab' || /mechanic: 'stance'/.test(spec),
      windup: value('windup', 0.62),
      duration: value('duration', 0.32),
      recovery: value('recovery', 0.46),
      contacts: JSON.parse('[' + (spec.match(/contacts: \[([^\]]+)\]/)?.[1] ?? '0.1') + ']'),
    };
  }
}
if (family === 'desert' || family === 'hyeolma' || family === 'zhuge') {
  const preflight = JSON.parse(await readFile(`docs/source/${family}-special-v1/preflight.json`));
  for (const t of preflight.timings) timings[t.bossId][t.move] = t;
}
await writeFile(
  `public/art/${family}-special-v1/review.html`,
  `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} 보스 특별 모션</title>
<style>body{margin:0;background:#ede6d5;color:#203b30;font:17px system-ui}main{max-width:1400px;margin:auto;padding:20px}h1{font-size:28px}nav{display:flex;gap:12px;flex-wrap:wrap;align-items:center}button,select{font:inherit;padding:9px;background:#fff9eb;color:#203b30;border:1px solid #967b46;border-radius:6px}button:focus-visible,select:focus-visible{outline:3px solid #377667;outline-offset:2px}#grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:18px 0}.card{background:#faf4e5;border:1px solid #b5a681;border-radius:8px;padding:8px;text-align:center}canvas{width:100%;height:auto}p{line-height:1.6}#phase{min-height:28px}@media(max-width:900px){#grid{grid-template-columns:repeat(2,minmax(0,1fr))}}</style>
<main><h1>${title} 보스 특별 모션</h1><p>왼쪽은 기본 대기, 오른쪽은 특별 모션입니다. 같은 원본 배율로 비교합니다. 준비 → 힘 싣기 → 판정 → 후속 → 회수 → 대기.</p><nav><label>보스 <select id="character"></select></label><label>패턴 <select id="move"></select></label><button id="pause">일시 정지</button><button id="next">다음 프레임</button><label><input id="hold" type="checkbox">잡기·방어 유지</label></nav><p id="phase" aria-live="polite"></p><div id="grid"></div><p>빨간 표시는 실제 접촉 순간입니다. 발 접지점과 HP바 기준은 고정됩니다.</p></main>
<script>const ART=${JSON.stringify(art)},BASE=${JSON.stringify(base)},TIMING=${JSON.stringify(timings)},clock=${bossMotionClock.toString()};
const names=${JSON.stringify({ shaolin: ['파계승 공허', '철나한 도원', '금강두타 불명', '폐사주지 무진'], tianjian: ['낙검객 우진', '쌍검 백홍', '검귀 무명', '천검노인 백운'], dokmu: ['청린사왕', '독의 묵칠', '오독낭자 연화', '만독곡주 사공염'], qingha: ['흑풍채주 마대봉', '청하표두 노진', '백면포두 철무', '하북패도 한무극'], snow: ['설원창객 목진', '빙잠녀 설란', '백설노괴', '빙궁주 한설'], desert: ['황사도적왕 아사르','쌍환무희 나야','흑사마승 발타','대막도왕 아르칸'], hyeolma: ['혈도객 적우','혈마제자 연살','홍의마녀 소홍','혈마교주 적천'], zhuge: ['개문수 양기','기관사 묵연','팔문장군 진괄','팔진노사 제갈현'] }[family])},moves={slam:'진각',dash:'어깨 돌진',grab:'철완 포획',stance:'반격 방어',bell:'범종 타격',combo:'연환봉',fan:'일선 검기',sweep:'회전 베기'};
const directions=[2,1,0,1,2,3,4,3],flip=[false,false,false,true,true,true,false,false],labels=['동','남동','남','남서','서','북서','북','북동'];
const displayScale=.8,shownBase=BASE.characters.filter(b=>ART.characters.some(a=>a.id===b.id));
const shownFrames=[...ART.characters.flatMap(a=>a.frames),...shownBase.flatMap(a=>a.frames.filter(f=>f.kind==='locomotion'&&f.pose===0))];
const reach=Math.ceil(Math.max(...shownFrames.flatMap(f=>[Math.abs(f.bounds.left-f.footX),Math.abs(f.bounds.right-f.footX)]))*displayScale),baseX=reach+32,specialX=baseX+2*reach+64,canvasWidth=specialX+reach+32;
const baseline=Math.ceil(Math.max(...shownFrames.map(f=>(f.footY-f.bounds.top)*displayScale),...[...ART.characters,...shownBase].map(a=>a.healthClearance/a.pixelScale*displayScale)))+32,canvasHeight=baseline+Math.ceil(Math.max(0,...shownFrames.map(f=>(f.bounds.bottom-f.footY)*displayScale)))+32;
const images=new Map(),character=document.querySelector('#character'),move=document.querySelector('#move'),hold=document.querySelector('#hold');
let time=0,running=!matchMedia('(prefers-reduced-motion:reduce)').matches,last=performance.now();
ART.characters.forEach((a,i)=>character.add(new Option(names[i],String(i))));
function choose(){move.replaceChildren();ART.characters[+character.value].moves.forEach(m=>move.add(new Option(TIMING[ART.characters[+character.value].bossId][m].name,m)));time=0;resetHold()}function resetHold(){hold.checked=false;hold.disabled=!TIMING[ART.characters[+character.value].bossId][move.value].holdEligible}choose();character.onchange=choose;move.onchange=()=>{time=0;resetHold()};
const canvases=labels.map(l=>{const box=document.createElement('div');box.className='card';const label=document.createElement('div');label.textContent=l;const c=document.createElement('canvas');c.width=canvasWidth;c.height=canvasHeight;box.append(label,c);document.querySelector('#grid').append(box);return c});
for(const family of [ART,BASE])for(const a of family.characters)for(const f of a.frames)if(!images.has(f.texture)){const im=new Image();im.src=(family===ART?'/art/${family}-special-v1/':'/art/${family}-family-v1/')+f.texture.replace(family===ART?'${family}-special-':'${family}-family-','')+'.webp';images.set(f.texture,im)}
const pause=document.querySelector('#pause');function pauseLabel(){pause.textContent=running?'일시 정지':'재생'}pauseLabel();pause.onclick=()=>{running=!running;pauseLabel()};document.querySelector('#next').onclick=()=>{running=false;pauseLabel();time+=.06};
function drawFrame(ctx,f,x,flipped){const image=images.get(f.texture);if(!image?.complete)return;const scale=displayScale;ctx.save();ctx.translate(x,baseline);ctx.scale(flipped?-1:1,1);ctx.drawImage(image,f.x,f.y,f.width,f.height,-f.footX*scale,-f.footY*scale,f.width*scale,f.height*scale);ctx.restore()}
function tick(now){if(running)time+=Math.min(.05,(now-last)/1000);last=now;const a=ART.characters[+character.value],m=move.value,t=TIMING[a.bossId][m],total=t.windup+t.duration+t.recovery+.25,age=time%total;let action,p;if(age<t.windup){action='windup';p=age/t.windup}else if(age<t.windup+t.duration){action='strike';p=(age-t.windup)/t.duration}else{action='recover';p=Math.min(1,(age-t.windup-t.duration)/t.recovery)}const motion=clock(m,action,p,t,hold.checked&&t.holdEligible);document.querySelector('#phase').textContent=t.name+' · '+({prepare:'준비',load:'힘 싣기',contact:'판정',follow:'후속',return:'회수',ready:'대기',hold:'유지'})[motion.phase]+' · '+(motion.pose+1)+'/6'+(motion.contact>=0?' · '+(motion.contact+1)+'번째 접촉':'');
canvases.forEach((c,d)=>{const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.strokeStyle='#aa9670';ctx.beginPath();ctx.moveTo(0,baseline);ctx.lineTo(c.width,baseline);ctx.stroke();const native=BASE.characters.find(b=>b.id===a.id),before=native.frames.find(f=>f.view===directions[d]&&f.kind==='locomotion'&&f.pose===0),f=a.frames.find(f=>f.view===directions[d]&&f.move===m&&f.pose===motion.pose);drawFrame(ctx,before,baseX,flip[d]);drawFrame(ctx,f,specialX,flip[d]);ctx.fillStyle=motion.phase==='contact'?'#b94330':'#365c48';ctx.fillRect(specialX-25,baseline-Math.max(a.healthClearance,native.healthClearance)/a.pixelScale*displayScale,50,5)});requestAnimationFrame(tick)}requestAnimationFrame(tick);
</script></html>`,
);
console.log(JSON.stringify(timings));

