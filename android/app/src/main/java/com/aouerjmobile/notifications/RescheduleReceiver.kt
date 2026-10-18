package com.aouerjmobile.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Alarms do not survive a reboot, and a clock or time zone change (or a new exact-alarm permission)
 * changes when they should fire: reschedule the saved class reminders. After an app update they
 * are rescheduled too, which also starts [ClassReminderWorker] for plans saved before it existed.
 * WorkManager reschedules its own work (that worker and the portal check) by itself.
 */
class RescheduleReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action in ACTIONS) ClassReminders.reschedule(context)
  }

  private companion object {
    val ACTIONS =
        setOf(
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED",
        )
  }
}
