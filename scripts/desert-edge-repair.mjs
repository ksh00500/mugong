import {readFile, writeFile, copyFile} from 'node:fs/promises';
const root='docs/source/desert-family-v1', id=process.argv[2];
const j=JSON.parse(await readFile(`${root}/generation-requests.json`)).find(j=>j.id===id);
await copyFile(`${root}/${j.source}`, `${root}/${id}-edge-original.png`);
const prompt=`Precise sprite layout edit. This 3-column x4-row transparent sheet has a clipped sword tip in pose9 (third row RIGHT). Preserve all twelve exact drawings, pixel dimensions, anatomy, weapon shape and camera. Increase canvas width and height if needed, reposition entire drawings WITHOUT SCALING each into a roomier 3x4 grid. Reconstruct the missing tip of the curved dao in pose9. At least32 EMPTY transparent pixels beyond EVERY blade tip, crown, cape, foot and hand and between neighbors. No outline glow or background. All figures stay physically the same size; never shrink to fit. The subject is regal Arkan gold armor white fur red cape. All attacks aim RIGHT, right-hand dao, left balance hand.`;
const file=`${id}.edge-repair.prompt.txt`;
await writeFile(`${root}/${file}`,prompt);
console.log(JSON.stringify({...j,prompt:file,text:prompt,references:[`${root}/${j.source}`]}));
