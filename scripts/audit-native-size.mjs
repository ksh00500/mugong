// Offline comparison only: no production image/metadata edits. Bounds are triage,
// not a body-size measurement (weapons, leaning and falling change silhouettes).
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const sharp = createRequire(import.meta.url)(process.env.MUGONG_SHARP_PATH ?? 'sharp');
const out = 'docs/verification/native-size-review-v1' + (process.argv.includes('--after') ? '/after' : '');
await mkdir(out, { recursive: true });
const read = async (name) => JSON.parse(await readFile(`src/game/${name}-frames.json`, 'utf8'));
const families = ['qingha', 'dokmu', 'tianjian', 'snow', 'shaolin', 'bamboo', 'tomb', 'desert', 'hyeolma', 'zhuge'];
const banks = ['shaolin-special', 'tianjian-special', 'dokmu-special', 'qingha-special', 'snow-special', 'snow-special-complete', 'boss-remaining', 'three-special', 'three-complete', 'tomb-bamboo-special', 'tomb-bamboo-complete'];
const index = JSON.parse(await readFile('src/platform/region-art-manifests.json', 'utf8'));
const textures = Object.assign({}, ...index.regions.map(r => r.all));
const base = await Promise.all(families.map(f => read(f+'-family')));
base[4].characters.push({ ...await read('shaolin-staff'), id: 'staff', slot: 1 });
const extra = await Promise.all(banks.map(read));
const cache = new Map();
async function sprite(f, scale) {
  const key = [f.texture, f.x, f.y, f.width, f.height, scale].join('/');
  if (!cache.has(key)) cache.set(key, sharp('public' + textures[f.texture]).extract({left:f.x,top:f.y,width:f.width,height:f.height}).resize(Math.round(f.width*scale),Math.round(f.height*scale)).png().toBuffer());
  return cache.get(key);
}
async function board(path, rows, scale = .45, cw = 340, ch = 280) {
  const cols = Math.max(...rows.map(r => r.length)), parts = [];
  for (const [y, row] of rows.entries()) for (const [x, {f,label}] of row.entries()) {
    const left = 180+x*cw+Math.round(cw/2)-Math.round(f.footX*scale), top = 100+y*ch+ch-43-Math.round(f.footY*scale);
    if(left<0||top<0) throw Error(`Board padding too small: ${label}`);
    parts.push({input:await sprite(f,scale),left,top});
    parts.push({input:Buffer.from(`<svg width="${cw}" height="${ch}"><path d="M0 ${ch-43}H${cw}" stroke="#b5ac95"/><circle cx="${Math.round(cw/2)}" cy="${ch-43}" r="2" fill="#c43131"/><text x="5" y="${ch-18}" font-family="monospace" font-size="13" fill="#20382d">${label.replaceAll('&','&amp;').replaceAll('<','&lt;')}</text></svg>`),left:180+x*cw,top:100+y*ch});
  }
  await sharp({create:{width:cols*cw+400,height:rows.length*ch+300,channels:4,background:'#e5dfcd'}}).composite(parts).png().toFile(`${out}/${path}.png`);
}
const records = [];
for(const [region, bank] of base.entries()) {
  const rows=[];
  for(const art of bank.characters) {
    rows.push([0,1,2,3,4].map(view=>({f:art.frames.find(f=>f.view===view&&f.kind==='locomotion'&&f.pose===0),label:`${art.id} V${view} READY`})));
    for(const f of art.frames) records.push({region,id:art.id,bank:'basic',name:f.name,texture:f.texture,scale:art.pixelScale,silhouetteHeight:(f.bounds.bottom-f.bounds.top)*art.pixelScale,footToTop:(f.footY-f.bounds.top)*art.pixelScale,kind:f.kind,pose:f.pose,view:f.view});
  }
  await board(`${families[region]}-ready`,rows);
}
const suspects=[];
for(const [region, bank] of base.entries()) for(const art of bank.characters.filter(a=>a.slot>=3)) {
  const bossId=`${region}-${art.slot-2}`;
  const additions=extra.flatMap((b,i)=>b.characters.filter(a=>a.bossId===bossId).flatMap(a=>a.frames.map(f=>({f,bank:banks[i]}))));
  for(const {f,bank:source} of additions) records.push({region,id:art.id,bank:source,name:f.name,texture:f.texture,scale:.225,silhouetteHeight:(f.bounds.bottom-f.bounds.top)*.225,footToTop:(f.footY-f.bounds.top)*.225,kind:f.kind,pose:f.pose,view:f.view});
  const rows=[];
  for(let v=0;v<5;v++) {
    const ready=art.frames.find(f=>f.view===v&&f.kind==='locomotion'&&f.pose===0);
    const selected=additions.filter(({f})=>f.view===v&&f.pose===2);
    const unique=[...new Map(selected.map(({f,bank})=>[[f.texture,f.x,f.y].join('/'),{f,bank}])).values()];
    if(process.argv.includes('--all-poses') || (region===9&&art.id==='zhugehyeon')) {
      const all=[...art.frames.filter(f=>f.view===v).map(f=>({f,bank:'basic'})),...additions.filter(({f})=>f.view===v)];
      const uniqueAll=[...new Map(all.map(({f,bank})=>[[f.texture,f.x,f.y].join('/'),{f,bank}])).values()];
      for(let start=0;start<uniqueAll.length;start+=9) rows.push([{f:ready,label:`V${v} READY`},...uniqueAll.slice(start,start+9).map(({f,bank})=>({f,label:`${bank==='basic'?'B':bank==='three-special'?'S':'X'} ${f.name}`}))]);
    }
    for(const {f,bank} of unique) {
      const ratio=(f.bounds.bottom-f.bounds.top)/(ready.bounds.bottom-ready.bounds.top);
      suspects.push({region,id:art.id,bank,name:f.name,ratio,f,ready});
    }
  }
  if(rows.length) {await board(`${art.id}-all`, rows); console.log('board '+region+'/'+art.id);}
  cache.clear();
}
const ranked=suspects.sort((a,b)=>Math.abs(Math.log(b.ratio))-Math.abs(Math.log(a.ratio)));
await board('contact-triage',ranked.slice(0,45).map(r=>[{f:r.ready,label:`${r.region}/${r.id} READY`},{f:r.f,label:`${r.name} bounds x${r.ratio.toFixed(2)}`}]),.4,280,225);
await writeFile(`${out}/inventory.json`,JSON.stringify({method:'Constant .225 game scale; .45 board scale, feet aligned. Silhouette height is triage only, not body or head size. No production changes.',records,contactTriage:ranked.map(({f,ready,...r})=>r)},null,2)+'\n');
console.log(JSON.stringify({records:records.length,characters:base.reduce((n,b)=>n+b.characters.length,0),contactCandidates:suspects.length,out}));
