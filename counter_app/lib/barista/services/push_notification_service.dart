/// Owns the unified app's Barista order-refresh notification hook.
///
/// Firebase registration remains disabled until Firebase applications exist
/// for the Counter package. Queue polling still refreshes orders without
/// creating an invalid Firebase build.
class PushNotificationService {
  PushNotificationService._();

  static final instance = PushNotificationService._();

  Future<void> Function()? _onNewOrder;

  void setNewOrderHandler(Future<void> Function()? handler) {
    _onNewOrder = handler;
  }

  Future<void> syncAfterSignIn() async {}

  Future<void> syncExistingSession() async {}

  Future<void> deactivateForCurrentSession() async {}

  Future<void> notifyNewOrder() async {
    await _onNewOrder?.call();
  }

  void dispose() {
    _onNewOrder = null;
  }
}
