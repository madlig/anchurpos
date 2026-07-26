const fs = require('fs');

let code = fs.readFileSync('c:/mad/website/anchurpos/app/manager/employees/master/page.tsx', 'utf8');
code = code.replace(/<div className="flex bg-slate-100.*?<\/div>/s, '');
code = code.replace(/\{tab === "absensi"[\s\S]*?(?=\{tab === "payroll")/s, '');
code = code.replace(/\{tab === "payroll"[\s\S]*?(?=<\/div>\n\s*<\/div>\n\s*\);\n\})/s, '');
code = code.replace(/tab === "karyawan" && \(/g, '');
code = code.replace(/setTab={setTab}/g, '');
fs.writeFileSync('c:/mad/website/anchurpos/app/manager/employees/master/page.tsx', code);
