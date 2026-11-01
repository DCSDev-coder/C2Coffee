const rawPrinterPorts = new Set([9100]);

export function isPrivatePrinterIpv4(value: string): boolean {
  const octets = value.trim().split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) return false;

  const [first, second] = octets;
  return first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168);
}

export function isAllowedDirectPrinterDestination(host: string, port: number): boolean {
  if (host === 'sunmi_inner') return port === 9100;
  return isPrivatePrinterIpv4(host) && rawPrinterPorts.has(port);
}
