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
import androidx.core.content.ContextCompat
import com.aouerjmobile.AppLaunch
import com.aouerjmobile.R
import com.aouerjmobile.notifications.ClassReminders
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * "Hoje" on the home screen: every class of the day from the saved schedule ([NextClassStore]),
 * with the start, the end, the subject and the room. The class happening now gets the soft tile
 * background and the finished ones fade. Tapping opens the app on Início.
 *
 * Same data and refresh policy as [NextClassWidget]: redrawn when JS sends a new schedule, when a
 * class of the day starts or ends, at midnight and after a clock change, a reboot or an app update,
 * with an alarm that never wakes the device.
 */
class TodayWidget : AppWidgetProvider() {

  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    draw(context, manager, ids)
  }

  override fun onDisabled(context: Context) {
    // the last "Hoje" widget left the home screen
    context.getSystemService(AlarmManager::class.java)?.cancel(refreshIntent(context))
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    if (intent.action in REFRESH_ACTIONS) updateAll(context)
  }

  companion object {
    private const val ACTION_REFRESH = "com.aouerjmobile.widget.TODAY_REFRESH"
    private const val MINUTE = 60_000L
    private const val REFRESH_WINDOW = 10 * MINUTE
    /** A day at UERJ rarely has more; the rest is summed up in the last line. */
    private const val MAX_ROWS = 6

    private val REFRESH_ACTIONS =
        setOf(
            ACTION_REFRESH,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            Intent.ACTION_DATE_CHANGED,
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
        )

    /** New schedule from JS, a refresh alarm or a clock change: redraw every "Hoje" widget. */
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context) ?: return
      val ids = manager.getAppWidgetIds(ComponentName(context, TodayWidget::class.java))
      if (ids.isNotEmpty()) draw(context, manager, ids)
    }

    private fun draw(context: Context, manager: AppWidgetManager, ids: IntArray) {
      val now = System.currentTimeMillis()
      val schedule = NextClassStore.load(context)
      val current = schedule?.takeIf { now <= it.expiresAt }
      val views = RemoteViews(context.packageName, R.layout.widget_today)
      views.setOnClickPendingIntent(R.id.widget_today_root, AppLaunch.pendingIntent(context, "home"))
      val date = dateLabel(now)
      views.setTextViewText(R.id.widget_today_date, date)
      views.removeAllViews(R.id.widget_today_rows)

      val calendar = Calendar.getInstance().apply { timeInMillis = now }
      val minutes = calendar.get(Calendar.HOUR_OF_DAY) * 60 + calendar.get(Calendar.MINUTE)
      val today =
          current
              ?.classes
              ?.filter { it.weekday == NextClassStore.weekdayOf(calendar) }
              ?.sortedBy { it.start }
              .orEmpty()
      val spoken =
          when {
            schedule == null ->
                message(
                    context,
                    views,
                    if (NextClassStore.signedOut(context)) R.string.widget_signed_out
                    else R.string.widget_not_loaded,
                )
            current == null -> message(context, views, R.string.widget_outdated)
            today.isEmpty() -> noClassesToday(context, views, current, now)
            else -> showClasses(context, views, today, minutes)
          }
      views.setContentDescription(
          R.id.widget_today_root,
          "${context.getString(R.string.widget_today)}, $date. $spoken",
      )
      manager.updateAppWidget(ids, views)
      scheduleRefresh(context, current, today, now)
    }

    /** "Domingo, 25 de outubro". */
    private fun dateLabel(now: Long): String {
      val text = SimpleDateFormat("EEEE, d 'de' MMMM", Locale.forLanguageTag("pt-BR")).format(now)
      return text.replaceFirstChar { it.uppercase() }
    }

    private fun message(context: Context, views: RemoteViews, text: Int): String =
        message(views, context.getString(text))

    private fun message(views: RemoteViews, text: String): String {
      views.setViewVisibility(R.id.widget_today_rows, View.GONE)
      views.setViewVisibility(R.id.widget_today_message, View.VISIBLE)
      views.setTextViewText(R.id.widget_today_message, text)
      return text
    }

    /** No class today: the next one, as the Home's card would show it. */
    private fun noClassesToday(
        context: Context,
        views: RemoteViews,
        schedule: WidgetSchedule,
        now: Long,
    ): String {
      val next =
          NextClassStore.next(schedule, now)
              ?: return message(context, views, R.string.widget_no_classes)
      val day = context.resources.getStringArray(R.array.widget_weekdays)[next.item.weekday - 1]
      return message(
          views,
          context.getString(R.string.widget_today_next, day, next.item.startLabel, next.item.title),
      )
    }

    private fun showClasses(
        context: Context,
        views: RemoteViews,
        today: List<WidgetClass>,
        minutes: Int,
    ): String {
      views.setViewVisibility(R.id.widget_today_message, View.GONE)
      views.setViewVisibility(R.id.widget_today_rows, View.VISIBLE)
      val muted = ContextCompat.getColor(context, R.color.widget_muted)
      val accent = ContextCompat.getColor(context, R.color.widget_accent)
      val spoken = mutableListOf<String>()
      for (item in today.take(MAX_ROWS)) {
        val ongoing = item.start <= minutes && minutes < item.end
        val past = item.end <= minutes
        val row = RemoteViews(context.packageName, R.layout.widget_today_row)
        row.setTextViewText(R.id.widget_today_row_start, item.startLabel)
        row.setTextViewText(
            R.id.widget_today_row_end,
            context.getString(R.string.widget_until, item.endLabel),
        )
        row.setTextViewText(R.id.widget_today_row_title, item.title)
        val where = listOf(item.detail, item.place).filter { it.isNotEmpty() }.joinToString(" · ")
        row.setTextViewText(R.id.widget_today_row_detail, where)
        row.setViewVisibility(
            R.id.widget_today_row_detail,
            if (where.isEmpty()) View.GONE else View.VISIBLE,
        )
        if (ongoing) {
          row.setInt(R.id.widget_today_row, "setBackgroundResource", R.drawable.widget_row_now)
          row.setTextColor(R.id.widget_today_row_start, accent)
        }
        if (past) {
          row.setTextColor(R.id.widget_today_row_start, muted)
          row.setTextColor(R.id.widget_today_row_title, muted)
        }
        views.addView(R.id.widget_today_rows, row)
        val state =
            when {
              ongoing -> context.getString(R.string.widget_today_row_now)
              past -> context.getString(R.string.widget_today_row_past)
              else -> ""
            }
        spoken +=
            context.getString(
                R.string.widget_today_row_description,
                state,
                item.title,
                item.startLabel,
                item.endLabel,
                if (where.isEmpty()) "" else ", $where",
            )
      }
      val hidden = today.size - MAX_ROWS
      if (hidden > 0) {
        val more =
            context.resources.getQuantityString(R.plurals.widget_today_more, hidden, hidden)
        val row = RemoteViews(context.packageName, R.layout.widget_today_row)
        row.setTextViewText(R.id.widget_today_row_title, more)
        row.setTextColor(R.id.widget_today_row_title, muted)
        row.setViewVisibility(R.id.widget_today_row_detail, View.GONE)
        views.addView(R.id.widget_today_rows, row)
        spoken += more
      }
      return spoken.joinToString(" ")
    }

    /**
     * Next moment the widget changes: a class of the day starts or ends, midnight (the day and its
     * classes) or the schedule expires. Signed out, nothing changes until JS sends a schedule.
     */
    private fun scheduleRefresh(
        context: Context,
        schedule: WidgetSchedule?,
        today: List<WidgetClass>,
        now: Long,
    ) {
      val alarms = context.getSystemService(AlarmManager::class.java) ?: return
      val intent = refreshIntent(context)
      if (schedule == null) {
        alarms.cancel(intent)
        return
      }
      val moments = mutableListOf(NextClassWidget.nextMidnight(now), schedule.expiresAt + 1)
      for (item in today) {
        moments += NextClassWidget.todayAt(now, item.start)
        moments += NextClassWidget.todayAt(now, item.end)
      }
      val at = moments.filter { it > now }.minOrNull() ?: return
      if (ClassReminders.canScheduleExact(context)) alarms.setExact(AlarmManager.RTC, at, intent)
      else alarms.setWindow(AlarmManager.RTC, at, REFRESH_WINDOW, intent)
    }

    private fun refreshIntent(context: Context): PendingIntent =
        PendingIntent.getBroadcast(
            context,
            0,
            Intent(context, TodayWidget::class.java).setAction(ACTION_REFRESH),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
  }
}
