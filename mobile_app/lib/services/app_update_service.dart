import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

class MobileAppRelease {
  const MobileAppRelease({
    required this.versionName,
    required this.buildNumber,
    required this.storeUrl,
    required this.releaseNotes,
    this.minimumBuildNumber,
  });

  final String versionName;
  final int buildNumber;
  final Uri storeUrl;
  final String? releaseNotes;
  final int? minimumBuildNumber;

  factory MobileAppRelease.fromJson(Map<String, dynamic> json) {
    final versionName = json['version_name']?.toString().trim() ?? '';
    final buildNumber = _readPositiveInt(json['build_number']);
    final minimumBuildNumber = json['minimum_build_number'] == null
        ? null
        : _readPositiveInt(json['minimum_build_number']);
    final storeUrlKey = defaultTargetPlatform == TargetPlatform.iOS
        ? 'ios_store_url'
        : 'android_store_url';
    final storeUrl = Uri.tryParse(json[storeUrlKey]?.toString().trim() ?? '');
    final releaseNotes = json['release_notes']?.toString().trim();

    if (!RegExp(r'^[A-Za-z0-9._-]{1,40}$').hasMatch(versionName) ||
        buildNumber == null ||
        buildNumber < 1 ||
        (minimumBuildNumber != null && minimumBuildNumber < 1)) {
      throw const FormatException('The app update version is invalid.');
    }
    if (storeUrl == null ||
        storeUrl.scheme != 'https' ||
        storeUrl.host.isEmpty ||
        storeUrl.userInfo.isNotEmpty) {
      throw const FormatException('The app store URL must use HTTPS.');
    }

    return MobileAppRelease(
      versionName: versionName,
      buildNumber: buildNumber,
      storeUrl: storeUrl,
      releaseNotes: releaseNotes?.isEmpty == true ? null : releaseNotes,
      minimumBuildNumber: minimumBuildNumber,
    );
  }

  static int? _readPositiveInt(Object? value) {
    return switch (value) {
      int number => number,
      num number => number.toInt(),
      String text => int.tryParse(text),
      _ => null,
    };
  }
}

class MobileAppUpdateCheck {
  const MobileAppUpdateCheck({
    required this.installedVersionName,
    required this.installedBuildNumber,
    required this.release,
  });

  final String installedVersionName;
  final int installedBuildNumber;
  final MobileAppRelease release;

  bool get updateAvailable => release.buildNumber > installedBuildNumber;

  bool get mandatory =>
      release.minimumBuildNumber != null &&
      installedBuildNumber < release.minimumBuildNumber!;
}

class MobileAppUpdateService {
  MobileAppUpdateService({http.Client? client})
      : _client = client ?? http.Client();

  static const String manifestUrl = String.fromEnvironment(
    'MOBILE_UPDATE_MANIFEST_URL',
    defaultValue:
        'https://www.c2coffeeandcandle.com/download/mobile/latest.json',
  );
  static const _lastPromptKey = 'mobile_app_update_last_prompted_build';
  static const _lastPromptAtKey = 'mobile_app_update_last_prompted_at';
  static const _promptAgainAfter = Duration(hours: 24);

  final http.Client _client;

  Future<MobileAppUpdateCheck> checkForUpdate() async {
    final packageInfo = await PackageInfo.fromPlatform();
    final installedBuildNumber = int.tryParse(packageInfo.buildNumber);
    if (installedBuildNumber == null || installedBuildNumber < 1) {
      throw const FormatException('The installed app version is invalid.');
    }

    final configuredUri = Uri.parse(manifestUrl);
    final manifestUri = configuredUri.replace(
      queryParameters: {
        ...configuredUri.queryParameters,
        '_': DateTime.now().millisecondsSinceEpoch.toString(),
      },
    );
    final response = await _client.get(
      manifestUri,
      headers: const {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
      },
    ).timeout(const Duration(seconds: 10));
    if (response.statusCode != 200) {
      throw Exception(
          'The update server returned status ${response.statusCode}.');
    }
    if (response.bodyBytes.length > 65536) {
      throw const FormatException('The update manifest is too large.');
    }

    final body = utf8.decode(response.bodyBytes, allowMalformed: false).trim();
    final withoutBom =
        body.startsWith('\uFEFF') ? body.substring(1).trimLeft() : body;
    if (!withoutBom.startsWith('{')) {
      throw const FormatException('The update manifest is not valid JSON.');
    }
    final payload = jsonDecode(withoutBom);
    if (payload is! Map<String, dynamic>) {
      throw const FormatException('The update manifest is not valid JSON.');
    }

    return MobileAppUpdateCheck(
      installedVersionName: packageInfo.version,
      installedBuildNumber: installedBuildNumber,
      release: MobileAppRelease.fromJson(payload),
    );
  }

  Future<bool> shouldPrompt(MobileAppUpdateCheck check) async {
    if (!check.updateAvailable) return false;
    if (check.mandatory) return true;

    final preferences = await SharedPreferences.getInstance();
    final promptedBuild = preferences.getInt(_lastPromptKey);
    final promptedAtMillis = preferences.getInt(_lastPromptAtKey);
    if (promptedBuild != check.release.buildNumber ||
        promptedAtMillis == null) {
      return true;
    }
    return DateTime.now().difference(
            DateTime.fromMillisecondsSinceEpoch(promptedAtMillis)) >=
        _promptAgainAfter;
  }

  Future<void> markPrompted(MobileAppUpdateCheck check) async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.setInt(_lastPromptKey, check.release.buildNumber);
    await preferences.setInt(
        _lastPromptAtKey, DateTime.now().millisecondsSinceEpoch);
  }

  Future<bool> openStore(MobileAppRelease release) {
    return launchUrl(release.storeUrl, mode: LaunchMode.externalApplication);
  }

  void dispose() => _client.close();
}
