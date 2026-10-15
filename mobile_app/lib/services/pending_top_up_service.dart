import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class PendingTopUpService {
  PendingTopUpService._();

  static final PendingTopUpService instance = PendingTopUpService._();
  static const FlutterSecureStorage _storage = FlutterSecureStorage();
  static const _pendingTopUpRefKey = 'pending_online_topup_ref';
  static const _legacyPendingTopUpRefKey = 'pending_billplz_topup_ref';

  Future<String?> read() async =>
      await _storage.read(key: _pendingTopUpRefKey) ??
      await _storage.read(key: _legacyPendingTopUpRefKey);

  Future<void> save(String topUpRef) async {
    if (topUpRef.isEmpty) {
      throw ArgumentError.value(topUpRef, 'topUpRef', 'Must not be empty.');
    }
    await _storage.write(key: _pendingTopUpRefKey, value: topUpRef);
    await _storage.delete(key: _legacyPendingTopUpRefKey);
  }

  Future<void> clear() async {
    await _storage.delete(key: _pendingTopUpRefKey);
    await _storage.delete(key: _legacyPendingTopUpRefKey);
  }
}
