package com.aouerjmobile.vault

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.io.File
import java.security.GeneralSecurityException
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Encrypted files for JS: AES-256-GCM with a non-exportable key in the Android Keystore, one file
 * per item in noBackupFilesDir (out of cloud backups). A file that no longer decrypts (key lost
 * after a restore or tampering) is deleted and reads as missing.
 */
internal object SecureVault {
  private const val KEY_ALIAS = "ao-secure-vault"
  private const val DIRECTORY = "secure-vault"
  private const val TRANSFORMATION = "AES/GCM/NoPadding"
  private const val FORMAT_VERSION: Byte = 1
  private const val IV_BYTES = 12
  private const val TAG_BITS = 128
  private val NAME = Regex("^[A-Za-z0-9._:-]{1,160}$")
  private const val NAME_FLAGS = Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP

  fun read(context: Context, name: String): String? {
    val target = file(context, name)
    if (!target.exists()) return null
    val bytes = target.readBytes()
    return try {
      if (bytes.size <= 1 + IV_BYTES || bytes[0] != FORMAT_VERSION)
          throw GeneralSecurityException("unknown format")
      val cipher = Cipher.getInstance(TRANSFORMATION)
      cipher.init(
          Cipher.DECRYPT_MODE,
          key(),
          GCMParameterSpec(TAG_BITS, bytes, 1, IV_BYTES),
      )
      String(
          cipher.doFinal(bytes, 1 + IV_BYTES, bytes.size - 1 - IV_BYTES),
          Charsets.UTF_8,
      )
    } catch (_: GeneralSecurityException) {
      target.delete()
      null
    }
  }

  fun write(context: Context, name: String, value: String) {
    val cipher = Cipher.getInstance(TRANSFORMATION)
    cipher.init(Cipher.ENCRYPT_MODE, key())
    val encrypted = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
    val target = file(context, name)
    // whole file or nothing: the old copy stays until the new one is complete
    val temporary = File(target.parentFile, "${target.name}.tmp")
    temporary.outputStream().use {
      it.write(byteArrayOf(FORMAT_VERSION))
      it.write(cipher.iv)
      it.write(encrypted)
    }
    if (!temporary.renameTo(target)) {
      temporary.delete()
      throw IllegalStateException("could not replace $name")
    }
  }

  fun remove(context: Context, name: String) {
    file(context, name).delete()
  }

  fun removePrefix(context: Context, prefix: String) {
    directory(context).listFiles()?.forEach { item ->
      val name =
          try {
            String(Base64.decode(item.name.removeSuffix(".tmp"), NAME_FLAGS), Charsets.UTF_8)
          } catch (_: IllegalArgumentException) {
            null
          }
      if (name == null || name.startsWith(prefix)) item.delete()
    }
  }

  private fun directory(context: Context) = File(context.noBackupFilesDir, DIRECTORY).apply { mkdirs() }

  private fun file(context: Context, name: String): File {
    require(NAME.matches(name)) { "invalid vault item name" }
    return File(directory(context), Base64.encodeToString(name.toByteArray(Charsets.UTF_8), NAME_FLAGS))
  }

  @Synchronized
  private fun key(): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (store.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry)?.let {
      return it.secretKey
    }
    val generator =
        KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    generator.init(
        KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256)
            .build()
    )
    return generator.generateKey()
  }
}
