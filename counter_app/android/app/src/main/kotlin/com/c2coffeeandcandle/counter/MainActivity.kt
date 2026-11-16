package com.c2coffeeandcandle.counter

import android.media.AudioManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.media.ToneGenerator
import android.os.Handler
import android.os.Looper
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.sin

class MainActivity : FlutterActivity() {
    private val soundChannel = "com.c2coffee.counter/barista_sounds"
    private val updateChannel = "com.c2coffee.counter/app_updates"
    private val sunmiChannel = "com.c2coffee.counter/sunmi_printer"
    private val soundHandler = Handler(Looper.getMainLooper())
    private var sunmiHandler: SunmiPrinterHandler? = null

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

        val handler = SunmiPrinterHandler(this)
        sunmiHandler = handler
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, sunmiChannel)
            .setMethodCallHandler(handler::handle)
    }

    override fun onDestroy() {
        sunmiHandler?.unbind()
        super.onDestroy()
    }

    private fun playBeeps(count: Int, volumePercent: Int, style: String) {
        if (volumePercent == 0) return
        if (style == "new_order") {
            playNewOrderChime(count, volumePercent)
            return
        }
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

    private fun playNewOrderChime(count: Int, volumePercent: Int) {
        val sampleRate = 44100
        val noteDurationMs = 150
        val gapMs = 35
        val noteFrequencies = doubleArrayOf(659.25, 783.99, 987.77)
        val chimeDurationMs = noteFrequencies.size * noteDurationMs + (noteFrequencies.size - 1) * gapMs
        val repeatGapMs = 900
        val totalDurationMs = count * chimeDurationMs + (count - 1) * repeatGapMs
        val totalSamples = sampleRate * totalDurationMs / 1000
        val pcm = ShortArray(totalSamples)
        val amplitude = (Short.MAX_VALUE * (volumePercent.coerceIn(0, 100) / 100.0) * 0.32).toInt()

        repeat(count) { repeatIndex ->
            val repeatStartMs = repeatIndex * (chimeDurationMs + repeatGapMs)
            noteFrequencies.forEachIndexed { noteIndex, frequency ->
                val noteStartMs = repeatStartMs + noteIndex * (noteDurationMs + gapMs)
                val startSample = sampleRate * noteStartMs / 1000
                val noteSamples = sampleRate * noteDurationMs / 1000
                repeat(noteSamples) { offset ->
                    val progress = offset.toDouble() / noteSamples
                    val envelope = when {
                        progress < 0.08 -> progress / 0.08
                        progress > 0.88 -> (1.0 - progress) / 0.12
                        else -> 1.0
                    }
                    pcm[startSample + offset] = (sin(2.0 * PI * frequency * offset / sampleRate) * amplitude * envelope).toInt().toShort()
                }
            }
        }

        val bytes = ByteBuffer.allocate(pcm.size * 2).order(ByteOrder.LITTLE_ENDIAN)
        pcm.forEach { bytes.putShort(it) }
        val track = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(sampleRate)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
            )
            .setBufferSizeInBytes(bytes.capacity())
            .setTransferMode(AudioTrack.MODE_STATIC)
            .build()
        track.write(bytes.array(), 0, bytes.capacity())
        track.play()
        soundHandler.postDelayed({ track.release() }, totalDurationMs + 150L)
    }
}
