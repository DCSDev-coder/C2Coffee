import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class PendingTopUpService {
  PendingTopUpService._();

  static final PendingTopUpService instance = PendingTopUpService._();
  static const FlutterSecureStorage _storage = FlutterSecureStorage();
  static const _pendingTopUpRefKey = 'pending_billplz_topup_ref';

  Future<String?> read() => _storage.read(key: _pendingTopUpRefKey);

  Future<void> save(String topUpRef) async {
    if (topUpRef.isEmpty) {
      throw ArgumentError.value(topUpRef, 'topUpRef', 'Must not be empty.');
    }
    await _storage.write(key: _pendingTopUpRefKey, value: topUpRef);
  }

  Future<void> clear() => _storage.delete(key: _pendingTopUpRefKey);
}
