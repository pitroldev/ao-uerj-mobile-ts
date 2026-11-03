package com.aouerjmobile.notifications

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import java.text.ParseException
import java.text.SimpleDateFormat
import java.util.Locale
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

/**
 * One-shot reminders of the Companhia agora calls the student opened or joined, on AlarmManager:
 * 10 minutes before the meeting and, on the way home, "Chegou bem?" 40 minutes after leaving. JS
 * sends the plan and this object keeps it in SharedPreferences, so reboots and clock changes
 * reschedule without JS. Each reminder is shown once and never after its `until` (the meeting
 * time, or when the call vanishes). The app has no push server: joins and phrases show only with
 * the app open, and these reminders carry no count that could be stale.
 *
 * The entry points are synchronized: JS replaces the plan on the TurboModule thread while alarms
 * arrive on the main thread.
 */
internal object CompanionReminders {
  const val ACTION_REMIND = "com.aouerjmobile.notifications.COMPANION_REMIND"
  private const val EXTRA_INDEX = "index"
  private const val EXTRA_ID = "id"

  private const val PREFS = "ao_notifications"
  private const val KEY_PLAN = "companion_reminders"
  private const val KEY_COUNT = "companion_reminders_count"
  private const val KEY_SHOWN = "companion_reminders_shown"

  /** JS sends at most 8 (two per call); extra entries are ignored. */
  private const val MAX_REMINDERS = 8
  private const val MINUTE = 60_000L
  /** Without exact alarms the system may deliver anywhere in this window (10 min minimum). */
  private const val WINDOW = 10 * MINUTE
  private const val LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm"

  private data class Reminder(
      val id: String,
      val callId: String,
      /** When the reminder is shown (ms). */
      val at: Long,
      /** After this its text no longer holds and it is dropped (ms). */
      val until: Long,
      val title: String,
      val body: String,
  )

  private fun prefs(context: Context) =
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  /** Throws [JSONException] for a malformed plan; a malformed reminder is just left out. */
  private fun parse(json: String): List<Reminder> {
    val items = JSONObject(json).getJSONArray("reminders")
    return (0 until minOf(items.length(), MAX_REMINDERS)).mapNotNull { index ->
      try {
        val item = items.getJSONObject(index)
        val local = item.optJSONObject("local")
        Reminder(
            id = item.getString("id"),
            callId = item.getString("callId"),
            at = localTime(local, "at") ?: item.getLong("at"),
            until = localTime(local, "until") ?: item.getLong("until"),
            title = item.getString("title"),
            body = item.optString("body"),
        )
      } catch (_: JSONException) {
        null
      }
    }
  }

  /** A local wall time ("2026-11-23T22:05") in the device's current time zone, or null. */
  private fun localTime(local: JSONObject?, key: String): Long? {
    val text = local?.optString(key).orEmpty()
    if (text.isEmpty()) return null
    return try {
      SimpleDateFormat(LOCAL_FORMAT, Locale.ROOT).apply { isLenient = false }.parse(text)?.time
    } catch (_: ParseException) {
      null
    }
  }

  private fun load(context: Context): List<Reminder> {
    val json = prefs(context).getString(KEY_PLAN, null) ?: return emptyList()
    return try {
      parse(json)
    } catch (_: JSONException) {
      emptyList()
    }
  }

  /**
   * Replaces the plan and schedules it; an empty text cancels everything. A malformed plan throws
   * [IllegalArgumentException] and the current plan stays.
   */
  @Synchronized
  fun replace(context: Context, json: String) {
    val reminders =
        if (json.isEmpty()) emptyList()
        else
            try {
              parse(json)
            } catch (error: JSONException) {
              throw IllegalArgumentException("Malformed companion reminder plan", error)
            }
    val prefs = prefs(context)
    val previousCount = prefs.getInt(KEY_COUNT, 0)
    val ids = reminders.map { it.id }.toSet()
    prefs
        .edit()
        .putString(KEY_PLAN, if (json.isEmpty()) null else json)
        .putInt(KEY_COUNT, reminders.size)
        .putString(KEY_SHOWN, JSONArray(shown(context).filter { it in ids }).toString())
        .commit()
    for (index in reminders.size until previousCount) cancel(context, index)
    schedule(context, reminders)
    ClassReminderWorker.refresh(context)
  }

  /** Boot, clock or exact-alarm permission change, periodic work: same plan, new alarms. */
  @Synchronized
  fun reschedule(context: Context) {
    schedule(context, load(context))
  }

  /** Sign out or account switch: nothing of the previous account stays. */
  @Synchronized
  fun clear(context: Context) {
    val prefs = prefs(context)
    val count = prefs.getInt(KEY_COUNT, 0)
    for (index in 0 until count) cancel(context, index)
    prefs.edit().remove(KEY_PLAN).remove(KEY_COUNT).remove(KEY_SHOWN).commit()
    ClassReminderWorker.refresh(context)
  }

  /** While a reminder may still be shown, the periodic work keeps rescheduling (no lock). */
  fun hasPending(context: Context): Boolean {
    val now = System.currentTimeMillis()
    val shown = shown(context)
    return load(context).any { it.id !in shown && now < it.until }
  }

  private fun schedule(context: Context, reminders: List<Reminder>) {
    reminders.forEachIndexed { index, reminder -> scheduleOne(context, index, reminder) }
  }

  private fun scheduleOne(context: Context, index: Int, reminder: Reminder) {
    val now = System.currentTimeMillis()
    if (reminder.id in shown(context) || now >= reminder.until) {
      cancel(context, index)
      return
    }
    val alarms = context.getSystemService(AlarmManager::class.java) ?: return
    val intent = alarmIntent(context, index, reminder.id)
    val at = reminder.at
    if (at <= now) {
      alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, now, intent)
    } else if (ClassReminders.canScheduleExact(context)) {
      alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent)
    } else if (at - WINDOW > now) {
      // the window ends at the planned time: early rather than late
      alarms.setWindow(AlarmManager.RTC_WAKEUP, at - WINDOW, WINDOW, intent)
    } else {
      alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, now, intent)
    }
  }

  /** Alarm fired: post the reminder once, unless it is stale or late. */
  @Synchronized
  fun onAlarm(context: Context, intent: Intent) {
    val reminders = load(context)
    val index = intent.getIntExtra(EXTRA_INDEX, -1)
    val reminder = reminders.getOrNull(index) ?: return
    if (reminder.id != intent.getStringExtra(EXTRA_ID)) {
      // alarm of a previous plan: the slot now belongs to another reminder
      scheduleOne(context, index, reminder)
      return
    }
    val now = System.currentTimeMillis()
    if (reminder.id !in shown(context) && now < reminder.until) {
      AppNotifier.post(
          context,
          AppNotification(
              // one notification per call: "Chegou bem?" replaces "é em 10 min"
              id = "companion:${reminder.callId}",
              channel = AppNotifier.CHANNEL_COMPANION,
              title = reminder.title,
              body = reminder.body,
              // the meeting point stays off a lock screen that hides sensitive content
              publicTitle = "Companhia agora",
              publicBody = "Toque para ver no AO UERJ.",
              target = "companion",
              timeoutMillis = maxOf(MINUTE, reminder.until - now),
          ),
      )
    }
    markShown(context, reminder.id)
    ClassReminderWorker.refresh(context)
  }

  private fun shown(context: Context): Set<String> {
    val json = prefs(context).getString(KEY_SHOWN, null) ?: return emptySet()
    return try {
      val array = JSONArray(json)
      (0 until array.length()).map { array.getString(it) }.toSet()
    } catch (_: JSONException) {
      emptySet()
    }
  }

  private fun markShown(context: Context, id: String) {
    val shown = shown(context) + id
    prefs(context).edit().putString(KEY_SHOWN, JSONArray(shown).toString()).commit()
  }

  private fun alarmIntent(context: Context, index: Int, id: String): PendingIntent =
      PendingIntent.getBroadcast(
          context,
          index,
          baseIntent(context, index).putExtra(EXTRA_INDEX, index).putExtra(EXTRA_ID, id),
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
      Intent(context, CompanionReminderReceiver::class.java)
          .setAction(ACTION_REMIND)
          .setData(Uri.parse("aouerj-reminder://companion/$index"))
}
