package com.aouerjmobile.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** A Companhia agora reminder alarm fired (not exported: only AlarmManager calls it). */
class CompanionReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == CompanionReminders.ACTION_REMIND) CompanionReminders.onAlarm(context, intent)
  }
}
