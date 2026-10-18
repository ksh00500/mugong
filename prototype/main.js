const canvas = document.querySelector('#stage');
const ctx = canvas.getContext('2d');
const $ = (selector) => document.querySelector(selector);
const W = canvas.width, H = canvas.height;
const labels = {idle:'대기', walk:'걷기', slash:'베기'};
const urls = {walk:'../assets/hero/walk-body-v1.png', slash:'../assets/hero/slash-body-v1.png', sword:'../assets/weapons/jian-v1.png'};
const images = {};
const keys = new Set();
const actor = {x:W/2,y:H*.61};
let action = 'idle', frame = 0, clock = 0, previous = 0, paused = false, scale = .24;
let controlled = false, attacking = false, aim = Math.PI/4;
const poses = {
  walk: [
    {rect:[0,0,520,756],foot:[278,635],hand:[420,402],angle:135},
    {rect:[520,0,520,756],foot:[257,635],hand:[400,322],angle:135},
    {rect:[1040,0,520,756],foot:[276,635],hand:[406,402],angle:135},
    {rect:[1560,0,519,756],foot:[260,635],hand:[407,323],angle:135}
  ],
  slash: [
    {rect:[0,0,543,724],foot:[270,625],hand:[279,37],angle:104},
    {rect:[543,0,543,724],foot:[270,625],hand:[383,399],angle:132},
    {rect:[1086,0,543,724],foot:[270,625],hand:[412,464],angle:139},
    {rect:[1629,0,543,724],foot:[270,625],hand:[400,437],angle:135}
  ]
};

function setAction(next, manual=false) {
  const changed = action !== next;
  if (changed) { action=next; frame=0; clock=0; }
  if (manual) { controlled=false; attacking=false; keys.clear(); }
  if (!changed && !manual) return;
  document.querySelectorAll('[data-action]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.action===action)));
  updateStatus();
}
function updateStatus() {
  $('#action-name').textContent=labels[action];
  $('#frame-count').textContent=`${action==='idle'?1:frame+1} / ${action==='idle'?1:4}`;
  canvas.setAttribute('aria-label',`검사 조작 공간. 현재 ${action==='idle'?'대기':action==='walk'?'걷기':'베기'}, 프레임 ${action==='idle'?1:frame+1}. 위치 ${Math.round(actor.x)}, ${Math.round(actor.y)}. WASD 이동, 클릭 또는 스페이스 베기.`);
}
function setPaused(value){paused=value;$('#play').textContent=value?'재생':'멈추기';$('#play').setAttribute('aria-pressed',String(value));}
function attack(){controlled=true;attacking=true;setAction('slash');frame=0;clock=0;setPaused(false);}
function reset(){actor.x=W/2;actor.y=H*.61;keys.clear();controlled=false;attacking=false;setAction('idle');}
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{setAction(b.dataset.action,true);setPaused(false);}));
$('#play').addEventListener('click',()=>setPaused(!paused));
for(const [id,delta] of [['prev',-1],['next',1]]) $( `#${id}`).addEventListener('click',()=>{setPaused(true);frame=(frame+delta+4)%4;clock=0;updateStatus();});
$('#scale').addEventListener('change',e=>{scale=Number(e.target.value);});
canvas.addEventListener('pointerdown',e=>{const b=canvas.getBoundingClientRect();aim=Math.atan2((e.clientY-b.top)*H/b.height-actor.y,(e.clientX-b.left)*W/b.width-actor.x);canvas.focus();attack();});
const movementKeys=['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
canvas.addEventListener('keydown',e=>{if(movementKeys.includes(e.key)){e.preventDefault();keys.add(e.key);controlled=true;setPaused(false);}if(e.code==='Space'){e.preventDefault();if(!e.repeat)attack();}if(e.key.toLowerCase()==='r')reset();});
window.addEventListener('keyup',e=>keys.delete(e.key));
function loseFocus(){keys.clear();if(controlled&&!attacking)setAction('idle');}
window.addEventListener('blur',loseFocus);canvas.addEventListener('blur',loseFocus);
document.addEventListener('visibilitychange',()=>{if(document.hidden){loseFocus();previous=0;}});

// Seeded, code-drawn practice floor. No production environment art is implied.
const ground=document.createElement('canvas');ground.width=W;ground.height=H;
const g=ground.getContext('2d');
let seed=71;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
g.fillStyle='#657462';g.fillRect(0,0,W,H);
const earth=g.createRadialGradient(W*.5,H*.5,90,W*.5,H*.5,W*.6);earth.addColorStop(0,'#b7aa87');earth.addColorStop(.75,'#859077');earth.addColorStop(1,'#435c4c');g.fillStyle=earth;g.fillRect(0,0,W,H);
for(let i=0;i<5000;i++){g.fillStyle=random()>.5?'#e0d2a321':'#253d2c21';const x=random()*W,y=random()*H;g.fillRect(x,y,random()*4+1,random()*2+1);}
for(let i=0;i<90;i++){const x=random()*W,y=random()*H;if(x>120&&x<W-120&&y>90&&y<H-90)continue;g.fillStyle='#354e37';g.beginPath();g.ellipse(x,y,random()*24+5,random()*12+4,random()*3,0,Math.PI*2);g.fill();}
g.strokeStyle='#e6dabc24';g.lineWidth=1;for(let x=0;x<W;x+=80){g.beginPath();g.moveTo(x,0);g.lineTo(x,H);g.stroke();}for(let y=10;y<H;y+=40){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke();}

function drawActor(){
  const state=action==='walk'?'walk':'slash';
  const pose=poses[state][action==='idle'?3:frame];
  const [sx,sy,sw,sh]=pose.rect;
  const x=actor.x-pose.foot[0]*scale, y=actor.y-pose.foot[1]*scale;
  ctx.fillStyle='#263b3066';ctx.beginPath();ctx.ellipse(actor.x,actor.y-4,35*scale/.24,10*scale/.24,0,0,Math.PI*2);ctx.fill();
  ctx.drawImage(images[state],sx,sy,sw,sh,x,y,sw*scale,sh*scale);
  const hx=x+pose.hand[0]*scale,hy=y+pose.hand[1]*scale;
  // The grip is the rotation pivot. Body and weapon remain separate originals.
  const swordScale=scale*.31;
  ctx.save();ctx.translate(hx,hy);ctx.rotate(pose.angle*Math.PI/180);
  ctx.drawImage(images.sword,-512*swordScale,-1265*swordScale,1024*swordScale,1536*swordScale);ctx.restore();
  // Render the original hand region above the grip for correct occlusion.
  const rx=pose.hand[0]-18,ry=pose.hand[1]-19;
  ctx.drawImage(images[state],sx+rx,ry,36,38,x+rx*scale,y+ry*scale,36*scale,38*scale);
  if($('#anchors').checked){ctx.lineWidth=2;ctx.strokeStyle='#e6c56b';ctx.beginPath();ctx.arc(hx,hy,6,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#d5efe1';ctx.beginPath();ctx.arc(actor.x,actor.y,6,0,Math.PI*2);ctx.stroke();}
  if(controlled){ctx.strokeStyle='#e2d9b68c';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(actor.x,actor.y);ctx.lineTo(actor.x+Math.cos(aim)*60,actor.y+Math.sin(aim)*35);ctx.stroke();}
}
function tick(now){
  const dt=previous?Math.min((now-previous)/1000,.05):0;previous=now;
  if(!paused){
    if(controlled){const dx=Number(keys.has('d')||keys.has('ArrowRight'))-Number(keys.has('a')||keys.has('ArrowLeft'));const dy=Number(keys.has('s')||keys.has('ArrowDown'))-Number(keys.has('w')||keys.has('ArrowUp'));const length=Math.hypot(dx,dy);const speed=$('#slow').checked?.4:1;if(length&&!attacking){aim=Math.atan2(dy,dx);actor.x=Math.max(90,Math.min(W-90,actor.x+dx/length*155*dt*speed));actor.y=Math.max(195,Math.min(H-90,actor.y+dy/length*100*dt*speed));setAction('walk');}else if(!attacking)setAction('idle');}
    const duration=(action==='slash'?.12:.16)*($('#slow').checked?2.5:1);
    if(action!=='idle'){clock+=dt;if(clock>=duration){clock-=duration;frame=(frame+1)%4;if(frame===0&&attacking){attacking=false;setAction('idle');}updateStatus();}}
  }
  ctx.clearRect(0,0,W,H);ctx.drawImage(ground,0,0);drawActor();requestAnimationFrame(tick);
}
Promise.all(Object.entries(urls).map(([name,url])=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{images[name]=image;resolve();};image.onerror=()=>reject(new Error(`${name} 에셋을 불러올 수 없습니다.`));image.src=url;}))).then(()=>{$('#loading').hidden=true;updateStatus();requestAnimationFrame(tick);}).catch(e=>{$('#loading').textContent=e.message;console.error(e);});
