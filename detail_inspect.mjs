import { readFileSync } from 'node:fs';

const html = readFileSync('./src/__fixtures__/detail-avatar.html', 'utf8');
const marker = "<script id='__NUXT_DATA__' type='application/json'>";
const start = html.indexOf(marker);
const end = html.indexOf('</script>', start);
const jsonText = html.slice(start + marker.length, end);
const payload = JSON.parse(jsonText);
const key = Object.keys(payload[0].state[1])[0];
console.log('raw key string:', JSON.stringify(key));
console.log('char codes:', Array.from(key).map((char) => char.charCodeAt(0)));
