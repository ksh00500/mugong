import {readFile,writeFile} from 'node:fs/promises';
const root='docs/source/desert-family-v1';
const proposals=JSON.parse(await readFile(`${root}/ground-proposals.json`));
const overrides=proposals.filter(p=>p.id.startsWith('rider-')&&p.pose!==5).map(p=>({
 id:p.id,pose:p.pose,point:[p.point[0],p.point[1]+p.fromFigureBottom-2],
 reason:'Mounted source reviewed: ground is the lowest horse hoof, not the brown leg or rider boot. Saber stays above hooves. Original pixels unchanged.'
}));
await writeFile(`${root}/ground-anchor-overrides.json`,JSON.stringify(overrides,null,2)+'\n');
