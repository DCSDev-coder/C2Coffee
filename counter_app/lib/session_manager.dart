import 'dart:async';
import 'dart:convert';
import 'api_client.dart';

class CustomerSession {
  final String phone;
  final String sessionToken;
  final Map<String, dynamic> customerSummary;

  CustomerSession({
    required this.phone,
    required this.sessionToken,
    required this.customerSummary,
  });
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
      final response = await _apiClient.post(
        '/v1/counter/customer-sessions',
        {'phone': phone},
        token: deviceToken,
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final jsonResponse = jsonDecode(response.body);
        final sessionToken = jsonResponse['customer_session_token'] as String;
        
        _currentSession = CustomerSession(
          phone: phone,
          sessionToken: sessionToken,
          customerSummary: jsonResponse, // Store full payload safely
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
    final sessionToken = _currentSession?.sessionToken;
    _currentSession = null;
    _idleTimer?.cancel();
    onSessionEnded?.call();

    if (sessionToken != null) {
      try {
        await _apiClient.delete(
          '/v1/counter/customer-session',
          headers: {'X-Counter-Customer-Session': sessionToken},
        );
      } catch (e) {
        // Just fail silently for now if network fails on cleanup
      }
    }
  }
}
