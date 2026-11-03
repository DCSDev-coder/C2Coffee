import 'dart:developer' as developer;

/// Records developer-facing diagnostics without presenting raw exceptions to
/// customers. Metadata must never contain tokens, contact details, card codes,
/// checkout URLs, or other customer data.
class AppDiagnostics {
  AppDiagnostics._();

  static void recordError(
    Object error,
    StackTrace stackTrace, {
    required String context,
    Map<String, Object?> metadata = const {},
  }) {
    final safeMetadata = metadata.entries
        .where((entry) => entry.value != null)
        .map((entry) => '${entry.key}=${entry.value}')
        .join(', ');

    developer.log(
      safeMetadata.isEmpty ? context : '$context ($safeMetadata)',
      name: 'c2coffee',
      level: 1000,
      error: error,
      stackTrace: stackTrace,
    );
  }
}
