import 'dart:async';
import 'dart:convert';
import 'api_client.dart';

class CustomerSession {
  final String phone;
  final String sessionToken;
  final String deviceToken;
  final Map<String, dynamic> customerSummary;

  CustomerSession({
    required this.phone,
    required this.sessionToken,
    required this.deviceToken,
    required this.customerSummary,
  });

  bool get isGuest => sessionToken.isEmpty;

  List<Map<String, dynamic>> get activeVouchers {
    final value = customerSummary['active_vouchers'];
    if (value is! List) return const [];
    return value.whereType<Map>().map(Map<String, dynamic>.from).toList();
  }
}

class SessionManager {
  final ApiClient _apiClient = ApiClient();
  CustomerSession? _currentSession;
  Timer? _idleTimer;
  void Function()? onSessionEnded;

  static const Duration _idleTimeout = Duration(minutes: 10);

  CustomerSession? get currentSession => _currentSession;

  /// Starts a session by communicating with the backend API
  Future<bool> startSession(String phone, String deviceToken) async {
    try {
      final response = await _apiClient.post('/v1/counter/customer-sessions', {
        'phone': phone,
      }, token: deviceToken);

      if (response.statusCode == 200 || response.statusCode == 201) {
        final jsonResponse = jsonDecode(response.body) as Map<String, dynamic>;
        final sessionToken = jsonResponse['customer_session_token'] as String;
        final customer = jsonResponse['customer'];
        if (customer is! Map) return false;

        _currentSession = CustomerSession(
          phone: phone,
          sessionToken: sessionToken,
          deviceToken: deviceToken,
          customerSummary: Map<String, dynamic>.from(customer),
        );
        _resetIdleTimer();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /// Starts a guest session without hitting the API
  void startGuestSession() {
    _currentSession = CustomerSession(
      phone: 'Guest',
      sessionToken: '',
      deviceToken: '',
      customerSummary: {
        'customer_name': 'Walk-in Guest',
        'loyalty_tier': 'None',
        'token_balance': 0,
      },
    );
    _resetIdleTimer();
  }

  void _resetIdleTimer() {
    _idleTimer?.cancel();
    _idleTimer = Timer(_idleTimeout, () {
      endSession();
    });
  }

  void onUserInteraction() {
    if (_currentSession != null) {
      _resetIdleTimer();
    }
  }

  /// Ends the session, communicating the DELETE request to the backend
  Future<void> endSession() async {
    final session = _currentSession;
    _currentSession = null;
    _idleTimer?.cancel();
    onSessionEnded?.call();

    if (session != null && !session.isGuest) {
      try {
        await _apiClient.delete(
          '/v1/counter/customer-session',
          token: session.deviceToken,
          headers: {'X-Counter-Customer-Session': session.sessionToken},
        );
      } catch (e) {
        // Just fail silently for now if network fails on cleanup
      }
    }
  }
}
