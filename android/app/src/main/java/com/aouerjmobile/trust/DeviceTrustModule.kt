package com.aouerjmobile.trust

import android.util.Base64
import com.aouerjmobile.specs.NativeDeviceTrustSpec
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.google.android.play.core.integrity.IntegrityManagerFactory
import com.google.android.play.core.integrity.StandardIntegrityException
import com.google.android.play.core.integrity.StandardIntegrityManager
import com.google.android.play.core.integrity.StandardIntegrityManager.PrepareIntegrityTokenRequest
import com.google.android.play.core.integrity.StandardIntegrityManager.StandardIntegrityTokenProvider
import com.google.android.play.core.integrity.StandardIntegrityManager.StandardIntegrityTokenRequest
import com.google.android.play.core.integrity.model.StandardIntegrityErrorCode
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * Play Integrity (standard requests) and the platform crypto (SHA-2, SecureRandom) for the
 * anonymous student tokens (src/modules/trust). The token provider is prepared on the first
 * request and again when Play reports it expired; JS asks for one batch at a time.
 */
class DeviceTrustModule(reactContext: ReactApplicationContext) :
    NativeDeviceTrustSpec(reactContext) {

  private val manager: StandardIntegrityManager by lazy {
    IntegrityManagerFactory.createStandard(reactApplicationContext)
  }
  private val random = SecureRandom()

  // Play callbacks run on the main thread.
  @Volatile private var provider: StandardIntegrityTokenProvider? = null
  @Volatile private var providerProject: Long? = null

  override fun requestToken(cloudProjectNumber: String, requestHash: String, promise: Promise) {
    val project = cloudProjectNumber.toLongOrNull()
    if (project == null) {
      promise.reject(E_UNAVAILABLE, "Invalid Google Cloud project number")
      return
    }
    withProvider(project, promise) { ready -> request(ready, project, requestHash, promise, true) }
  }

  private fun withProvider(
      project: Long,
      promise: Promise,
      use: (StandardIntegrityTokenProvider) -> Unit,
  ) {
    val ready = provider
    if (ready != null && providerProject == project) {
      use(ready)
      return
    }
    manager
        .prepareIntegrityToken(
            PrepareIntegrityTokenRequest.builder().setCloudProjectNumber(project).build())
        .addOnSuccessListener { prepared ->
          provider = prepared
          providerProject = project
          use(prepared)
        }
        .addOnFailureListener { error -> reject(promise, error) }
  }

  private fun request(
      ready: StandardIntegrityTokenProvider,
      project: Long,
      requestHash: String,
      promise: Promise,
      retryExpired: Boolean,
  ) {
    ready
        .request(StandardIntegrityTokenRequest.builder().setRequestHash(requestHash).build())
        .addOnSuccessListener { response -> promise.resolve(response.token()) }
        .addOnFailureListener { error ->
          val expired =
              (error as? StandardIntegrityException)?.errorCode ==
                  StandardIntegrityErrorCode.INTEGRITY_TOKEN_PROVIDER_INVALID
          if (retryExpired && expired) {
            provider = null
            withProvider(project, promise) { fresh ->
              request(fresh, project, requestHash, promise, false)
            }
          } else {
            reject(promise, error)
          }
        }
  }

  private fun reject(promise: Promise, error: Exception) {
    val code = (error as? StandardIntegrityException)?.errorCode
    promise.reject(
        if (code != null && code in TRANSIENT) E_TRANSIENT else E_UNAVAILABLE,
        "Play Integrity failed (${code ?: error.javaClass.simpleName})",
        error,
    )
  }

  override fun randomBytes(length: Double): String {
    val size = length.toInt()
    require(size in 1..MAX_RANDOM_BYTES) { "Random length out of range: $size" }
    return Base64.encodeToString(ByteArray(size).also(random::nextBytes), Base64.NO_WRAP)
  }

  override fun digest(algorithm: String, data: String): String {
    require(algorithm in DIGESTS) { "Unsupported digest: $algorithm" }
    val digest = MessageDigest.getInstance(algorithm).digest(Base64.decode(data, Base64.NO_WRAP))
    return Base64.encodeToString(digest, Base64.NO_WRAP)
  }

  companion object {
    const val NAME = NativeDeviceTrustSpec.NAME
    private const val E_TRANSIENT = "E_INTEGRITY_TRANSIENT"
    private const val E_UNAVAILABLE = "E_INTEGRITY_UNAVAILABLE"
    private const val MAX_RANDOM_BYTES = 1024
    private val DIGESTS = setOf("SHA-256", "SHA-384")

    /** Network, quota or busy Play services: worth another try later. */
    private val TRANSIENT =
        setOf(
            StandardIntegrityErrorCode.NETWORK_ERROR,
            StandardIntegrityErrorCode.TOO_MANY_REQUESTS,
            StandardIntegrityErrorCode.GOOGLE_SERVER_UNAVAILABLE,
            StandardIntegrityErrorCode.CLIENT_TRANSIENT_ERROR,
            StandardIntegrityErrorCode.CANNOT_BIND_TO_SERVICE,
            StandardIntegrityErrorCode.INTERNAL_ERROR,
            StandardIntegrityErrorCode.INTEGRITY_TOKEN_PROVIDER_INVALID,
        )
  }
}
