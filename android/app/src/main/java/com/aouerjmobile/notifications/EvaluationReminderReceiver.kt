package com.aouerjmobile.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * An evaluation reminder alarm fired, or "Já fiz" was tapped on its notification (not exported:
 * only AlarmManager and the app's own notification call it).
 */
class EvaluationReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      EvaluationReminders.ACTION_REMIND -> EvaluationReminders.onAlarm(context, intent)
      EvaluationReminders.ACTION_DONE -> EvaluationReminders.markDone(context, intent)
    }
  }
}
