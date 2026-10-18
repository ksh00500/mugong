import { readFile, writeFile } from 'node:fs/promises';
for (const name of ['record-native-image','export-shaolin-family','analyze-shaolin-family','scan-native-sources','verify-native-atlas','propose-native-ground','family-review']) {
 const path = `scripts/${name}.mjs`;
 const source = await readFile(path,'utf8');
 await writeFile(path,source.replaceAll("'dokmu', 'hyeolma']", "'dokmu', 'hyeolma', 'desert']"));
}
const path='scripts/family-review.mjs';
let s=await readFile(path,'utf8');
if(!s.includes("familyName === 'desert'")){
 s=s.replace('const names =\n', "const names =\n  familyName === 'desert'\n    ? ['사막 기마병','사막 암살자','사막 환도병','황사도적왕 아사르','쌍환무희 나야','흑사마승 발타','대막도왕 아르칸']\n    : ");
 s=s.replace("familyName === 'shaolin' ? '소림'", "familyName === 'desert' ? '서역사막' : familyName === 'shaolin' ? '소림'");
}
await writeFile(path,s);
