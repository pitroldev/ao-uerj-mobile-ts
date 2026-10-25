package com.aouerjmobile.notifications

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.app.NotificationManagerCompat
import java.text.ParseException
import java.text.SimpleDateFormat
import java.util.Locale
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

/**
 * One-shot reminders of the evaluations the student wrote down (exams and assignments) on
 * AlarmManager. JS sends the plan (when each reminder fires, until when its text holds, when the
 * evaluation starts, and the texts) and this object keeps it in SharedPreferences, so reboots and
 * clock changes reschedule without JS. The times come as local wall times too, read again in the
 * current time zone: after travelling, an exam at 08:00 is still reminded at 07:00 local time.
 * Each reminder is shown once: the ids already shown are kept while they are in the plan. "Já fiz"
 * on an assignment's notification stops its remaining reminders and is kept until JS reads it.
 *
 * The entry points are synchronized: JS replaces the plan on the TurboModule thread while alarms
 * and notification actions arrive on the main thread.
 */
internal object EvaluationReminders {
  const val ACTION_REMIND = "com.aouerjmobile.notifications.EVALUATION_REMIND"
  const val ACTION_DONE = "com.aouerjmobile.notifications.EVALUATION_DONE"
  private const val EXTRA_INDEX = "index"
  private const val EXTRA_ID = "id"
  private const val EXTRA_EVALUATION = "evaluation"

  private const val PREFS = "ao_notifications"
  private const val KEY_PLAN = "evaluation_reminders"
  private const val KEY_COUNT = "evaluation_reminders_count"
  private const val KEY_SHOWN = "evaluation_reminders_shown"
  /** Evaluations marked "Já fiz" on a notification, not read by JS yet. */
  private const val KEY_DONE = "evaluation_reminders_done"

  /** JS sends at most 60, the nearest first; extra entries are ignored. */
  private const val MAX_REMINDERS = 60
  private const val MINUTE = 60_000L
  /** Without exact alarms the system may deliver anywhere in this window (10 min minimum). */
  private const val WINDOW = 10 * MINUTE
  /**
   * Plans without `latest`: a reminder later than this (phone off, deep Doze) is dropped, since its
   * title could be wrong ("Em 1 hora").
   */
  private const val LATE = 15 * MINUTE
  private const val LOCAL_FORMAT = "yyyy-MM-dd'T'HH:mm"
  /** The notification leaves the shade on its own a while after the evaluation starts. */
  private const val AFTER_START = 2 * 60 * MINUTE

  private data class Reminder(
      val id: String,
      val evaluationId: String,
      /** When the reminder is shown (ms). */
      val at: Long,
      /** Start of the evaluation (ms): never shown after it. */
      val until: Long,
      /**
       * Last moment its text holds (ms): the end of the day for "Amanhã", the start for "Hoje,
       * 8:00", 15 minutes for "Em 1 hora". A reminder delayed past it is dropped.
       */
      val latest: Long,
      val title: String,
      val body: String,
      /** Assignments, seminars and others get the "Já fiz" action; exams do not. */
      val completable: Boolean,
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
        val at = localTime(local, "at") ?: item.getLong("at")
        Reminder(
            id = item.getString("id"),
            evaluationId = item.getString("evaluationId"),
            at = at,
            until = localTime(local, "until") ?: item.getLong("until"),
            latest = localTime(local, "latest") ?: item.optLong("latest", at + LATE),
            title = item.getString("title"),
            body = item.optString("body"),
            completable = item.optBoolean("completable"),
        )
      } catch (_: JSONException) {
        null
      }
    }
  }

  /** A local wall time ("2026-11-23T20:00") in the device's current time zone, or null. */
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
              throw IllegalArgumentException("Malformed evaluation reminder plan", error)
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
    ClassReminderWorker.refresh(context)
  }

  /** Sign out or account switch: nothing of the previous account stays. */
  @Synchronized
  fun clear(context: Context) {
    val prefs = prefs(context)
    val count = prefs.getInt(KEY_COUNT, 0)
    for (index in 0 until count) cancel(context, index)
    prefs
        .edit()
        .remove(KEY_PLAN)
        .remove(KEY_COUNT)
        .remove(KEY_SHOWN)
        .remove(KEY_DONE)
        .commit()
    ClassReminderWorker.refresh(context)
  }

  /** While a reminder may still be shown, the periodic work keeps rescheduling (no lock). */
  fun hasPending(context: Context): Boolean {
    val now = System.currentTimeMillis()
    val shown = shown(context)
    return load(context).any { it.id !in shown && now <= it.latest && now < it.until }
  }

  private fun schedule(context: Context, reminders: List<Reminder>) {
    reminders.forEachIndexed { index, reminder -> scheduleOne(context, index, reminder) }
  }

  private fun scheduleOne(context: Context, index: Int, reminder: Reminder) {
    val now = System.currentTimeMillis()
    if (!showable(context, reminder, now)) {
      cancel(context, index)
      return
    }
    val alarms = context.getSystemService(AlarmManager::class.java) ?: return
    val intent = alarmIntent(context, index, reminder.id)
    val at = reminder.at
    if (at <= now) {
      // late but its text still holds (rebooted, or Doze held it back): show it now
      alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, now, intent)
    } else if (ClassReminders.canScheduleExact(context)) {
      alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent)
    } else if (at - WINDOW > now) {
      // the window ends at the planned time: early rather than late
      alarms.setWindow(AlarmManager.RTC_WAKEUP, at - WINDOW, WINDOW, intent)
    } else {
      // the window has begun: fire now instead of up to 10 minutes late
      alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, now, intent)
    }
  }

  private fun showable(context: Context, reminder: Reminder, now: Long): Boolean =
      reminder.id !in shown(context) &&
          reminder.evaluationId !in done(context) &&
          now <= reminder.latest &&
          now < reminder.until

  /** Alarm fired: post the reminder once, unless it is stale, late or its evaluation is done. */
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
    if (showable(context, reminder, now)) {
      AppNotifier.post(
          context,
          AppNotification(
              id = tag(reminder.evaluationId),
              channel = AppNotifier.CHANNEL_EVALUATIONS,
              title = reminder.title,
              body = reminder.body,
              // decided with the approved prototype: on a lock screen that hides sensitive content
              // the title shows ("Amanhã: P1 de Física III"), the note in the body stays hidden
              publicTitle = reminder.title,
              publicBody = "Toque para ver no AO UERJ.",
              target = "home",
              timeoutMillis = maxOf(MINUTE, reminder.until + AFTER_START - now),
              actions =
                  if (reminder.completable)
                      listOf(NotificationAction("Já fiz", doneIntent(context, reminder.evaluationId)))
                  else emptyList(),
          ),
      )
    }
    markShown(context, reminder.id)
    ClassReminderWorker.refresh(context)
  }

  /** "Já fiz": no more reminders for the evaluation, and JS learns it on the next read. */
  @Synchronized
  fun markDone(context: Context, intent: Intent) {
    val evaluationId = intent.getStringExtra(EXTRA_EVALUATION) ?: return
    val done = done(context) + evaluationId
    prefs(context).edit().putString(KEY_DONE, JSONArray(done).toString()).commit()
    load(context).forEachIndexed { index, reminder ->
      if (reminder.evaluationId == evaluationId) cancel(context, index)
    }
    NotificationManagerCompat.from(context).cancel(tag(evaluationId), AppNotifier.NOTIFICATION_ID)
    ClassReminderWorker.refresh(context)
  }

  /** The evaluations marked "Já fiz" since the last read; read once. */
  @Synchronized
  fun consumeDone(context: Context): List<String> {
    val done = done(context)
    if (done.isNotEmpty()) prefs(context).edit().remove(KEY_DONE).commit()
    return done.toList()
  }

  private fun shown(context: Context): Set<String> =
      readSet(prefs(context).getString(KEY_SHOWN, null))

  private fun done(context: Context): Set<String> =
      readSet(prefs(context).getString(KEY_DONE, null))

  private fun readSet(json: String?): Set<String> {
    if (json == null) return emptySet()
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

  /** One notification per evaluation: a later reminder replaces the earlier one. */
  private fun tag(evaluationId: String) = "evaluation:$evaluationId"

  private fun alarmIntent(context: Context, index: Int, id: String): PendingIntent =
      PendingIntent.getBroadcast(
          context,
          index,
          baseIntent(context, index).putExtra(EXTRA_INDEX, index).putExtra(EXTRA_ID, id),
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

  private fun doneIntent(context: Context, evaluationId: String): PendingIntent =
      PendingIntent.getBroadcast(
          context,
          0,
          Intent(context, EvaluationReminderReceiver::class.java)
              .setAction(ACTION_DONE)
              .setData(Uri.parse("aouerj-reminder://evaluation-done/${Uri.encode(evaluationId)}"))
              .putExtra(EXTRA_EVALUATION, evaluationId),
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
      Intent(context, EvaluationReminderReceiver::class.java)
          .setAction(ACTION_REMIND)
          .setData(Uri.parse("aouerj-reminder://evaluation/$index"))
}
