package com.aouerjmobile.updates

import android.app.Activity
import com.aouerjmobile.specs.NativeInAppUpdatesSpec
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallState
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability

/**
 * Play In-App Updates (com.google.android.play:app-update) for JS. Outside a Play install
 * (debug, emulator, sideload) getAppUpdateInfo fails and JS treats it as "no update".
 */
class InAppUpdatesModule(reactContext: ReactApplicationContext) :
    NativeInAppUpdatesSpec(reactContext) {

  private val manager: AppUpdateManager by lazy {
    AppUpdateManagerFactory.create(reactApplicationContext)
  }

  private val installListener = InstallStateUpdatedListener { state ->
    // Set by the TurboModule infra once JS holds the module; skip earlier events.
    if (mEventEmitterCallback != null) emitOnInstallState(state.toMap())
  }

  override fun initialize() {
    super.initialize()
    manager.registerListener(installListener)
  }

  override fun invalidate() {
    manager.unregisterListener(installListener)
    super.invalidate()
  }

  override fun checkUpdate(promise: Promise) {
    manager.appUpdateInfo
        .addOnSuccessListener { info -> promise.resolve(info.toMap()) }
        .addOnFailureListener { error -> promise.reject(E_UNAVAILABLE, error.message, error) }
  }

  override fun startUpdate(type: String, promise: Promise) {
    val updateType = if (type == "immediate") AppUpdateType.IMMEDIATE else AppUpdateType.FLEXIBLE
    manager.appUpdateInfo
        .addOnSuccessListener { info ->
          val activity: Activity? = reactApplicationContext.currentActivity
          // An interrupted immediate update reports "in progress" and must be resumed as is.
          val resuming =
              info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
          if (activity == null || (!resuming && !info.isUpdateTypeAllowed(updateType))) {
            promise.resolve(RESULT_NOT_ALLOWED)
            return@addOnSuccessListener
          }
          manager
              .startUpdateFlow(info, activity, AppUpdateOptions.defaultOptions(updateType))
              .addOnSuccessListener { code -> promise.resolve(resultName(code)) }
              .addOnFailureListener { error -> promise.reject(E_FAILED, error.message, error) }
        }
        .addOnFailureListener { error -> promise.reject(E_UNAVAILABLE, error.message, error) }
  }

  override fun completeUpdate(promise: Promise) {
    manager
        .completeUpdate()
        .addOnSuccessListener { promise.resolve(null) }
        .addOnFailureListener { error -> promise.reject(E_FAILED, error.message, error) }
  }

  private fun AppUpdateInfo.toMap(): WritableMap =
      Arguments.createMap().apply {
        putString("availability", availabilityName(updateAvailability()))
        putInt("availableVersionCode", availableVersionCode())
        putInt("stalenessDays", clientVersionStalenessDays() ?: -1)
        putInt("priority", updatePriority())
        putBoolean("flexibleAllowed", isUpdateTypeAllowed(AppUpdateType.FLEXIBLE))
        putBoolean("immediateAllowed", isUpdateTypeAllowed(AppUpdateType.IMMEDIATE))
        putString("installStatus", installStatusName(installStatus()))
      }

  private fun InstallState.toMap(): WritableMap =
      Arguments.createMap().apply {
        putString("installStatus", installStatusName(installStatus()))
        putDouble("bytesDownloaded", bytesDownloaded().toDouble())
        putDouble("totalBytesToDownload", totalBytesToDownload().toDouble())
        putInt("errorCode", installErrorCode())
      }

  companion object {
    const val NAME = NativeInAppUpdatesSpec.NAME
    private const val E_UNAVAILABLE = "E_UPDATE_UNAVAILABLE"
    private const val E_FAILED = "E_UPDATE_FAILED"
    private const val RESULT_NOT_ALLOWED = "notAllowed"

    private fun availabilityName(value: Int): String =
        when (value) {
          UpdateAvailability.UPDATE_AVAILABLE -> "available"
          UpdateAvailability.UPDATE_NOT_AVAILABLE -> "notAvailable"
          UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS -> "inProgress"
          else -> "unknown"
        }

    private fun installStatusName(value: Int): String =
        when (value) {
          InstallStatus.PENDING -> "pending"
          InstallStatus.DOWNLOADING -> "downloading"
          InstallStatus.DOWNLOADED -> "downloaded"
          InstallStatus.INSTALLING -> "installing"
          InstallStatus.INSTALLED -> "installed"
          InstallStatus.FAILED -> "failed"
          InstallStatus.CANCELED -> "canceled"
          else -> "unknown"
        }

    /** startUpdateFlow result: RESULT_OK, RESULT_CANCELED or RESULT_IN_APP_UPDATE_FAILED. */
    private fun resultName(code: Int): String =
        when (code) {
          Activity.RESULT_OK -> "accepted"
          Activity.RESULT_CANCELED -> "canceled"
          else -> "failed"
        }
  }
}
