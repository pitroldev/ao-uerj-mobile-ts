package com.aouerjmobile

import android.app.Application
import android.database.sqlite.SQLiteDatabase
import android.util.Log
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
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
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
    prepareLegacyAsyncStorage()
    loadReactNative(this)
  }

  /**
   * async-storage 3 migrates the v2 database (RKStorage) on first use by copying it into a new
   * database (AsyncStorage) and never touches the original again.
   * - Before that copy: on Android 9+ the latest writes may still be in RKStorage-wal, and the copy
   *   only takes the main file, so fold the WAL into it first (v2 ran the same checkpoint).
   * - After it: delete RKStorage. Removing a key now only affects the copy, and versions up to
   *   1.3.4 kept the student's credentials there in plain text ("persist:root").
   */
  private fun prepareLegacyAsyncStorage() {
    val legacy = getDatabasePath("RKStorage")
    if (!legacy.exists()) return
    val next = getDatabasePath("AsyncStorage")
    runCatching {
      if (!next.exists()) {
        SQLiteDatabase.openDatabase(legacy.path, null, SQLiteDatabase.OPEN_READWRITE).use { db ->
          db.rawQuery("PRAGMA wal_checkpoint(TRUNCATE)", null).use { it.moveToFirst() }
        }
      } else if (isMigrated(next.path)) {
        deleteDatabase("RKStorage")
      }
    }.onFailure { Log.w("AsyncStorageMigration", "Legacy storage step failed", it) }
  }

  /** Room sets user_version to 2 only after copying RKStorage and running its migration. */
  private fun isMigrated(path: String): Boolean =
    SQLiteDatabase.openDatabase(path, null, SQLiteDatabase.OPEN_READONLY).use { it.version >= 2 }
}
