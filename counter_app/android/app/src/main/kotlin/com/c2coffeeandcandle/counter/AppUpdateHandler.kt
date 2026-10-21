package com.c2coffeeandcandle.counter

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.io.File

class AppUpdateHandler(private val context: Context) {
    fun handle(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "getInstalledVersion" -> getInstalledVersion(result)
            "canInstallPackages" -> result.success(canInstallPackages())
            "openInstallPermissionSettings" -> openInstallPermissionSettings(result)
            "downloadAndInstall" -> downloadAndInstall(call, result)
            else -> result.notImplemented()
        }
    }

    private fun getInstalledVersion(result: MethodChannel.Result) {
        try {
            val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageInfo.longVersionCode
            } else {
                @Suppress("DEPRECATION")
                packageInfo.versionCode.toLong()
            }
            result.success(
                mapOf(
                    "versionName" to (packageInfo.versionName ?: "Unknown"),
                    "versionCode" to versionCode
                )
            )
        } catch (error: Exception) {
            result.error("version_unavailable", "The installed app version could not be read.", null)
        }
    }

    private fun canInstallPackages(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
            context.packageManager.canRequestPackageInstalls()
    }

    private fun openInstallPermissionSettings(result: MethodChannel.Result) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            result.success(null)
            return
        }
        try {
            val intent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${context.packageName}")
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            result.success(null)
        } catch (error: Exception) {
            result.error(
                "permission_settings_unavailable",
                "Android could not open the install permission screen.",
                null
            )
        }
    }

    private fun downloadAndInstall(call: MethodCall, result: MethodChannel.Result) {
        if (!canInstallPackages()) {
            result.error(
                "install_permission_required",
                "Allow C2 Store to install apps before downloading the update.",
                null
            )
            return
        }

        val url = call.argument<String>("url")?.trim().orEmpty()
        val sha256 = call.argument<String>("sha256")?.trim()?.lowercase().orEmpty()
        val versionCode = call.argument<Int>("versionCode")
        val versionName = call.argument<String>("versionName")?.trim().orEmpty()
        val uri = Uri.parse(url)
        if (uri.scheme != "https" || uri.host.isNullOrBlank()) {
            result.error("invalid_update_url", "The update APK must use HTTPS.", null)
            return
        }
        if (!sha256.matches(Regex("^[a-f0-9]{64}$"))) {
            result.error("invalid_update_checksum", "The update checksum is invalid.", null)
            return
        }
        if (
            versionCode == null ||
            versionCode < 1 ||
            !versionName.matches(Regex("^[A-Za-z0-9._-]{1,40}$"))
        ) {
            result.error("invalid_update_version", "The update version is invalid.", null)
            return
        }

        try {
            val fileName = "c2-store-$versionName-$versionCode.apk"
            val updateDirectory = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
                ?: throw IllegalStateException("The update folder is unavailable.")
            updateDirectory.listFiles()
                ?.filter { it.isFile && it.name.startsWith("c2-store-") && it.extension == "apk" }
                ?.forEach { it.delete() }

            val request = DownloadManager.Request(uri)
                .setTitle("C2 Store $versionName")
                .setDescription("Downloading a verified C2 Store update")
                .setMimeType(APK_MIME_TYPE)
                .setNotificationVisibility(
                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED
                )
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(false)
                .setDestinationInExternalFilesDir(
                    context,
                    Environment.DIRECTORY_DOWNLOADS,
                    fileName
                )

            val downloadManager =
                context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val downloadId = downloadManager.enqueue(request)
            context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
                .edit()
                .putLong(KEY_DOWNLOAD_ID, downloadId)
                .putString(KEY_SHA256, sha256)
                .putString(KEY_FILE_NAME, fileName)
                .apply()
            result.success(downloadId)
        } catch (error: Exception) {
            result.error(
                "download_not_started",
                "Android could not start the update download.",
                null
            )
        }
    }

    companion object {
        const val PREFERENCES_NAME = "c2_store_updates"
        const val KEY_DOWNLOAD_ID = "download_id"
        const val KEY_SHA256 = "sha256"
        const val KEY_FILE_NAME = "file_name"
        const val APK_MIME_TYPE = "application/vnd.android.package-archive"
    }
}
