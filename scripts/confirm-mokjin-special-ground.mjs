import { readFile, writeFile } from 'node:fs/promises';
import { nativeSourceCell } from './native-source-cell.mjs';
const root = 'docs/source/snow-special-v1';
const art = JSON.parse(await readFile('src/game/snow-special-frames.json')).characters[0];
const jobs = JSON.parse(await readFile(root + '/generation-jobs.json'));
const reviews = JSON.parse(await readFile(root + '/source-review.json'));
// Points selected by viewing the five 1600×960 contact plates. Each plate
// cell begins at (column*400+20,row*320+25), with a 0.5 review-only scale.
// Game assets are never resampled. Use the midpoint between the boots,
// and the lower sole height; exclude spear heads and hanging white tassels.
const points = {
  'mokjin-front': [
    [123, 243],
    [528, 240],
    [948, 239],
    [1340, 216],
    [113, 561],
    [532, 571],
    [925, 559],
    [1332, 591],
    [132, 888],
    [532, 861],
    [923, 875],
    [1326, 880],
  ],
  'mokjin-front-right': [
    [116, 244],
    [527, 215],
    [919, 229],
    [1319, 228],
    [121, 569],
    [525, 571],
    [922, 568],
    [1348, 590],
    [107, 861],
    [511, 866],
    [918, 894],
    [1322, 896],
  ],
  'mokjin-right': [
    [124, 240],
    [508, 212],
    [913, 200],
    [1307, 194],
    [126, 563],
    [528, 563],
    [928, 555],
    [1323, 571],
    [141, 867],
    [536, 851],
    [937, 882],
    [1327, 881],
  ],
  'mokjin-rear-right': [
    [123, 223],
    [501, 217],
    [910, 204],
    [1298, 206],
    [116, 551],
    [520, 545],
    [923, 549],
    [1320, 590],
    [112, 860],
    [509, 835],
    [920, 895],
    [1333, 869],
  ],
  'mokjin-back': [
    [121, 235],
    [530, 216],
    [920, 225],
    [1330, 246],
    [135, 562],
    [521, 566],
    [916, 581],
    [1303, 597],
    [115, 869],
    [516, 851],
    [931, 893],
    [1320, 905],
  ],
};
const anchors = {},
  overrides = [];
for (const j of jobs) {
  anchors[j.id] = [];
  for (let p = 0; p < 12; p++) {
    const f = art.frames.find((f) => f.texture.endsWith(j.id) && f.sourcePose === p);
    const r = reviews.find((r) => r.source === f.source);
    const cell = nativeSourceCell(f.sourceCell, r.width, r.height);
    const [x, y] = points[j.id][p],
      left = (p % 4) * 400,
      top = Math.floor(p / 4) * 320;
    const point = [
      Math.round(f.sourceBounds.left + (x - left - 20) * 2 - cell.left),
      Math.round(f.sourceBounds.top + (y - top - 25) * 2 - cell.top),
    ];
    anchors[j.id].push(point);
    overrides.push({
      id: j.id,
      pose: p,
      point,
      reason: 'Direct review of boot midpoint and lower sole; excludes pole and tassel',
      reviewPlatePoint: [x, y],
    });
  }
}
await writeFile(root + '/ground-anchors.json', JSON.stringify(anchors, null, 2) + '\n');
await writeFile(root + '/ground-anchor-overrides.json', JSON.stringify(overrides, null, 2) + '\n');
console.log('60 reviewed ground coordinates saved');
