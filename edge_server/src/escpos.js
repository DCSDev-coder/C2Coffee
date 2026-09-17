const ESC = 0x1b;
const GS = 0x1d;
const RECEIPT_COLUMNS = 42;

function printable(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '?')
    .trim();
}

function wrap(value, width = RECEIPT_COLUMNS) {
  const words = printable(value).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines = [];
  let line = '';
  for (const word of words) {
    if (!line) {
      line = word;
    } else if (line.length + word.length + 1 <= width) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : '0.00';
}

function date(value) {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? '' : new Date(timestamp).toISOString().replace('T', ' ').slice(0, 16);
}

/** Render the API receipt payload for a standard 80 mm ESC/POS printer. */
export function renderReceipt(receipt) {
  const lines = [
    'C2 COFFEE & CANDLE',
    receipt.order_number ? `ORDER #${receipt.order_number}` : `ORDER ${printable(receipt.order_ref)}`,
    date(receipt.created_at),
    '-'.repeat(RECEIPT_COLUMNS)
  ];

  for (const item of receipt.items ?? []) {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const itemLines = wrap(`${quantity} x ${item.name}`);
    lines.push(...itemLines);
    lines.push(`    RM ${money(item.line_total_rm)}`);
  }

  lines.push('-'.repeat(RECEIPT_COLUMNS));
  lines.push(`TOTAL: RM ${money(receipt.final_total_rm)}`);
  lines.push(`TOKENS: ${Math.max(0, Number(receipt.token_amount) || 0)}`);
  lines.push('', 'Thank you.');

  const content = Buffer.from(`${lines.join('\n')}\n\n\n`, 'ascii');
  return Buffer.concat([
    Buffer.from([ESC, 0x40]),
    content,
    Buffer.from([GS, 0x56, 0x00])
  ]);
}
