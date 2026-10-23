package com.c2coffeeandcandle.counter

import android.content.Context
import android.os.RemoteException
import android.util.Log
import com.sunmi.peripheral.printer.InnerPrinterCallback
import com.sunmi.peripheral.printer.InnerPrinterException
import com.sunmi.peripheral.printer.InnerPrinterManager
import com.sunmi.peripheral.printer.SunmiPrinterService
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

class SunmiPrinterHandler(private val context: Context) {
    private val tag = "SunmiPrinterHandler"
    private var printerService: SunmiPrinterService? = null

    private val callback = object : InnerPrinterCallback() {
        override fun onConnected(service: SunmiPrinterService) {
            printerService = service
            Log.i(tag, "Sunmi inner printer connected successfully")
        }

        override fun onDisconnected() {
            printerService = null
            Log.w(tag, "Sunmi inner printer disconnected")
        }
    }

    init {
        bind()
    }

    fun bind() {
        try {
            val bound = InnerPrinterManager.getInstance().bindService(context.applicationContext, callback)
            Log.i(tag, "Sunmi bindService returned: $bound")
        } catch (e: InnerPrinterException) {
            Log.e(tag, "InnerPrinterException while binding: ${e.message}")
        } catch (e: Throwable) {
            Log.e(tag, "Unexpected error binding Sunmi printer: ${e.message}")
        }
    }

    fun unbind() {
        try {
            InnerPrinterManager.getInstance().unBindService(context.applicationContext, callback)
            printerService = null
        } catch (_: Throwable) {}
    }

    fun handle(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "isAvailable" -> {
                result.success(printerService != null)
            }
            "printRawData" -> {
                val service = printerService
                if (service == null) {
                    result.error("unavailable", "Sunmi inner printer is not connected.", null)
                    return
                }
                val rawBytes = call.argument<ByteArray>("data")
                if (rawBytes == null || rawBytes.isEmpty()) {
                    result.error("invalid_data", "No print data provided.", null)
                    return
                }
                try {
                    service.sendRAWData(rawBytes, null)
                    result.success(true)
                } catch (e: RemoteException) {
                    Log.e(tag, "Failed to send raw data to Sunmi printer", e)
                    result.error("print_failed", e.message, null)
                }
            }
            "getStatus" -> {
                val service = printerService
                if (service == null) {
                    result.success("disconnected")
                    return
                }
                try {
                    val status = service.updatePrinterState()
                    result.success(when (status) {
                        1 -> "ready"
                        2 -> "initializing"
                        3 -> "comm_error"
                        4 -> "out_of_paper"
                        5 -> "overheated"
                        6 -> "cover_open"
                        7 -> "cutter_error"
                        else -> "status_$status"
                    })
                } catch (e: Throwable) {
                    result.success("unknown")
                }
            }
            else -> result.notImplemented()
        }
    }
}
