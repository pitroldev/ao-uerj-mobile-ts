package com.aouerjmobile

import android.app.Application
import android.content.res.Configuration
import com.aouerjmobile.notifications.AppNotificationsPackage
import com.aouerjmobile.trust.DeviceTrustPackage
import com.aouerjmobile.updates.InAppUpdatesPackage
import com.aouerjmobile.vault.SecureVaultPackage
import com.aouerjmobile.widget.HomeWidgetPackage
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.modules.network.OkHttpClientProvider
import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

class MainApplication : Application(), ReactApplication {

  /**
   * O host do Expo: liga os módulos do Expo e o expo-updates, que escolhe o pacote JS (o da
   * instalação ou a última atualização baixada) para a tela e para a tarefa sem tela
   * (PortalCheckWorker), que usam este mesmo host.
   */
  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // App-local TurboModules (codegenConfig in package.json) are not autolinked.
          add(InAppUpdatesPackage())
          add(AppNotificationsPackage())
          add(HomeWidgetPackage())
          add(SecureVaultPackage())
          add(DeviceTrustPackage())
        },
      // No debug, o Metro do React Native CLI (pnpm start) serve o index.js; o padrão do Expo é
      // a entrada do `expo start`.
      jsMainModulePath = "index",
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
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
