import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

class AppRelease {
  const AppRelease({
    required this.versionName,
    required this.versionCode,
    required this.apkUrl,
    required this.sha256,
    this.releaseNotes,
  });

  final String versionName;
  final int versionCode;
  final Uri apkUrl;
  final String sha256;
  final String? releaseNotes;

  factory AppRelease.fromJson(Map<String, dynamic> json) {
    final versionName = json['version_name']?.toString().trim() ?? '';
    final versionCode = switch (json['version_code']) {
      int value => value,
      String value => int.tryParse(value),
      _ => null,
    };
    final apkUrl = Uri.tryParse(json['apk_url']?.toString().trim() ?? '');
    final sha256 = json['sha256']?.toString().trim().toLowerCase() ?? '';
    final releaseNotes = json['release_notes']?.toString().trim();

    if (!RegExp(r'^[A-Za-z0-9._-]{1,40}$').hasMatch(versionName) ||
        versionCode == null ||
        versionCode < 1) {
      throw const FormatException('The update version is invalid.');
    }
    if (apkUrl == null || apkUrl.scheme != 'https' || apkUrl.host.isEmpty) {
      throw const FormatException('The update APK must use a valid HTTPS URL.');
    }
    if (!RegExp(r'^[a-f0-9]{64}$').hasMatch(sha256)) {
      throw const FormatException('The update checksum is invalid.');
    }

    return AppRelease(
      versionName: versionName,
      versionCode: versionCode,
      apkUrl: apkUrl,
      sha256: sha256,
      releaseNotes: releaseNotes?.isEmpty == true ? null : releaseNotes,
    );
  }
}

class AppUpdateCheck {
  const AppUpdateCheck({
    required this.installedVersionName,
    required this.installedVersionCode,
    required this.release,
  });

  final String installedVersionName;
  final int installedVersionCode;
  final AppRelease release;

  bool get updateAvailable => release.versionCode > installedVersionCode;
}

class AppUpdateService {
  AppUpdateService({http.Client? client}) : _client = client ?? http.Client();

  static const MethodChannel _channel = MethodChannel(
    'com.c2coffee.counter/app_updates',
  );
  static const String manifestUrl = String.fromEnvironment(
    'COUNTER_UPDATE_MANIFEST_URL',
    defaultValue:
        'https://www.c2coffeeandcandle.com/download/counterdownload/latest.json',
  );

  final http.Client _client;

  bool get isSupported =>
      !kIsWeb && defaultTargetPlatform == TargetPlatform.android;

  Future<AppUpdateCheck> checkForUpdate() async {
    if (!isSupported) {
      throw PlatformException(
        code: 'unsupported_platform',
        message: 'App updates are available only in the Android C2 Store app.',
      );
    }

    final installed = await _channel.invokeMapMethod<String, dynamic>(
      'getInstalledVersion',
    );
    final installedName = installed?['versionName']?.toString() ?? 'Unknown';
    final installedCode = switch (installed?['versionCode']) {
      int value => value,
      num value => value.toInt(),
      String value => int.tryParse(value),
      _ => null,
    };
    if (installedCode == null) {
      throw PlatformException(
        code: 'version_unavailable',
        message: 'The installed app version could not be read.',
      );
    }

    final configuredManifestUri = Uri.parse(manifestUrl);
    final manifestUri = configuredManifestUri.replace(
      queryParameters: {
        ...configuredManifestUri.queryParameters,
        '_': DateTime.now().millisecondsSinceEpoch.toString(),
      },
    );
    final response = await _client
        .get(
          manifestUri,
          headers: const {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache',
          },
        )
        .timeout(const Duration(seconds: 15));
    if (response.statusCode != 200) {
      throw Exception(
        'The update server returned status ${response.statusCode}.',
      );
    }
    if (response.bodyBytes.length > 65536) {
      throw const FormatException('The update manifest is too large.');
    }

    final payload = jsonDecode(_decodeManifestBody(response.bodyBytes));
    if (payload is! Map<String, dynamic>) {
      throw const FormatException('The update manifest is not valid JSON.');
    }
    return AppUpdateCheck(
      installedVersionName: installedName,
      installedVersionCode: installedCode,
      release: AppRelease.fromJson(payload),
    );
  }

  Future<bool> canInstallPackages() async {
    if (!isSupported) return false;
    return await _channel.invokeMethod<bool>('canInstallPackages') ?? false;
  }

  Future<void> openInstallPermissionSettings() async {
    await _channel.invokeMethod<void>('openInstallPermissionSettings');
  }

  Future<int> downloadAndInstall(AppRelease release) async {
    final result = await _channel.invokeMethod<num>('downloadAndInstall', {
      'url': release.apkUrl.toString(),
      'sha256': release.sha256,
      'versionCode': release.versionCode,
      'versionName': release.versionName,
    });
    if (result == null) {
      throw PlatformException(
        code: 'download_not_started',
        message: 'The update download could not be started.',
      );
    }
    return result.toInt();
  }

  void dispose() => _client.close();

  static String _decodeManifestBody(List<int> bytes) {
    final body = utf8.decode(bytes, allowMalformed: false).trim();
    final withoutBom = body.startsWith('\uFEFF')
        ? body.substring(1).trimLeft()
        : body;
    if (!withoutBom.startsWith('{')) {
      throw const FormatException(
        'The update server returned an invalid manifest. Please try again later.',
      );
    }
    return withoutBom;
  }
}
