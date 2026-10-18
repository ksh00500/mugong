import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root='docs/source/desert-special-v1';
const plan=JSON.parse(await readFile(root+'/preflight.json'));
await mkdir(root+'/prompts-v1',{recursive:true});
for(const r of plan.promptRecords){
  const p=await readFile(r.prompt,'utf8');
  await copyFile(r.prompt,root+'/prompts-v1/'+r.id+'.prompt.txt');
  const refined=p.replace('Canvas approximately2400x3200 for empty travel space. Minimum48px transparent outside spacing, generous overhead/lateral weapon allowance.',
    'Final canvas 1024x1536 pixels, six equal 512x512 slots in TWO columns by THREE rows. Deliberately SMALL actor within each slot: standing body from turban/head top to boot sole about 310-325px, skull width about100px, same anatomical size as the input reference in all exposures. Hair/cape/weapon may occupy up to430px of each slot, with at least40px COMPLETELY TRANSPARENT inset from EACH slot edge. Enormous empty margins are intentional. Upper sword tip must remain 40px below its slot top. Do not fill the sheet with figures, do not enlarge for detail, do not clip a weapon tip, do not let any occupied pixels touch a slot edge.');
  await writeFile(r.prompt,refined);
  r.promptSha256=createHash('sha256').update(refined).digest('hex');
}
plan.revision='padding-v2';
plan.rejectedSources=[{source:'asar-front-dash-rejected-v1.png',reason:'oversized actor; raised dao clipped/touches outer canvas top'}];
await writeFile(root+'/preflight.json',JSON.stringify(plan,null,2)+'\n');
console.log(JSON.stringify({refinedPrompts:plan.promptRecords.length,rejected:1}));
