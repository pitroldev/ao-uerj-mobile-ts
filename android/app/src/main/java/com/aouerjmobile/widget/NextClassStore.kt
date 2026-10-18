package com.aouerjmobile.widget

import android.content.Context
import java.util.Calendar
import org.json.JSONException
import org.json.JSONObject

/** A class meeting as JS sends it: weekday, minutes and the texts of the Home's next class card. */
internal data class WidgetClass(
    /** 1 = Monday … 7 = Sunday. */
    val weekday: Int,
    /** Minutes after midnight. */
    val start: Int,
    val end: Int,
    val startLabel: String,
    val endLabel: String,
    val title: String,
    val detail: String,
    val place: String,
)

internal data class WidgetSchedule(
    val updatedAt: Long,
    /** After this instant the widget asks to open the app (the schedule may be outdated). */
    val expiresAt: Long,
    val classes: List<WidgetClass>,
)

internal data class NextClass(
    val item: WidgetClass,
    /** 0 = today, 1 = tomorrow … 7 = the same weekday next week. */
    val dayOffset: Int,
    /** Happening now. */
    val ongoing: Boolean,
)

/**
 * The saved schedule of the "Próxima aula" widget, sent by JS whenever the app's saved schedule
 * changes. The next class is picked at drawing time, with the rule of the Home's card
 * (findNextClass in scheduleFormat.ts): today's ongoing or upcoming class, else the first class of
 * the following days. No portal access.
 */
internal object NextClassStore {
  private const val PREFS = "ao_widget"
  private const val KEY_SCHEDULE = "schedule"
  /**
   * Written by the logout (the empty schedule): the widget asks to sign in. Without it and without
   * a schedule, JS has sent nothing yet (widget placed before the app ran after an install or an
   * update) or the account's schedule was not read yet, and the widget asks to open the app.
   */
  private const val KEY_SIGNED_OUT = "signed_out"
  private const val MAX_CLASSES = 100

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  /** Throws [JSONException] for a malformed schedule; a malformed class is just left out. */
  private fun parse(json: String): WidgetSchedule {
    val root = JSONObject(json)
    val items = root.getJSONArray("classes")
    val classes =
        (0 until minOf(items.length(), MAX_CLASSES)).mapNotNull { index ->
          try {
            val item = items.getJSONObject(index)
            val weekday = item.getInt("weekday")
            val start = item.getInt("start")
            val end = item.getInt("end")
            if (weekday !in 1..7 || start !in 0 until 24 * 60 || end <= start) null
            else
                WidgetClass(
                    weekday = weekday,
                    start = start,
                    end = end,
                    startLabel = item.getString("startLabel"),
                    endLabel = item.getString("endLabel"),
                    title = item.getString("title"),
                    detail = item.optString("detail"),
                    place = item.optString("place"),
                )
          } catch (_: JSONException) {
            null
          }
        }
    return WidgetSchedule(root.getLong("updatedAt"), root.getLong("expiresAt"), classes)
  }

  /**
   * Replaces the schedule; an empty text clears it and marks the widget signed out. A malformed
   * schedule throws [IllegalArgumentException] and the current one stays.
   */
  @Synchronized
  fun replace(context: Context, json: String) {
    if (json.isNotEmpty())
        try {
          parse(json)
        } catch (error: JSONException) {
          throw IllegalArgumentException("Malformed widget schedule", error)
        }
    prefs(context)
        .edit()
        .putString(KEY_SCHEDULE, json.ifEmpty { null })
        .putBoolean(KEY_SIGNED_OUT, json.isEmpty())
        .commit()
  }

  /** Signed in, schedule not read yet: no longer signed out; a saved schedule stays. */
  @Synchronized
  fun signIn(context: Context) {
    prefs(context).edit().remove(KEY_SIGNED_OUT).commit()
  }

  /** Signed out by the logout, as opposed to no schedule sent yet. */
  @Synchronized
  fun signedOut(context: Context): Boolean = prefs(context).getBoolean(KEY_SIGNED_OUT, false)

  @Synchronized
  fun load(context: Context): WidgetSchedule? {
    val json = prefs(context).getString(KEY_SCHEDULE, null) ?: return null
    return try {
      parse(json)
    } catch (_: JSONException) {
      null
    }
  }

  /** Today's ongoing or upcoming class, else the first class of the following days. */
  fun next(schedule: WidgetSchedule, now: Long): NextClass? {
    val calendar = Calendar.getInstance().apply { timeInMillis = now }
    val minutes = calendar.get(Calendar.HOUR_OF_DAY) * 60 + calendar.get(Calendar.MINUTE)
    for (offset in 0..7) {
      val weekday = weekdayOf(calendar)
      val item =
          schedule.classes
              .filter { it.weekday == weekday && (offset != 0 || it.end > minutes) }
              .minByOrNull { it.start }
      if (item != null) return NextClass(item, offset, offset == 0 && item.start <= minutes)
      calendar.add(Calendar.DAY_OF_YEAR, 1)
    }
    return null
  }

  /** 1 = Monday … 7 = Sunday (Calendar: Sunday = 1 … Saturday = 7). */
  fun weekdayOf(calendar: Calendar): Int = (calendar.get(Calendar.DAY_OF_WEEK) + 5) % 7 + 1
}
