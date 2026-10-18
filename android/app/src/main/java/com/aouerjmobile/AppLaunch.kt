package com.aouerjmobile

import android.app.PendingIntent
import android.content.Context
import android.content.Intent

/**
 * Opening the app on a screen from outside it: a tapped notification, the widget or an app icon
 * shortcut (res/xml/shortcuts.xml, through [ShortcutActivity]). The intent carries the target
 * ("home", "grades", "map" or "documents"), read once by JS through
 * AppNotificationsModule.consumeLaunchTarget.
 *
 * The values predate the shortcuts and the widget and must not change: notifications already shown
 * and shortcuts pinned by the user keep them.
 */
object AppLaunch {
  const val ACTION_OPEN = "com.aouerjmobile.notifications.OPEN"
  const val EXTRA_TARGET = "com.aouerjmobile.notifications.TARGET"

  /**
   * Opens MainActivity (singleTask) on [target]. With the app open, the activity stays and gets the
   * intent in onNewIntent: the screen the user was on is kept.
   */
  fun intent(context: Context, target: String): Intent =
      Intent(context, MainActivity::class.java).apply {
        action = ACTION_OPEN
        putExtra(EXTRA_TARGET, target)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      }

  /** [intent] for a notification or the widget; one PendingIntent per target. */
  fun pendingIntent(context: Context, target: String): PendingIntent =
      PendingIntent.getActivity(
          context,
          target.hashCode(),
          intent(context, target),
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
}
