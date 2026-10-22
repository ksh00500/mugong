import {readFile,writeFile} from 'node:fs/promises';
const root='docs/source/desert-family-v1';
const requests=JSON.parse(await readFile(`${root}/generation-requests.json`));
const rows=[];
for(const r of requests.filter(r=>r.character==='rider'&&r.view===1)){
 let text=await readFile(`${root}/${r.prompt}`,'utf8');
 text='IMPORTANT: Generate a TRANSPARENT RGBA GAME SPRITE ATLAS. Outside every character is EMPTY TRANSPARENCY, not a painted background. DO NOT recreate any background from the references. No black fill, brown gradient, glow or floor.\n'+text.slice(0,text.indexOf('REFERENCES:'))+'REFERENCES: Input1 transparent human sprite STYLE ONLY. Input2 exact mounted rider and brown horse identity, NOT its layout. Draw the requested SIX full mounted poses, isolated with wide empty alpha margins. Use clean solid outlines. Transparent empty gaps between horse legs, under tail and between all six poses.\n';
 const prompt=r.prompt.replace('.prompt.txt','.transparent-v2.prompt.txt');
 await writeFile(`${root}/${prompt}`,text);
 rows.push({...r,prompt,text,references:['docs/source/hyeolma-family-v1/bloodblade-front-right.png','docs/source/hostile-consistency-v3/cavalry-directions.png']});
}
console.log(JSON.stringify(rows));
