import { renderReceipt } from './escpos.js';
import { sendToNetworkPrinter } from './network-printer.js';

const connectorHeader = 'x-c2-print-connector-key';

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorCode(error) {
  const message = String(error?.message ?? 'printer_failed').toLowerCase();
  if (message.includes('timeout')) return 'printer_timeout';
  if (message.includes('refused')) return 'printer_connection_refused';
  if (message.includes('not found')) return 'printer_host_not_found';
  return 'printer_failed';
}

export class ApiClient {
  constructor(config, fetchImpl = globalThis.fetch) {
    this.config = config;
    this.fetch = fetchImpl;
  }

  async post(path, payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
    try {
      const response = await this.fetch(`${this.config.apiUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [connectorHeader]: this.config.connectorSecret
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (response.status === 204) return null;
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || `API request failed with HTTP ${response.status}.`);
      }
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  heartbeat() {
    return this.post('/v1/print-connectors/heartbeat', { printer_reference: this.config.printerReference });
  }

  claimJob() {
    return this.post('/v1/print-connectors/jobs/claim', { printer_reference: this.config.printerReference });
  }

  acknowledge(jobRef, outcome, error = undefined) {
    return this.post('/v1/print-connectors/jobs/acknowledge', {
      printer_reference: this.config.printerReference,
      job_ref: jobRef,
      outcome,
      ...(error ? { error_code: error } : {})
    });
  }
}

export class PrintConnector {
  constructor(config, { apiClient, send = sendToNetworkPrinter, log = console } = {}) {
    this.config = config;
    this.api = apiClient ?? new ApiClient(config);
    this.send = send;
    this.log = log;
    this.stopped = false;
  }

  stop() {
    this.stopped = true;
  }

  async processOne() {
    const job = await this.api.claimJob();
    if (!job) return false;

    try {
      const payload = renderReceipt(job.receipt);
      if (this.config.dryRun) {
        await this.api.acknowledge(job.job_ref, 'failed', 'dry_run_not_printed');
        this.log.info(`[connector] Dry run: receipt ${job.job_ref} validated and marked not printed.`);
        return true;
      }
      await this.send({
        host: this.config.printerHost,
        port: this.config.printerPort,
        payload,
        timeoutMs: this.config.requestTimeoutMs
      });
      await this.api.acknowledge(job.job_ref, 'printed');
      this.log.info(`[connector] Printed receipt ${job.job_ref}.`);
    } catch (error) {
      const code = errorCode(error);
      this.log.error(`[connector] Receipt ${job.job_ref} failed: ${error.message}`);
      try {
        await this.api.acknowledge(job.job_ref, 'failed', code);
      } catch (acknowledgeError) {
        this.log.error(`[connector] Could not report ${job.job_ref} failure: ${acknowledgeError.message}`);
      }
    }
    return true;
  }

  async run() {
    const stop = () => {
      this.log.info('[connector] Stop requested. Finishing the current operation.');
      this.stop();
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    this.log.info(`[connector] Starting ${this.config.transport} for ${this.config.printerReference}.`);

    while (!this.stopped) {
      try {
        await this.api.heartbeat();
        const claimed = await this.processOne();
        if (!claimed) await sleep(this.config.pollIntervalMs);
      } catch (error) {
        this.log.error(`[connector] API unavailable: ${error.message}`);
        await sleep(this.config.pollIntervalMs);
      }
    }
  }
}
