package com.aouerjmobile

import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.view.WindowInsetsControllerCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.views.view.isEdgeToEdgeFeatureFlagOn
import com.zoontek.rnbootsplash.RNBootSplash

/** Scrims React Native paints behind the navigation bar below Android 10 (WindowUtil.kt). */
private val LIGHT_NAVIGATION_BAR = Color.argb(0xe6, 0xFF, 0xFF, 0xFF)
private val DARK_NAVIGATION_BAR = Color.argb(0x80, 0x1b, 0x1b, 0x1b)

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "aouerjmobile"

  /**
   * react-native-screens does not restore fragments: recreating the activity (e.g. changing the
   * system font size with the app open) crashed with "Screen fragments should never be restored".
   * See https://github.com/software-mansion/react-native-screens#android
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    // Before super.onCreate: switches BootTheme (manifest) to AppTheme and keeps the native
    // splash until JS calls BootSplash.hide() (NavigationContainer onReady in App.tsx).
    RNBootSplash.init(this, R.style.BootTheme)
    super.onCreate(null)
  }

  /**
   * The theme follows the system or the user's choice (Appearance.setColorScheme in JS, which sets
   * the AppCompat night mode). The manifest handles uiMode, so neither recreates the activity; but
   * React Native picks the navigation bar button color (edge-to-edge) only when the window is
   * created, so it is reapplied here.
   */
  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    val night =
        when (AppCompatDelegate.getDefaultNightMode()) {
          AppCompatDelegate.MODE_NIGHT_YES -> true
          AppCompatDelegate.MODE_NIGHT_NO -> false
          else ->
              (newConfig.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                  Configuration.UI_MODE_NIGHT_YES
        }
    applyNavigationBarStyle(night)
  }

  /** Same rules as React Native's enableEdgeToEdge(), for the current night mode. */
  @Suppress("DEPRECATION")
  private fun applyNavigationBarStyle(night: Boolean) {
    if (!isEdgeToEdgeFeatureFlagOn || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      // Transparent bar: the system draws the contrast scrim from the light/dark flag.
      if (!window.isNavigationBarContrastEnforced) return
    } else {
      window.navigationBarColor = if (night) DARK_NAVIGATION_BAR else LIGHT_NAVIGATION_BAR
    }
    WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightNavigationBars = !night
  }

  /** Returns the instance of the [ReactActivityDelegate] (New Architecture is always on). */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName)
}
