int orderAlertAgeMinutes({
  required DateTime now,
  required DateTime fallbackCreatedAt,
  DateTime? statusStartedAt,
}) {
  final startedAt = statusStartedAt ?? fallbackCreatedAt;
  final minutes = now.difference(startedAt.toLocal()).inMinutes;
  return minutes < 0 ? 0 : minutes;
}
