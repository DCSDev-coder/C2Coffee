const fs = require('fs');
const path = require('path');

const dir = 'c:/DCS/admin_web/src/components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx') && f !== 'Menu.jsx');

let updateCount = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  let code = fs.readFileSync(filePath, 'utf8');
  
  const regex = /const (KPICard|StatCard|SummaryCard) = \(\{.*?\}\) => \([\s\S]*?<\/(div|div)>\n\);\n/g;
  const regexFallback = /const (KPICard|StatCard|SummaryCard) = \(\{.*?\}\) => \([\s\S]*?\);\n/g;

  let replaced = false;

  code = code.replace(regexFallback, (match, componentName) => {
    if (match.length > 2000) return match;
    replaced = true;
    return `const ${componentName} = ({ title, value, change, icon: Icon, iconBg, iconColor = "text-white" }) => (
  <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center space-x-4 min-w-0">
    <div className={\`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 \${iconBg} \${iconColor} shadow-sm\`}>
      <Icon size={26} strokeWidth={2.2} />
    </div>
    <div className="flex-1 min-w-0">
      <h3 className="text-gray-500 text-xs sm:text-sm font-medium leading-tight mt-0.5 truncate">
        {title}
      </h3>
      <p className="text-2xl font-bold text-gray-900 mt-1 leading-tight">{value}</p>
      {change && (
        <div className="flex items-center gap-1 mt-1">
          <p className="text-[11px] text-gray-500 font-medium leading-tight truncate">
            {change.includes('%') && !change.includes('of total') && !change.includes('↑') && !change.includes('↓') && change.includes('vs') ? \`↑ \${change}\` : change}
          </p>
        </div>
      )}
    </div>
  </div>
);
`;
  });

  if (replaced) {
    fs.writeFileSync(filePath, code);
    console.log('Updated', file);
    updateCount++;
  }
}
console.log('Total files updated:', updateCount);
