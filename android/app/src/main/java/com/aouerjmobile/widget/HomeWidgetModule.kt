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
      promise.resolve(null)
    } catch (error: IllegalArgumentException) {
      promise.reject(E_SCHEDULE, error.message, error)
    }
  }

  companion object {
    const val NAME = NativeHomeWidgetSpec.NAME
    private const val E_SCHEDULE = "E_WIDGET_SCHEDULE"
  }
}
