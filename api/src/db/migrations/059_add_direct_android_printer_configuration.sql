-- A direct Android printer is an outlet-owned network device. The assigned
-- workstation key prevents another staff tablet from claiming the same jobs.

ALTER TABLE printer_targets
  ADD COLUMN network_host VARCHAR(255) NULL AFTER printer_reference,
  ADD COLUMN network_port SMALLINT UNSIGNED NULL AFTER network_host,
  ADD COLUMN direct_print_device_key VARCHAR(32) NULL AFTER network_port,
  ADD KEY idx_printer_targets_direct_device (tenant_code, direct_print_device_key);

