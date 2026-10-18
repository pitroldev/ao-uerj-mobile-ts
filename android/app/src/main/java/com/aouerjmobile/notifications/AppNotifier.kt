package com.aouerjmobile.notifications

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.aouerjmobile.MainActivity
import com.aouerjmobile.R

/** A notification ready to post; the texts come from JS (or from a saved class reminder). */
internal data class AppNotification(
    /** Same id replaces the previous notification (per subject, per document). */
    val id: String,
    val channel: String,
    val title: String,
    val body: String,
    /** Shown on secure lock screens that hide sensitive content. */
    val publicTitle: String,
    val publicBody: String,
    /** Screen opened by a tap: "home" or "documents". */
    val target: String,
    /** Dismissed by the system after this many milliseconds (0 keeps it). */
    val timeoutMillis: Long = 0,
)

/** Channels and posting. Every notification is private: the lock screen gets a generic version. */
internal object AppNotifier {
  const val CHANNEL_CLASS_REMINDERS = "class-reminders"
  private const val CHANNEL_GRADES = "grades"
  private const val CHANNEL_ENROLLMENT = "enrollment"
  private const val CHANNEL_DOCUMENTS = "documents"

  const val ACTION_OPEN = "com.aouerjmobile.notifications.OPEN"
  const val EXTRA_TARGET = "com.aouerjmobile.notifications.TARGET"

  private val CHANNELS =
      listOf(
          Channel(
              CHANNEL_CLASS_REMINDERS,
              "Lembretes de aula",
              "Aviso antes de cada aula, com o horário e a sala.",
              NotificationManager.IMPORTANCE_HIGH,
          ),
          Channel(
              CHANNEL_GRADES,
              "Notas",
              "Nota nova ou alterada no Aluno Online.",
              NotificationManager.IMPORTANCE_DEFAULT,
          ),
          Channel(
              CHANNEL_ENROLLMENT,
              "Inscrição (RID)",
              "Posição no RID provisório e resultado da inscrição.",
              NotificationManager.IMPORTANCE_DEFAULT,
          ),
          Channel(
              CHANNEL_DOCUMENTS,
              "Documentos",
              "Documento emitido perto de vencer.",
              NotificationManager.IMPORTANCE_DEFAULT,
          ),
      )

  private data class Channel(
      val id: String,
      val name: String,
      val description: String,
      val importance: Int,
  )

  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    manager.createNotificationChannels(
        CHANNELS.map { channel ->
          NotificationChannel(channel.id, channel.name, channel.importance).apply {
            description = channel.description
          }
        }
    )
  }

  fun areEnabled(context: Context): Boolean =
      NotificationManagerCompat.from(context).areNotificationsEnabled()

  /** Posts the notification; without permission (or with notifications off) it is dropped. */
  @SuppressLint("MissingPermission") // areEnabled covers POST_NOTIFICATIONS on Android 13+
  fun post(context: Context, notification: AppNotification) {
    if (!areEnabled(context)) return
    val channel = CHANNELS.firstOrNull { it.id == notification.channel } ?: return
    ensureChannels(context)
    val color = ContextCompat.getColor(context, R.color.notification_accent)
    val priority =
        if (channel.importance >= NotificationManager.IMPORTANCE_HIGH)
            NotificationCompat.PRIORITY_HIGH
        else NotificationCompat.PRIORITY_DEFAULT
    val category =
        if (channel.id == CHANNEL_CLASS_REMINDERS) NotificationCompat.CATEGORY_REMINDER
        else NotificationCompat.CATEGORY_STATUS
    val open = openApp(context, notification.target)
    val publicVersion =
        NotificationCompat.Builder(context, channel.id)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(color)
            .setContentTitle(notification.publicTitle)
            .setContentText(notification.publicBody)
            .setContentIntent(open)
            .build()
    val builder =
        NotificationCompat.Builder(context, channel.id)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(color)
            .setContentTitle(notification.title)
            .setContentText(notification.body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(notification.body))
            .setContentIntent(open)
            .setAutoCancel(true)
            .setPriority(priority)
            .setCategory(category)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPublicVersion(publicVersion)
    if (notification.timeoutMillis > 0) builder.setTimeoutAfter(notification.timeoutMillis)
    try {
      NotificationManagerCompat.from(context).notify(notification.id, NOTIFICATION_ID, builder.build())
    } catch (_: SecurityException) {
      // permission revoked between the check and the post
    }
  }

  /** Opens MainActivity (singleTask) with the target; one PendingIntent per target. */
  private fun openApp(context: Context, target: String): PendingIntent {
    val intent =
        Intent(context, MainActivity::class.java).apply {
          action = ACTION_OPEN
          putExtra(EXTRA_TARGET, target)
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
    return PendingIntent.getActivity(
        context,
        target.hashCode(),
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  /** Notifications are told apart by their tag (the string id). */
  private const val NOTIFICATION_ID = 1
}
