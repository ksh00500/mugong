import {readFile,writeFile} from 'node:fs/promises';
const root=process.argv[2]??'docs/verification/enemy-coordination-v1';
const before=JSON.parse(await readFile(`${root}/before/squads.json`,'utf8')).rows;
const after=JSON.parse(await readFile(`${root}/after/squads.json`,'utf8')).rows;
if(before.length!==60||after.length!==60)throw Error('Incomplete observations');
const avg=(rows,key)=>+(rows.reduce((s,r)=>s+r[key],0)/rows.length).toFixed(2);
const summarize=rows=>({damage:avg(rows,'damage'),starts:avg(rows,'starts'),attackerParticipation:avg(rows.map(r=>({...r,participation:r.distinctAttackers/r.enemyCount})),'participation'),mixedCommitmentSeconds:avg(rows,'mixedCommitmentSeconds'),maximumActive:Math.max(...rows.map(r=>r.maxActive)),minimumStartGap:Math.min(...rows.map(r=>r.minStartGap)),simulationMs:avg(rows,'simulationMs')});
for(let n=0;n<before.length;n++){
 if(before[n].region!==after[n].region||before[n].wave!==after[n].wave||before[n].policy!==after[n].policy||JSON.stringify(before[n].stats)!==JSON.stringify(after[n].stats))throw Error('Different fixtures');
 if(after[n].maxActive>3||after[n].minStartGap<.22-1e-4)throw Error('Admission rule failed');
}
const summary={date:'2026-10-21',baselineCommit:'7eec250f228775210cb67fe59abb45c683374399',casesPerVersion:60,sameEncounterStats:true,methodology:'24s replenished HP; no player attacks/defense/consumables or ambient fields. Scripted damage/commitment observations, not human win rates. Timing is host-load dependent.',policies:[]};
for(const policy of ['hold','retreat','circle'])summary.policies.push({policy,before:summarize(before.filter(r=>r.policy===policy)),after:summarize(after.filter(r=>r.policy===policy))});
summary.overall={before:summarize(before),after:summarize(after)};
await writeFile(`${root}/comparison.json`,JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary,null,2));
