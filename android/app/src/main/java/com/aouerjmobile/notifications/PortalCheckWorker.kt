package com.aouerjmobile.notifications

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactInstanceEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.common.LifecycleState
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import com.facebook.react.jstasks.HeadlessJsTaskEventListener
import java.util.Calendar
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Periodic check of the Aluno Online for new grades, RID changes and expiring documents. The work
 * itself is JS (portal adapter and parsers), run as a headless task in the app's React instance
 * (started here when the app is not running). Skipped while the app is on screen: it refreshes the
 * same data itself. At night or with notifications off it stops before starting React Native.
 */
class PortalCheckWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

  override suspend fun doWork(): Result {
    // Revoking "Alarms & reminders" cancels the exact alarms with no broadcast: re-arm them here
    // (inexact if needed), without waiting for the app to open.
    ClassReminders.reschedule(applicationContext)
    // JS keeps the rules (quiet hours, pause, permission, remote switch): this only spares starting
    // React Native when the check would stop right away.
    if (isQuietTime() || !AppNotifier.areEnabled(applicationContext)) return Result.success()
    val host = (applicationContext as? ReactApplication)?.reactHost ?: return Result.success()
    // A failed check waits for the next period; retrying sooner would add load to the portal.
    withTimeoutOrNull(TASK_TIMEOUT + START_TIMEOUT) {
      withContext(Dispatchers.Main) { runTask(host) }
    }
    return Result.success()
  }

  /** Same rule as isQuietTime in src/modules/notifications/domain/checkState.ts (device time). */
  private fun isQuietTime(): Boolean {
    val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
    return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR
  }

  private suspend fun runTask(host: ReactHost) {
    val context = host.currentReactContext ?: start(host)
    if (context.lifecycleState == LifecycleState.RESUMED) return
    val tasks = HeadlessJsTaskContext.getInstance(context)
    suspendCancellableCoroutine { continuation ->
      val listener =
          object : HeadlessJsTaskEventListener {
            var taskId = -1

            override fun onHeadlessJsTaskStart(taskId: Int) = Unit

            override fun onHeadlessJsTaskFinish(taskId: Int) {
              if (taskId != this.taskId) return
              tasks.removeTaskEventListener(this)
              if (continuation.isActive) continuation.resume(Unit)
            }
          }
      tasks.addTaskEventListener(listener)
      continuation.invokeOnCancellation { tasks.removeTaskEventListener(listener) }
      try {
        // the JS side ends the task; the timeout ends it if JS never does
        val data = Arguments.createMap()
        inputData.getString(KEY_MODE)?.let { data.putString(KEY_MODE, it) }
        listener.taskId =
            tasks.startTask(HeadlessJsTaskConfig(TASK_NAME, data, TASK_TIMEOUT, false))
      } catch (_: IllegalStateException) {
        // the app came to the foreground meanwhile
        tasks.removeTaskEventListener(listener)
        if (continuation.isActive) continuation.resume(Unit)
      }
    }
  }

  /** Starts React Native without an activity, as HeadlessJsTaskService does. */
  private suspend fun start(host: ReactHost): ReactContext = suspendCancellableCoroutine {
      continuation ->
    val listener =
        object : ReactInstanceEventListener {
          override fun onReactContextInitialized(context: ReactContext) {
            host.removeReactInstanceEventListener(this)
            if (continuation.isActive) continuation.resume(context)
          }
        }
    host.addReactInstanceEventListener(listener)
    continuation.invokeOnCancellation { host.removeReactInstanceEventListener(listener) }
    host.start()
  }

  companion object {
    /** Same name as PORTAL_CHECK_TASK in src/app/background/portalCheckTask.ts. */
    private const val TASK_NAME = "AoUerjPortalCheck"
    private const val TASK_TIMEOUT = 4 * 60 * 1000L
    private const val START_TIMEOUT = 60 * 1000L
    private const val WORK_NAME = "ao-portal-check"
    private const val RETURN_WORK_NAME = "ao-portal-return"
    /** Same key and value as the task data read in src/app/background/portalCheckTask.ts. */
    private const val KEY_MODE = "mode"
    private const val MODE_RETURN = "return"
    /** No portal check from 22h to 7h. */
    private const val QUIET_START_HOUR = 22
    private const val QUIET_END_HOUR = 7

    /**
     * Enables (every [intervalHours], on a network, battery not low) or cancels the check. The
     * first run waits an hour: it is enabled with the app on screen, when it would be skipped.
     */
    fun schedule(context: Context, enabled: Boolean, intervalHours: Long) {
      val work = WorkManager.getInstance(context)
      if (!enabled) {
        work.cancelUniqueWork(WORK_NAME)
        return
      }
      val request =
          PeriodicWorkRequestBuilder<PortalCheckWorker>(intervalHours, TimeUnit.HOURS)
              .setConstraints(
                  Constraints.Builder()
                      .setRequiredNetworkType(NetworkType.CONNECTED)
                      .setRequiresBatteryNotLow(true)
                      .build()
              )
              .setInitialDelay(1, TimeUnit.HOURS)
              .build()
      // UPDATE keeps the current period: reopening the app does not restart the countdown.
      work.enqueueUniquePeriodicWork(WORK_NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
    }

    /**
     * "Avisar quando voltar": the same task in `return` mode, every 15 minutes (WorkManager's
     * minimum) on a network. JS tests the portal, notifies once and cancels this work.
     */
    fun scheduleReturnWatch(context: Context, enabled: Boolean) {
      val work = WorkManager.getInstance(context)
      if (!enabled) {
        work.cancelUniqueWork(RETURN_WORK_NAME)
        return
      }
      val request =
          PeriodicWorkRequestBuilder<PortalCheckWorker>(15, TimeUnit.MINUTES)
              .setConstraints(
                  Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()
              )
              .setInputData(workDataOf(KEY_MODE to MODE_RETURN))
              .setInitialDelay(15, TimeUnit.MINUTES)
              .build()
      work.enqueueUniquePeriodicWork(RETURN_WORK_NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
    }
  }
}
