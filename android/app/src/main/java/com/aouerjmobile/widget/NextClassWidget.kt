package com.aouerjmobile.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import com.aouerjmobile.AppLaunch
import com.aouerjmobile.R
import com.aouerjmobile.notifications.ClassReminders
import java.util.Calendar

/**
 * "Próxima aula" on the home screen: the next class of the saved schedule ([NextClassStore]), with
 * the time and the room, like the Home's card. Tapping opens the app on Início.
 *
 * Redrawn when JS sends a new schedule, when the class shown starts or ends, at midnight (the day
 * label changes) and after a clock change, a reboot or an app update. The refresh alarm never wakes
 * the device (a widget nobody is looking at can wait for the screen to turn on), and there is no
 * periodic update from the system (updatePeriodMillis 0), which would wake it.
 */
class NextClassWidget : AppWidgetProvider() {

  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    draw(context, manager, ids)
  }

  override fun onDisabled(context: Context) {
    // the last widget left the home screen
    context.getSystemService(AlarmManager::class.java)?.cancel(refreshIntent(context))
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action in REFRESH_ACTIONS) updateAll(context)
  }

  companion object {
    private const val ACTION_REFRESH = "com.aouerjmobile.widget.REFRESH"
    private const val MINUTE = 60_000L
    /**
     * Without the exact alarm permission (the class reminders'), the refresh may come a little
     * late: 10 minutes is the shortest window Android allows.
     */
    private const val REFRESH_WINDOW = 10 * MINUTE

    private val REFRESH_ACTIONS =
        setOf(
            ACTION_REFRESH,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_DATE_CHANGED,
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
        )

    /** New schedule from JS, a refresh alarm or a clock change: redraw every widget. */
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context) ?: return
      val ids = manager.getAppWidgetIds(ComponentName(context, NextClassWidget::class.java))
      if (ids.isNotEmpty()) draw(context, manager, ids)
    }

    private fun draw(context: Context, manager: AppWidgetManager, ids: IntArray) {
      val now = System.currentTimeMillis()
      val schedule = NextClassStore.load(context)
      val current = schedule?.takeIf { now <= it.expiresAt }
      val next = current?.let { NextClassStore.next(it, now) }
      val views = RemoteViews(context.packageName, R.layout.widget_next_class)
      views.setOnClickPendingIntent(R.id.widget_root, AppLaunch.pendingIntent(context, "home"))
      when {
        // signed out (logout), or nothing received yet: a new widget before the app ran, or an
        // account whose schedule was not read
        schedule == null ->
            message(
                context,
                views,
                R.string.widget_heading,
                if (NextClassStore.signedOut(context)) R.string.widget_signed_out
                else R.string.widget_not_loaded,
            )
        current == null ->
            message(context, views, R.string.widget_heading, R.string.widget_outdated)
        next == null ->
            message(context, views, R.string.widget_no_classes_title, R.string.widget_no_classes)
        else -> showClass(context, views, next)
      }
      manager.updateAppWidget(ids, views)
      scheduleRefresh(context, current, next, now)
    }

    /** No class to show: the calendar icon, a title and the reason. */
    private fun message(context: Context, views: RemoteViews, title: Int, text: Int) {
      showTile(views, R.id.widget_tile_icon)
      views.setTextViewText(R.id.widget_title, context.getString(title))
      views.setViewVisibility(R.id.widget_detail, View.GONE)
      views.setViewVisibility(R.id.widget_place, View.GONE)
      views.setViewVisibility(R.id.widget_message, View.VISIBLE)
      views.setTextViewText(R.id.widget_message, context.getString(text))
      views.setContentDescription(
          R.id.widget_root,
          "${context.getString(title)}. ${context.getString(text)}",
      )
    }

    /**
     * The tile shows the day and the start; today's class gets the solid tile. Beside it: the
     * subject, "até 18:50 · T6–N1 · Sala 6019 B" and the rest of the location.
     */
    private fun showClass(context: Context, views: RemoteViews, next: NextClass) {
      val item = next.item
      val today = next.dayOffset == 0
      showTile(views, if (today) R.id.widget_tile_today else R.id.widget_tile_later)
      views.setTextViewText(
          if (today) R.id.widget_day_today else R.id.widget_day_later,
          dayLabel(context, next, R.array.widget_weekdays_short),
      )
      views.setTextViewText(
          if (today) R.id.widget_start_today else R.id.widget_start_later,
          item.startLabel,
      )
      views.setTextViewText(R.id.widget_title, item.title)
      views.setTextViewText(
          R.id.widget_detail,
          if (item.detail.isEmpty()) context.getString(R.string.widget_until, item.endLabel)
          else context.getString(R.string.widget_detail, item.endLabel, item.detail),
      )
      views.setViewVisibility(R.id.widget_detail, View.VISIBLE)
      views.setTextViewText(R.id.widget_place, item.place)
      views.setViewVisibility(
          R.id.widget_place,
          if (item.place.isEmpty()) View.GONE else View.VISIBLE,
      )
      views.setViewVisibility(R.id.widget_message, View.GONE)
      val where = listOf(item.detail, item.place).filter { it.isNotEmpty() }.joinToString(", ")
      views.setContentDescription(
          R.id.widget_root,
          context.getString(
              R.string.widget_class_description,
              dayLabel(context, next, R.array.widget_weekdays),
              item.title,
              item.startLabel,
              item.endLabel,
              where,
          ),
      )
    }

    private val TILES =
        intArrayOf(R.id.widget_tile_today, R.id.widget_tile_later, R.id.widget_tile_icon)

    private fun showTile(views: RemoteViews, tile: Int) {
      for (id in TILES) views.setViewVisibility(id, if (id == tile) View.VISIBLE else View.GONE)
    }

    /** "Agora", "Hoje" or the weekday (`weekdays`: full names or the tile's "Seg"). */
    private fun dayLabel(context: Context, next: NextClass, weekdays: Int): String =
        when {
          next.ongoing -> context.getString(R.string.widget_now)
          next.dayOffset == 0 -> context.getString(R.string.widget_today)
          else -> context.resources.getStringArray(weekdays)[next.item.weekday - 1]
        }

    /**
     * Next moment the widget changes: the class shown starts ("Agora") or ends, midnight (the day
     * label) or the schedule expires. Signed out, nothing changes until JS sends a schedule. The
     * class breaks at UERJ last 10 minutes, so the alarm is exact when the app may set exact
     * alarms (asked for the class reminders); RTC either way, which waits for the screen.
     */
    private fun scheduleRefresh(
        context: Context,
        schedule: WidgetSchedule?,
        next: NextClass?,
        now: Long,
    ) {
      val alarms = context.getSystemService(AlarmManager::class.java) ?: return
      val intent = refreshIntent(context)
      if (schedule == null) {
        alarms.cancel(intent)
        return
      }
      val moments = mutableListOf(nextMidnight(now), schedule.expiresAt + 1)
      if (next != null && next.dayOffset == 0)
          moments += todayAt(now, if (next.ongoing) next.item.end else next.item.start)
      val at = moments.filter { it > now }.minOrNull() ?: return
      if (ClassReminders.canScheduleExact(context)) alarms.setExact(AlarmManager.RTC, at, intent)
      else alarms.setWindow(AlarmManager.RTC, at, REFRESH_WINDOW, intent)
    }

    internal fun todayAt(now: Long, minutes: Int): Long =
        Calendar.getInstance()
            .apply {
              timeInMillis = now
              set(Calendar.HOUR_OF_DAY, minutes / 60)
              set(Calendar.MINUTE, minutes % 60)
              set(Calendar.SECOND, 0)
              set(Calendar.MILLISECOND, 0)
            }
            .timeInMillis

    internal fun nextMidnight(now: Long): Long =
        Calendar.getInstance()
            .apply {
              timeInMillis = now
              add(Calendar.DAY_OF_YEAR, 1)
              set(Calendar.HOUR_OF_DAY, 0)
              set(Calendar.MINUTE, 0)
              set(Calendar.SECOND, 0)
              set(Calendar.MILLISECOND, 0)
            }
            .timeInMillis

    private fun refreshIntent(context: Context): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            0,
            Intent(context, NextClassWidget::class.java).setAction(ACTION_REFRESH),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
  }
}
