package com.aouerjmobile.notifications

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactInstanceEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.common.LifecycleState
import com.facebook.react.jstasks.HeadlessJsTaskConfig
import com.facebook.react.jstasks.HeadlessJsTaskContext
import com.facebook.react.jstasks.HeadlessJsTaskEventListener
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
 * same data itself.
 */
class PortalCheckWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

  override suspend fun doWork(): Result {
    // Revoking "Alarms & reminders" cancels the exact alarms with no broadcast: re-arm them here
    // (inexact if needed), without waiting for the app to open.
    ClassReminders.reschedule(applicationContext)
    val host = (applicationContext as? ReactApplication)?.reactHost ?: return Result.success()
    // A failed check waits for the next period; retrying sooner would add load to the portal.
    withTimeoutOrNull(TASK_TIMEOUT + START_TIMEOUT) {
      withContext(Dispatchers.Main) { runTask(host) }
    }
    return Result.success()
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
        listener.taskId =
            tasks.startTask(
                HeadlessJsTaskConfig(TASK_NAME, Arguments.createMap(), TASK_TIMEOUT, false)
            )
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
  }
}
