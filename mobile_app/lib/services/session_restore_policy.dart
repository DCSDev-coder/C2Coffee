import 'auth_api_service.dart';

enum SessionRestoreOutcome { restored, signedOut, unavailable }

const _terminalSessionCodes = <String>{
  'invalid_refresh_token',
  'invalid_access_token',
  'session_not_found',
  'session_version_mismatch',
  'user_not_active',
};

// A network failure must not erase a valid encrypted refresh token.
SessionRestoreOutcome sessionRestoreOutcomeForError(Object error) {
  if (error is ApiException && _terminalSessionCodes.contains(error.code)) {
    return SessionRestoreOutcome.signedOut;
  }
  return SessionRestoreOutcome.unavailable;
}
