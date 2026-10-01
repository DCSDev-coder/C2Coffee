-- Android tablets can connect directly to compatible Bluetooth, USB, or LAN
-- printers. A hardware-specific connector must still verify the target before
-- it is marked connected.

ALTER TABLE printer_targets
  MODIFY COLUMN delivery_mode ENUM(
    'android_direct',
    'pos_adapter',
    'local_print_bridge',
    'network_printer'
  ) NOT NULL;
