package com.aouerjmobile.vault

import com.aouerjmobile.specs.NativeSecureVaultSpec
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * The encrypted vault for JS (spec: src/specs/NativeSecureVault.ts). Crypto and file work run on one
 * background thread, in order, so a write is never read half done.
 */
class SecureVaultModule(reactContext: ReactApplicationContext) :
    NativeSecureVaultSpec(reactContext) {

  private val executor: ExecutorService = Executors.newSingleThreadExecutor()

  override fun read(name: String, promise: Promise) = run(promise) {
    SecureVault.read(reactApplicationContext, name)
  }

  override fun write(name: String, value: String, promise: Promise) = run(promise) {
    SecureVault.write(reactApplicationContext, name, value)
    null
  }

  override fun remove(name: String, promise: Promise) = run(promise) {
    SecureVault.remove(reactApplicationContext, name)
    null
  }

  override fun removePrefix(prefix: String, promise: Promise) = run(promise) {
    SecureVault.removePrefix(reactApplicationContext, prefix)
    null
  }

  override fun invalidate() {
    executor.shutdown()
    super.invalidate()
  }

  private fun run(promise: Promise, block: () -> Any?) {
    executor.execute {
      try {
        promise.resolve(block())
      } catch (error: Exception) {
        promise.reject(E_VAULT, error.message, error)
      }
    }
  }

  companion object {
    const val NAME = NativeSecureVaultSpec.NAME
    private const val E_VAULT = "E_SECURE_VAULT"
  }
}
