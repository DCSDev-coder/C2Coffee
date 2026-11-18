const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  // Existing callers sometimes provide an already-escaped CSV cell.
  if (/^"[\s\S]*"$/.test(text)) return text;
  return `"${text.replaceAll('"', '""').replaceAll('\r\n', '\n').replaceAll('\r', '\n')}"`;
};

export const exportToCSV = (rows, filename) => {
  const csvContent = rows.map((row) => {
    if (Array.isArray(row)) return row.map(csvCell).join(',');
    if (row && typeof row === 'object') return Object.values(row).map(csvCell).join(',');
    return csvCell(row);
  }).join("\r\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};

export const exportReportSections = (sections, filename) => {
  const rows = [];
  sections.forEach(({ title, headers, rows: sectionRows = [] }) => {
    if (rows.length > 0) rows.push([]);
    if (title) rows.push([title]);
    if (headers) rows.push(headers);
    rows.push(...sectionRows);
  });
  exportToCSV(rows, filename);
};
