package com.aouerjmobile

import android.app.Activity
import android.os.Bundle

/**
 * Trampoline of the app icon shortcuts (res/xml/shortcuts.xml), without UI.
 *
 * Android always opens a static shortcut with FLAG_ACTIVITY_NEW_TASK | FLAG_ACTIVITY_CLEAR_TASK.
 * Aimed at MainActivity, that destroyed the open app: the screen, sheets and forms started over,
 * behind the splash. This activity has a task of its own (empty taskAffinity in the manifest), so
 * the shortcut clears only that task; it hands the target to MainActivity with the intent of the
 * notifications and the widget ([AppLaunch]) and finishes.
 *
 * Not exported: launchers can only start a shortcut through LauncherApps.startShortcut, which
 * starts its intent on behalf of the app.
 */
class ShortcutActivity : Activity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // JS checks the target (toLaunchTarget); without one, the app opens on Início
    val target = intent.getStringExtra(AppLaunch.EXTRA_TARGET) ?: "home"
    startActivity(AppLaunch.intent(this, target))
    finish()
  }
}
