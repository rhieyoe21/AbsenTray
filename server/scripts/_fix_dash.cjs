const fs = require('fs');
const f = 'src/services/alert.service.js';
const s = fs.readFileSync(f, 'utf8');
// mojibake em-dash: U+00E2 U+20AC + 1 char -> ganti jd em-dash U+2014
const clean = s.replace(/\u00e2\u20ac[\s\S]/g, '\u2014');
fs.writeFileSync(f, clean, 'utf8');
const chk = fs.readFileSync(f, 'utf8');
console.log('remain mojibake:', /â€/.test(chk));
process.exit(0);