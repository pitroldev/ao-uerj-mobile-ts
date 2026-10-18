package com.aouerjmobile.notifications

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import java.util.Calendar
import org.json.JSONException
import org.json.JSONObject

/**
 * Weekly class reminders on AlarmManager. JS sends the plan (texts, weekday and minute of each
 * reminder, the lead time, expiry) and this object keeps it in SharedPreferences, so reboots and
 * clock changes reschedule without JS. Each alarm, when it fires, posts its reminder and schedules
 * the same class for next week until the plan expires.
 *
 * The entry points are synchronized: JS replaces the plan on the TurboModule thread while alarms
 * fire on the main thread.
 */
internal object ClassReminders {
  const val ACTION_REMIND = "com.aouerjmobile.notifications.REMIND"
  private const val EXTRA_INDEX = "index"
  private const val EXTRA_ID = "id"
  private const val EXTRA_AT = "at"

  private const val PREFS = "ao_notifications"
  private const val KEY_PLAN = "class_reminders"
  private const val KEY_COUNT = "class_reminders_count"
  /**
   * Planned time of the last reminder shown for each class. Without exact alarms a reminder can
   * fire up to 10 minutes early; a plan sent again before the planned time must not repeat it.
   */
  private const val KEY_SHOWN = "class_reminders_shown"

  /** More than a full week of classes; extra entries are ignored. */
  private const val MAX_REMINDERS = 100
  private const val MINUTE = 60_000L
  /** Without exact alarms the system may deliver anywhere in this window (10 min minimum). */
  private const val WINDOW = 10 * MINUTE
  /** Lead time of plans saved before it was sent with them. */
  private const val DEFAULT_LEAD_MINUTES = 20
  /** The reminder leaves the shade on its own after the class has started. */
  private const val TIMEOUT = 90 * MINUTE

  private data class Reminder(
      val id: String,
      /** 1 = Monday … 7 = Sunday. */
      val weekday: Int,
      /** Minutes after midnight when the reminder is shown. */
      val minutes: Int,
      val title: String,
      val body: String,
  )

  private data class Plan(
      val expiresAt: Long,
      /** Minutes between the reminder and the start of the class. */
      val leadMinutes: Int,
      val reminders: List<Reminder>,
  )

  private fun prefs(context: Context) =
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  /** Throws [JSONException] for a malformed plan; a malformed reminder is just left out. */
  private fun parse(json: String): Plan {
    val root = JSONObject(json)
    val items = root.getJSONArray("reminders")
    val reminders =
        (0 until minOf(items.length(), MAX_REMINDERS)).mapNotNull { index ->
          try {
            val item = items.getJSONObject(index)
            val weekday = item.getInt("weekday")
            val minutes = item.getInt("minutes")
            if (weekday !in 1..7 || minutes !in 0 until 24 * 60) null
            else
                Reminder(
                    id = item.getString("id"),
                    weekday = weekday,
                    minutes = minutes,
                    title = item.getString("title"),
                    body = item.getString("body"),
                )
          } catch (_: JSONException) {
            null
          }
        }
    return Plan(
        root.getLong("expiresAt"),
        root.optInt("leadMinutes", DEFAULT_LEAD_MINUTES),
        reminders,
    )
  }

  private fun load(context: Context): Plan? {
    val json = prefs(context).getString(KEY_PLAN, null) ?: return null
    return try {
      parse(json)
    } catch (_: JSONException) {
      null
    }
  }

  /**
   * Replaces the plan and schedules it; an empty text cancels everything. A malformed plan throws
   * [IllegalArgumentException] and the current plan stays.
   */
  @Synchronized
  fun replace(context: Context, json: String) {
    val plan =
        if (json.isEmpty()) null
        else
            try {
              parse(json)
            } catch (error: JSONException) {
              throw IllegalArgumentException("Malformed class reminder plan", error)
            }
    val prefs = prefs(context)
    val previousCount = prefs.getInt(KEY_COUNT, 0)
    val ids = plan?.reminders?.map { it.id }?.toSet().orEmpty()
    prefs
        .edit()
        .putString(KEY_PLAN, if (plan == null) null else json)
        .putInt(KEY_COUNT, plan?.reminders?.size ?: 0)
        .putString(KEY_SHOWN, JSONObject(shown(context).filterKeys { it in ids }).toString())
        .commit()
    val count = plan?.reminders?.size ?: 0
    for (index in count until previousCount) cancel(context, index)
    schedule(context, plan)
  }

  /** Boot, clock or exact-alarm permission change, periodic check: same plan, new alarms. */
  @Synchronized
  fun reschedule(context: Context) {
    schedule(context, load(context))
  }

  private fun schedule(context: Context, plan: Plan?) {
    if (plan == null) return
    val now = System.currentTimeMillis()
    val shown = shown(context)
    plan.reminders.forEachIndexed { index, reminder ->
      scheduleNext(context, plan, index, reminder, maxOf(now, shown[reminder.id] ?: 0L))
    }
  }

  private fun scheduleNext(
      context: Context,
      plan: Plan,
      index: Int,
      reminder: Reminder,
      after: Long,
  ) {
    val at = nextOccurrence(reminder.weekday, reminder.minutes, after)
    if (at > plan.expiresAt) {
      cancel(context, index)
      return
    }
    val alarms = context.getSystemService(AlarmManager::class.java) ?: return
    val intent = alarmIntent(context, index, reminder.id, at)
    if (canScheduleExact(context)) {
      alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent)
    } else {
      // the window ends at the planned time: early rather than late
      alarms.setWindow(AlarmManager.RTC_WAKEUP, at - WINDOW, WINDOW, intent)
    }
  }

  /** Alarm fired: post the reminder (if the class has not started) and schedule next week. */
  @Synchronized
  fun onAlarm(context: Context, intent: Intent) {
    val plan = load(context) ?: return
    val index = intent.getIntExtra(EXTRA_INDEX, -1)
    val reminder = plan.reminders.getOrNull(index) ?: return
    val now = System.currentTimeMillis()
    if (reminder.id != intent.getStringExtra(EXTRA_ID)) {
      // alarm of a previous plan: the slot now belongs to another class
      scheduleNext(context, plan, index, reminder, maxOf(now, shown(context)[reminder.id] ?: 0L))
      return
    }
    val at = intent.getLongExtra(EXTRA_AT, now)
    // Doze can deliver an inexact alarm late: after the class has started it is pointless
    if (now <= plan.expiresAt && now < at + plan.leadMinutes * MINUTE) {
      AppNotifier.post(
          context,
          AppNotification(
              id = "class:${reminder.id}",
              channel = AppNotifier.CHANNEL_CLASS_REMINDERS,
              title = reminder.title,
              body = reminder.body,
              publicTitle = "Aula em breve",
              publicBody = "Toque para ver no AO UERJ.",
              target = "home",
              timeoutMillis = TIMEOUT,
          ),
      )
    }
    markShown(context, reminder.id, at)
    scheduleNext(context, plan, index, reminder, maxOf(now, at) + MINUTE)
  }

  fun canScheduleExact(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    val alarms = context.getSystemService(AlarmManager::class.java) ?: return false
    return alarms.canScheduleExactAlarms()
  }

  private fun shown(context: Context): Map<String, Long> {
    val json = prefs(context).getString(KEY_SHOWN, null) ?: return emptyMap()
    return try {
      val root = JSONObject(json)
      root.keys().asSequence().associateWith { root.getLong(it) }
    } catch (_: JSONException) {
      emptyMap()
    }
  }

  private fun markShown(context: Context, id: String, at: Long) {
    val shown = shown(context) + (id to at)
    prefs(context).edit().putString(KEY_SHOWN, JSONObject(shown).toString()).commit()
  }

  /** Next weekday/minute strictly after [after], in the device's time zone. */
  private fun nextOccurrence(weekday: Int, minutes: Int, after: Long): Long {
    val calendar =
        Calendar.getInstance().apply {
          timeInMillis = after
          set(Calendar.HOUR_OF_DAY, minutes / 60)
          set(Calendar.MINUTE, minutes % 60)
          set(Calendar.SECOND, 0)
          set(Calendar.MILLISECOND, 0)
        }
    // Calendar: Sunday = 1, Monday = 2 … Saturday = 7
    val target = weekday % 7 + 1
    val days = (target - calendar.get(Calendar.DAY_OF_WEEK) + 7) % 7
    calendar.add(Calendar.DAY_OF_YEAR, days)
    if (calendar.timeInMillis <= after) calendar.add(Calendar.DAY_OF_YEAR, 7)
    return calendar.timeInMillis
  }

  private fun alarmIntent(context: Context, index: Int, id: String, at: Long): PendingIntent =
      PendingIntent.getBroadcast(
          context,
          index,
          baseIntent(context, index).putExtra(EXTRA_INDEX, index).putExtra(EXTRA_ID, id).putExtra(EXTRA_AT, at),
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

  private fun cancel(context: Context, index: Int) {
    val pending =
        PendingIntent.getBroadcast(
            context,
            index,
            baseIntent(context, index),
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
        ) ?: return
    context.getSystemService(AlarmManager::class.java)?.cancel(pending)
    pending.cancel()
  }

  /** Same action, data and component for scheduling and cancelling (extras do not count). */
  private fun baseIntent(context: Context, index: Int) =
      Intent(context, ClassReminderReceiver::class.java)
          .setAction(ACTION_REMIND)
          .setData(Uri.parse("aouerj-reminder://class/$index"))
}
