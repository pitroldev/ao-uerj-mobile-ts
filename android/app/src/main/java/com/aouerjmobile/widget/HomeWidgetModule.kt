package com.aouerjmobile.widget

import com.aouerjmobile.specs.NativeHomeWidgetSpec
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext

/** The "Próxima aula" widget for JS (spec: src/specs/NativeHomeWidget.ts). */
class HomeWidgetModule(reactContext: ReactApplicationContext) :
    NativeHomeWidgetSpec(reactContext) {

  /** Saves the schedule sent by JS (empty: signed out) and redraws the widgets on screen. */
  override fun setSchedule(schedule: String, promise: Promise) {
    try {
      NextClassStore.replace(reactApplicationContext, schedule)
      NextClassWidget.updateAll(reactApplicationContext)
      TodayWidget.updateAll(reactApplicationContext)
      promise.resolve(null)
    } catch (error: IllegalArgumentException) {
      promise.reject(E_SCHEDULE, error.message, error)
    }
  }

  /**
   * Signed in, schedule not read yet (e.g. the portal failed right after the login): the widget
   * stops asking to sign in and keeps the schedule it has.
   */
  override fun setSignedIn(promise: Promise) {
    NextClassStore.signIn(reactApplicationContext)
    NextClassWidget.updateAll(reactApplicationContext)
    TodayWidget.updateAll(reactApplicationContext)
    promise.resolve(null)
  }

  companion object {
    const val NAME = NativeHomeWidgetSpec.NAME
    private const val E_SCHEDULE = "E_WIDGET_SCHEDULE"
  }
}
