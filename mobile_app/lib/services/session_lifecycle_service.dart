import 'app_session_service.dart';
import 'auth_api_service.dart';
import 'secure_session_service.dart';
import 'push_notification_service.dart';
import 'session_restore_policy.dart';
import 'user_service.dart';

class SessionLifecycleService {
  SessionLifecycleService._();

  static final SessionLifecycleService instance = SessionLifecycleService._();

  Future<SessionRestoreOutcome> restoreSession() async {
    final refreshToken = await SecureSessionService.instance.getRefreshToken();
    if (refreshToken == null || refreshToken.isEmpty) {
      await _clearLocalState();
      return SessionRestoreOutcome.signedOut;
    }

    try {
      final tokens = await AuthApiService.instance.refreshSession(
        refreshToken: refreshToken,
      );
      await SecureSessionService.instance.saveSession(
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      );
    } catch (error) {
      final outcome = sessionRestoreOutcomeForError(error);
      if (outcome == SessionRestoreOutcome.signedOut) {
        await _clearLocalState();
      }
      return outcome;
    }

    try {
      await AppSessionService.instance.loadAuthenticatedState(force: true);
      await PushNotificationService.instance.syncExistingSession();
      return SessionRestoreOutcome.restored;
    } catch (error) {
      final outcome = sessionRestoreOutcomeForError(error);
      if (outcome == SessionRestoreOutcome.signedOut) {
        await _clearLocalState();
      }
      return outcome;
    }
  }

  Future<void> logout() async {
    final accessToken =
        await SecureSessionService.instance.getValidAccessToken();
    final refreshToken = await SecureSessionService.instance.getRefreshToken();

    try {
      await PushNotificationService.instance.deactivateForCurrentSession();
      var tokenToUse = accessToken;
      if ((tokenToUse == null || tokenToUse.isEmpty) &&
          refreshToken != null &&
          refreshToken.isNotEmpty) {
        final tokens = await AuthApiService.instance.refreshSession(
          refreshToken: refreshToken,
        );
        await SecureSessionService.instance.saveSession(
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        );
        tokenToUse = tokens.accessToken;
      }

      if (tokenToUse != null && tokenToUse.isNotEmpty) {
        try {
          await AuthApiService.instance.logout(accessToken: tokenToUse);
        } catch (_) {
          if (refreshToken != null && refreshToken.isNotEmpty) {
            final tokens = await AuthApiService.instance.refreshSession(
              refreshToken: refreshToken,
            );
            await SecureSessionService.instance.saveSession(
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
            );
            await AuthApiService.instance.logout(
              accessToken: tokens.accessToken,
            );
          } else {
            rethrow;
          }
        }
      }
    } catch (_) {
      // Always clear local state even if the server logout call fails.
    } finally {
      await _clearLocalState();
    }
  }

  Future<void> _clearLocalState() async {
    await SecureSessionService.instance.clearSession();
    AppSessionService.instance.clear();
    await UserService.clearUserProfile();
    await UserService.clearAvatar();
  }
}
