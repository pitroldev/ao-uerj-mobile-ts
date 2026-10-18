package com.aouerjmobile.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** A class reminder alarm fired (not exported: only AlarmManager calls it). */
class ClassReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == ClassReminders.ACTION_REMIND) ClassReminders.onAlarm(context, intent)
  }
}
