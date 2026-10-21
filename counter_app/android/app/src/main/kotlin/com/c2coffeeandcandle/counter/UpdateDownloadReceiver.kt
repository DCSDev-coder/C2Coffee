package com.c2coffeeandcandle.counter

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Environment
import android.widget.Toast
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

class UpdateDownloadReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != DownloadManager.ACTION_DOWNLOAD_COMPLETE) return

        val preferences = context.getSharedPreferences(
            AppUpdateHandler.PREFERENCES_NAME,
            Context.MODE_PRIVATE
        )
        val expectedDownloadId = preferences.getLong(AppUpdateHandler.KEY_DOWNLOAD_ID, -1L)
        val completedDownloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L)
        if (expectedDownloadId < 0 || completedDownloadId != expectedDownloadId) return

        val pendingResult = goAsync()
        Thread {
            try {
                verifyAndOpenInstaller(context, preferences, completedDownloadId)
            } finally {
                pendingResult.finish()
            }
        }.start()
    }

    private fun verifyAndOpenInstaller(
        context: Context,
        preferences: android.content.SharedPreferences,
        downloadId: Long
    ) {
        val downloadManager =
            context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val cursor = downloadManager.query(DownloadManager.Query().setFilterById(downloadId))
        cursor.use {
            if (!it.moveToFirst()) {
                fail(context, preferences, "The downloaded update could not be found.")
                return
            }
            val status = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
            if (status != DownloadManager.STATUS_SUCCESSFUL) {
                fail(context, preferences, "The C2 Store update download failed.")
                return
            }
        }

        val fileName = preferences.getString(AppUpdateHandler.KEY_FILE_NAME, null)
        val expectedSha256 = preferences.getString(AppUpdateHandler.KEY_SHA256, null)
        if (fileName.isNullOrBlank() || expectedSha256.isNullOrBlank()) {
            fail(context, preferences, "The update verification information is missing.")
            return
        }
        val updateDirectory = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
        val apkFile = updateDirectory?.let { File(it, fileName) }
        if (apkFile == null || !apkFile.isFile) {
            fail(context, preferences, "The downloaded update file is missing.")
            return
        }
        if (sha256(apkFile) != expectedSha256) {
            apkFile.delete()
            fail(context, preferences, "Update verification failed. The APK was deleted.")
            return
        }

        preferences.edit().clear().apply()
        val apkUri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            apkFile
        )
        val installIntent = Intent(Intent.ACTION_VIEW)
            .setDataAndType(apkUri, AppUpdateHandler.APK_MIME_TYPE)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        try {
            context.startActivity(installIntent)
        } catch (error: Exception) {
            Toast.makeText(
                context,
                "Android could not open the C2 Store installer.",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { input ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
                val read = input.read(buffer)
                if (read <= 0) break
                digest.update(buffer, 0, read)
            }
        }
        return digest.digest().joinToString("") { byte -> "%02x".format(byte) }
    }

    private fun fail(
        context: Context,
        preferences: android.content.SharedPreferences,
        message: String
    ) {
        preferences.edit().clear().apply()
        Toast.makeText(context, message, Toast.LENGTH_LONG).show()
    }
}
