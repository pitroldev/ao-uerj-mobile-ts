package com.aouerjmobile

import android.app.Application
import com.aouerjmobile.notifications.AppNotificationsPackage
import com.aouerjmobile.updates.InAppUpdatesPackage
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.modules.network.OkHttpClientProvider

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // App-local TurboModules (codegenConfig in package.json) are not autolinked.
          add(InAppUpdatesPackage())
          add(AppNotificationsPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // NetworkingModule uses a context-backed client with cacheDir/http-cache.
    // getOkHttpClient() has no context/cache and cannot purge these legacy URLs.
    // Close this temporary cache before React opens its own cache instance.
    OkHttpClientProvider.createClientBuilder(applicationContext).build().cache?.use { cache ->
      cache.evictAll()
    }
    loadReactNative(this)
  }
}
