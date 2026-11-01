const _configuredPaymentHosts = String.fromEnvironment(
  'CHIP_WEBVIEW_ALLOWED_HOSTS',
  defaultValue: '',
);

bool isValidPaymentHostName(String value) {
  final host = value.trim().toLowerCase();
  if (host.isEmpty || host.length > 253 || host.contains('..')) return false;
  return host.split('.').every(
    (label) =>
        label.isNotEmpty &&
        label.length <= 63 &&
        RegExp(r'^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$').hasMatch(label),
  );
}

Set<String> trustedPaymentHosts({String? configuredHosts}) {
  final hosts = <String>{'chip-in.asia'};
  for (final value in (configuredHosts ?? _configuredPaymentHosts).split(',')) {
    final host = value.trim().toLowerCase();
    if (isValidPaymentHostName(host)) hosts.add(host);
  }
  return hosts;
}

bool isTrustedPaymentWebViewUri(Uri? uri, {String? configuredHosts}) {
  if (uri == null || uri.scheme != 'https' || uri.userInfo.isNotEmpty) {
    return false;
  }
  final host = uri.host.toLowerCase();
  return trustedPaymentHosts(configuredHosts: configuredHosts).any(
    (trusted) => host == trusted || host.endsWith('.$trusted'),
  );
}
