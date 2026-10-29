class VoucherIntentService {
  VoucherIntentService._();

  static final VoucherIntentService instance = VoucherIntentService._();

  String? _voucherCode;

  String? get voucherCode => _voucherCode;

  void remember(String code) {
    final normalized = code.trim();
    _voucherCode = normalized.isEmpty ? null : normalized;
  }

  String? take() {
    final value = _voucherCode;
    _voucherCode = null;
    return value;
  }

  void clear() {
    _voucherCode = null;
  }
}
