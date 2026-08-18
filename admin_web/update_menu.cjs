const fs = require('fs');
const data = fs.readFileSync('c:/DCS/admin_web/src/data/menuData.js', 'utf8');

const updates = {
  'MENU-005': { price: 'RM 15.90' },
  'MENU-006': { name: 'Pinky Blush Milkshake By Syah' },
  'MENU-007': { name: 'Solero Fizz By Syah' },
  'MENU-008': { name: 'Paddle Pop By Syah' },
  'MENU-009': { name: 'Cloudy Jasmine By Ajim' },
  'MENU-014': { category: 'C2 Flavoured Coffee', price: 'RM 13.90' },
  'MENU-015': { price: 'RM 13.90' },
  'MENU-016': { price: 'RM 10.90' },
  'MENU-017': { price: 'RM 5.90' },
  'MENU-018': { price: 'RM 10.90' },
  'MENU-019': { price: 'RM 13.90' },
  'MENU-020': { price: 'RM 10.90' },
  'MENU-021': { price: 'RM 12.90' },
  'MENU-023': { category: 'C2 Flavoured Coffee', price: 'RM 15.90' },
  'MENU-024': { price: 'RM 15.90' },
  'MENU-026': { name: 'Onde2Pop', price: 'RM 15.90' },
  'MENU-027': { price: 'RM 15.90' },
  'MENU-028': { category: 'C2 Coffee', price: 'RM 9.90' },
  'MENU-029': { price: 'RM 20.90' },
  'MENU-030': { price: 'RM 13.90' }
};

const lines = data.split('\n');
const newLines = lines.map(line => {
  for (const id in updates) {
    if (line.includes(`id: "${id}"`)) {
      let newLine = line;
      if (updates[id].name) {
        newLine = newLine.replace(/name: "[^"]+"/, `name: "${updates[id].name}"`);
      }
      if (updates[id].category) {
        newLine = newLine.replace(/category: "[^"]+"/, `category: "${updates[id].category}"`);
      }
      if (updates[id].price) {
        newLine = newLine.replace(/price: "[^"]+"/, `price: "${updates[id].price}"`);
      }
      return newLine;
    }
  }
  return line;
});

fs.writeFileSync('c:/DCS/admin_web/src/data/menuData.js', newLines.join('\n'));
console.log('done');
