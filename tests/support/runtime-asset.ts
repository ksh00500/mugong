import {existsSync,readFileSync} from 'node:fs';

// Source-only CI checks registrations against the versioned asset catalogue.
// Normal tests still require actual files; hashes are checked before deployment.
const catalogue=process.env.MUGONG_TEST_ASSETS==='catalog'
 ?new Set((JSON.parse(readFileSync('asset-manifest.json','utf8')).files as {path:string}[]).map(f=>f.path))
 :null;
export function runtimeAssetPresent(path:string){
 return catalogue?catalogue.has(path):existsSync(path);
}
