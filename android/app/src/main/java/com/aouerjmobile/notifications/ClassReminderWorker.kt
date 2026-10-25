package com.aouerjmobile.notifications

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * Reschedules the saved class and evaluation reminders every few hours, with no network and without
 * React Native. Revoking "Alarms & reminders" cancels the exact alarms with no broadcast, and the
 * portal check (which reschedules class reminders too) may be off: without this the reminders would
 * stop until the app opens or the phone restarts.
 */
class ClassReminderWorker(context: Context, params: WorkerParameters) : Worker(context, params) {

  override fun doWork(): Result {
    ClassReminders.reschedule(applicationContext)
    EvaluationReminders.reschedule(applicationContext)
    return Result.success()
  }

  companion object {
    private const val WORK_NAME = "ao-class-reminders"
    /** The longest stretch without reminders after the exact alarms were revoked. */
    private const val INTERVAL_HOURS = 6L

    /** Keeps the work while either plan has reminders to show (reads both, without their locks). */
    fun refresh(context: Context) {
      schedule(context, ClassReminders.isActive(context) || EvaluationReminders.hasPending(context))
    }

    /**
     * Keeps the work while a plan has reminders to show, cancels it otherwise. The first run waits
     * a full interval: the plan was just scheduled.
     */
    private fun schedule(context: Context, enabled: Boolean) {
      val work = WorkManager.getInstance(context)
      if (!enabled) {
        work.cancelUniqueWork(WORK_NAME)
        return
      }
      val request =
          PeriodicWorkRequestBuilder<ClassReminderWorker>(INTERVAL_HOURS, TimeUnit.HOURS)
              .setInitialDelay(INTERVAL_HOURS, TimeUnit.HOURS)
              .build()
      // KEEP: every plan and every reschedule calls this; the countdown goes on.
      work.enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request)
    }
  }
}
