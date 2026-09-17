import net from 'node:net';

/** Send raw ESC/POS bytes to a LAN/Wi-Fi thermal printer. */
export function sendToNetworkPrinter({ host, port, payload, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      error ? reject(error) : resolve();
    };

    socket.setTimeout(timeoutMs);
    socket.once('error', finish);
    socket.once('timeout', () => finish(new Error(`Printer ${host}:${port} did not respond before timeout.`)));
    socket.once('connect', () => {
      socket.write(payload, (error) => {
        if (error) return finish(error);
        socket.end(() => finish());
      });
    });
  });
}
