import { chromium } from '@playwright/test';
import { writeFile, readFile } from 'node:fs/promises';
const browser = await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try {
  const page = await browser.newPage();
  const files=await Promise.all(['lobby-v1','combat-v1'].map(async name=>({name,base64:(await readFile(`public/audio/${name}.wav`)).toString('base64')})));
  const output=await page.evaluate(async files=> Promise.all(files.map(async ({name,base64})=>{
    const ctx=new AudioContext();await ctx.resume();
    const data=await ctx.decodeAudioData(Uint8Array.from(atob(base64),letter=>letter.charCodeAt(0)).buffer);
    const source=ctx.createBufferSource(),destination=ctx.createMediaStreamDestination();
    source.buffer=data;source.connect(destination);
    const recorder=new MediaRecorder(destination.stream,{mimeType:'audio/webm;codecs=opus',audioBitsPerSecond:96000});
    const chunks=[];
    const done=new Promise(resolve=>{recorder.ondataavailable=event=>chunks.push(event.data);recorder.onstop=()=>resolve(new Blob(chunks));});
    recorder.start();source.start();
    await new Promise(resolve=>{source.onended=()=>resolve();});recorder.stop();
    const bytes=new Uint8Array(await (await done).arrayBuffer());
    let binary='';for(let i=0;i<bytes.length;i+=4096)binary+=String.fromCharCode(...bytes.subarray(i,i+4096));
    await ctx.close();return {name,bytes:bytes.length,base64:btoa(binary)};
  })),files);
  for(const item of output)await writeFile(`public/audio/${item.name}.webm`,Buffer.from(item.base64,'base64'));
  const manifest=JSON.parse(await readFile('public/audio/manifest.json','utf8'));
  manifest.delivery={codec:'Opus/WebM',bitrate:96000,encoder:'Browser MediaRecorder',files:output.map(({name,bytes})=>({file:`${name}.webm`,bytes}))};
  await writeFile('public/audio/manifest.json',JSON.stringify(manifest,null,2));
  console.log(JSON.stringify(manifest.delivery));
}finally {await browser.close();}
