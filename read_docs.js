const fs = require('fs');
const path = require('path');

function readDocx(filePath) {
  const data = fs.readFileSync(filePath);
  // docx is a ZIP - find word/document.xml
  // Simple approach: search for text content between XML tags
  const str = data.toString('binary');
  // Find all w:t content
  const regex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match;
  const texts = [];
  while ((match = regex.exec(str)) !== null) {
    if (match[1].trim()) texts.push(match[1]);
  }
  return texts.join(' ');
}

const dir = 'c:/Users/lenovo/Desktop/Email Automation';
console.log('=== SaaS Research Call Script ===');
console.log(readDocx(path.join(dir, 'SaaS Research Call Script.docx')));
console.log('\n=== Immersive Outreach Scripts ===');
console.log(readDocx(path.join(dir, 'immersive outreach scripts.docx')));
