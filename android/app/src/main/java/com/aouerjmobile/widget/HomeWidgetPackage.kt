package com.aouerjmobile.widget

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

/** Registers the app-local [HomeWidgetModule] TurboModule (spec: src/specs). */
class HomeWidgetPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
      if (name == HomeWidgetModule.NAME) HomeWidgetModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
    mapOf(
        HomeWidgetModule.NAME to
            ReactModuleInfo(
                name = HomeWidgetModule.NAME,
                className = HomeWidgetModule.NAME,
                canOverrideExistingModule = false,
                needsEagerInit = false,
                isCxxModule = false,
                isTurboModule = true,
            )
    )
  }
}
