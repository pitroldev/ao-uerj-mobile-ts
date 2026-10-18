package com.aouerjmobile.notifications

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.aouerjmobile.AppLaunch
import com.aouerjmobile.specs.NativeAppNotificationsSpec
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap

/**
 * Notifications for JS (spec: src/specs/NativeAppNotifications.ts): permission state, system
 * settings, weekly class reminders, the periodic portal check and the notification that opened the
 * app.
 */
class AppNotificationsModule(reactContext: ReactApplicationContext) :
    NativeAppNotificationsSpec(reactContext), ActivityEventListener {

  override fun initialize() {
    super.initialize()
    reactApplicationContext.addActivityEventListener(this)
    AppNotifier.ensureChannels(reactApplicationContext)
  }

  override fun invalidate() {
    reactApplicationContext.removeActivityEventListener(this)
    super.invalidate()
  }

  override fun areNotificationsEnabled(promise: Promise) {
    promise.resolve(AppNotifier.areEnabled(reactApplicationContext))
  }

  override fun openNotificationSettings(promise: Promise) {
    val packageName = reactApplicationContext.packageName
    val intent =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
        else
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", packageName, null))
    open(intent, promise)
  }

  override fun canScheduleExactAlarms(promise: Promise) {
    promise.resolve(ClassReminders.canScheduleExact(reactApplicationContext))
  }

  override fun openExactAlarmSettings(promise: Promise) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
      promise.resolve(null)
      return
    }
    open(
        Intent(
            Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
            Uri.fromParts("package", reactApplicationContext.packageName, null),
        ),
        promise,
    )
  }

  override fun setClassReminders(plan: String, promise: Promise) {
    try {
      ClassReminders.replace(reactApplicationContext, plan)
      promise.resolve(null)
    } catch (error: RuntimeException) {
      promise.reject(E_REMINDERS, error.message, error)
    }
  }

  override fun setPortalCheck(enabled: Boolean, intervalHours: Double, promise: Promise) {
    try {
      PortalCheckWorker.schedule(
          reactApplicationContext,
          enabled,
          intervalHours.toLong().coerceIn(MIN_INTERVAL_HOURS, MAX_INTERVAL_HOURS),
      )
      promise.resolve(null)
    } catch (error: RuntimeException) {
      promise.reject(E_PORTAL_CHECK, error.message, error)
    }
  }

  override fun notify(notification: ReadableMap, promise: Promise) {
    val text = { key: String -> notification.getString(key).orEmpty() }
    AppNotifier.post(
        reactApplicationContext,
        AppNotification(
            id = text("id"),
            channel = text("channel"),
            title = text("title"),
            body = text("body"),
            publicTitle = text("publicTitle"),
            publicBody = text("publicBody"),
            target = text("target"),
        ),
    )
    promise.resolve(null)
  }

  /**
   * Sign out or account switch: the previous account's class reminders are cancelled, then its
   * notifications leave the shade. In this order no reminder firing in between stays in the shade;
   * JS sends the next account's plan afterwards.
   */
  override fun clearNotifications(promise: Promise) {
    try {
      ClassReminders.replace(reactApplicationContext, "")
    } catch (_: RuntimeException) {
      // the shade is cleared anyway, and JS cancels the plan again right after
    }
    NotificationManagerCompat.from(reactApplicationContext).cancelAll()
    promise.resolve(null)
  }

  /**
   * Target of the last tapped notification: the one that opened the activity or brought it back
   * (MainActivity keeps the new intent). Removed so it is read once.
   */
  override fun consumeLaunchTarget(promise: Promise) {
    val intent = reactApplicationContext.currentActivity?.intent
    val target =
        intent?.takeIf { it.action == AppLaunch.ACTION_OPEN }?.getStringExtra(AppLaunch.EXTRA_TARGET)
    intent?.removeExtra(AppLaunch.EXTRA_TARGET)
    promise.resolve(target)
  }

  /**
   * A notification tapped while the task exists (MainActivity is singleTask). The event only tells
   * JS to call consumeLaunchTarget: JS may be running without the screen (background check), and
   * then the screen reads the target when it mounts.
   */
  override fun onNewIntent(intent: Intent) {
    if (intent.action != AppLaunch.ACTION_OPEN) return
    val target = intent.getStringExtra(AppLaunch.EXTRA_TARGET) ?: return
    // set by the TurboModule infra once JS holds the module
    if (mEventEmitterCallback != null) emitOnOpenTarget(target)
  }

  override fun onActivityResult(
      activity: Activity,
      requestCode: Int,
      resultCode: Int,
      data: Intent?,
  ) = Unit

  private fun open(intent: Intent, promise: Promise) {
    try {
      val activity = reactApplicationContext.currentActivity
      if (activity != null) activity.startActivity(intent)
      else reactApplicationContext.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      promise.resolve(null)
    } catch (error: ActivityNotFoundException) {
      promise.reject(E_SETTINGS, error.message, error)
    }
  }

  companion object {
    const val NAME = NativeAppNotificationsSpec.NAME
    private const val E_SETTINGS = "E_NOTIFICATION_SETTINGS"
    private const val E_REMINDERS = "E_CLASS_REMINDERS"
    private const val E_PORTAL_CHECK = "E_PORTAL_CHECK"
    private const val MIN_INTERVAL_HOURS = 1L
    private const val MAX_INTERVAL_HOURS = 24L
  }
}
