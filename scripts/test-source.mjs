import {spawn} from 'node:child_process';
console.log('Source-only tests: media paths are checked against asset-manifest.json; actual media is not validated.');
const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run',...process.argv.slice(2)],{stdio:'inherit',env:{...process.env,MUGONG_TEST_ASSETS:'catalog'}});
child.on('error',error=>{console.error(error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
