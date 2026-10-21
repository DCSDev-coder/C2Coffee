package com.c2coffeeandcandle.counter

import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Handler
import android.os.Looper
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val soundChannel = "com.c2coffee.counter/barista_sounds"
    private val updateChannel = "com.c2coffee.counter/app_updates"
    private val soundHandler = Handler(Looper.getMainLooper())

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, soundChannel)
            .setMethodCallHandler { call, result ->
                if (call.method != "playBeeps") {
                    result.notImplemented()
                    return@setMethodCallHandler
                }
                val count = (call.argument<Int>("count") ?: 1).coerceIn(1, 5)
                val volume = (call.argument<Int>("volumePercent") ?: 70).coerceIn(0, 100)
                val style = call.argument<String>("style") ?: "short"
                try {
                    playBeeps(count, volume, style)
                    result.success(null)
                } catch (error: RuntimeException) {
                    result.error("sound_unavailable", "The device could not play the beep pattern.", null)
                }
            }
        val updateHandler = AppUpdateHandler(this)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, updateChannel)
            .setMethodCallHandler(updateHandler::handle)
    }

    private fun playBeeps(count: Int, volumePercent: Int, style: String) {
        if (volumePercent == 0) return
        val toneGenerator = ToneGenerator(AudioManager.STREAM_MUSIC, volumePercent)
        val interval = when (style) {
            "long" -> 760L
            "two_tone" -> 520L
            else -> 240L
        }
        repeat(count) { index ->
            val startsAt = index * interval
            when (style) {
                "long" -> soundHandler.postDelayed(
                    { toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP, 650) },
                    startsAt
                )
                "two_tone" -> {
                    soundHandler.postDelayed(
                        { toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP, 160) },
                        startsAt
                    )
                    soundHandler.postDelayed(
                        { toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP2, 220) },
                        startsAt + 190L
                    )
                }
                else -> soundHandler.postDelayed(
                    { toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP, 140) },
                    startsAt
                )
            }
        }
        soundHandler.postDelayed({ toneGenerator.release() }, count * interval + 200L)
    }
}
