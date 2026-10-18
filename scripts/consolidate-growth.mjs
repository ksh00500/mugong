// One-time migration: give growth UI a single owner instead of ten stylesheet overrides.
import fs from 'node:fs';
import postcss from 'postcss';
const files = fs.readdirSync('src').filter(file => file.endsWith('.css'));
function selectors(value) {
  const parts=[]; let depth=0, start=0;
  for(let i=0;i<value.length;i++) {
    if(value[i]==='(' || value[i]==='[') depth++;
    if(value[i]===')' || value[i]===']') depth--;
    if(value[i]===',' && !depth) { parts.push(value.slice(start,i)); start=i+1; }
  }
  parts.push(value.slice(start)); return parts;
}
let removed=0;
for(const file of files) {
  const root=postcss.parse(fs.readFileSync(`src/${file}`,'utf8'));
  root.walkRules(rule => {
    const remaining=selectors(rule.selector).filter(selector => {
      // Preserve generic :is/:where typography and exclusions, which serve other components.
      const own=/\.(?:growth(?:-[\w-]+)?|choice-[\w-]+|choose-label|screen-settings|glance-settings|language-setting|settings-tabs|audio-settings|audio-channel)(?![\w-])/.test(selector)
        && !/:(?:is|where|not)\(/.test(selector);
      if(own) removed++; return !own;
    });
    if(!remaining.length) rule.remove(); else rule.selector=remaining.join(',');
  });
  root.walkAtRules(rule => {
    if(rule.name==='keyframes' && rule.params==='growth-unlock') rule.remove();
  });
  root.walkAtRules(rule => { if(rule.nodes && !rule.nodes.length) rule.remove(); });
  fs.writeFileSync(`src/${file}`,root.toString());
}
console.log(`Removed ${removed} growth selectors; src/ui/growth.css owns the component.`);
