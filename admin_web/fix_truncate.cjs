const fs = require('fs');
const path = require('path');

const dir = 'c:/DCS/admin_web/src/components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx'));

let updateCount = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  let code = fs.readFileSync(filePath, 'utf8');
  let replaced = false;

  const replacePatterns = [
    {
      find: /className="text-gray-500 text-xs sm:text-sm font-medium leading-tight mt-0\.5 truncate"/g,
      replace: 'className="text-gray-500 text-[11px] sm:text-xs xl:text-sm font-medium leading-tight mt-0.5 whitespace-normal"'
    },
    {
      find: /className="text-\[11px\] text-gray-500 font-medium leading-tight truncate"/g,
      replace: 'className="text-[11px] text-gray-500 font-medium leading-tight whitespace-normal"'
    },
    {
      find: /className="text-\[11px\] text-green-600 font-medium leading-tight hover:underline cursor-pointer truncate"/g,
      replace: 'className="text-[11px] text-green-600 font-medium leading-tight hover:underline cursor-pointer whitespace-normal"'
    },
    {
      find: /className="text-xs text-gray-500 font-medium truncate"/g,
      replace: 'className="text-xs text-gray-500 font-medium whitespace-normal"'
    }
  ];

  for (const pattern of replacePatterns) {
    if (pattern.find.test(code)) {
      code = code.replace(pattern.find, pattern.replace);
      replaced = true;
    }
  }

  if (replaced) {
    fs.writeFileSync(filePath, code);
    console.log('Updated', file);
    updateCount++;
  }
}
console.log('Total files updated:', updateCount);
