package com.arn.iptv.engine

import android.util.Base64
import java.nio.charset.StandardCharsets
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * محرك التشفير وفك التشفير الأصلي لدراما لايف في أندرويد (AES-128-CBC)
 * متطابق 100% مع خوارزمية Node.js و Python الأصلية (KEY_ACTIVATED_TYPE v187).
 * تطوير: عبده رجب نصار — ARN Technology.
 */
object FgCryptoEngine {
    private const val AES_KEY_STRING = "0123456789abcdef"
    private const val AES_IV_STRING = "fedcba9876543210"
    private const val DRAMA_API_ENDPOINT = "https://dramalive.app/api/v1/activate"

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    private fun getKeySpec(): SecretKeySpec {
        return SecretKeySpec(AES_KEY_STRING.toByteArray(StandardCharsets.UTF_8), "AES")
    }

    private fun getIvSpec(): IvParameterSpec {
        return IvParameterSpec(AES_IV_STRING.toByteArray(StandardCharsets.UTF_8))
    }

    /**
     * تشفير نص صريح أو كائن JSON بنظام AES-128-CBC وإرجاع ناتج Base64
     */
    fun encrypt(plainText: String): String {
        val cipher = Cipher.getInstance("AES/CBC/PKCS7Padding")
        cipher.init(Cipher.ENCRYPT_MODE, getKeySpec(), getIvSpec())
        val encryptedBytes = cipher.doFinal(plainText.toByteArray(StandardCharsets.UTF_8))
        return Base64.encodeToString(encryptedBytes, Base64.NO_WRAP)
    }

    /**
     * فك تشفير نص Base64 مشفر بـ AES-128-CBC
     */
    fun decrypt(cipherBase64: String): String {
        val cipher = Cipher.getInstance("AES/CBC/PKCS7Padding")
        cipher.init(Cipher.DECRYPT_MODE, getKeySpec(), getIvSpec())
        val decodedBytes = Base64.decode(cipherBase64.trim(), Base64.DEFAULT)
        val decryptedBytes = cipher.doFinal(decodedBytes)
        return String(decryptedBytes, StandardCharsets.UTF_8)
    }

    /**
     * تفعيل كود دراما لايف (FG Code) وجلب القنوات المفكوكة
     */
    suspend fun activateFgCode(code: String): Result<String> = withContext(Dispatchers.IO) {
        try {
            val payload = JSONObject().apply {
                put("code", code.trim())
                put("activated_type", "KEY_ACTIVATED_TYPE")
                put("version", "187")
            }

            val encryptedPayload = encrypt(payload.toString())
            val requestBodyJson = JSONObject().apply {
                put("data", encryptedPayload)
            }

            val request = Request.Builder()
                .url(DRAMA_API_ENDPOINT)
                .post(requestBodyJson.toString().toRequestBody("application/json".toMediaType()))
                .addHeader("User-Agent", "DramaLive/187 (Android; ARN-IPTV-Pro)")
                .addHeader("Accept", "application/json")
                .build()

            val response = httpClient.newCall(request).execute()
            if (!response.isSuccessful) {
                return@withContext Result.failure(Exception("HTTP Error: ${response.code}"))
            }

            val responseText = response.body?.string() ?: ""
            val jsonResp = JSONObject(responseText)
            val encryptedResponse = jsonResp.optString("data", "")

            if (encryptedResponse.isNotEmpty()) {
                val decrypted = decrypt(encryptedResponse)
                Result.success(decrypted)
            } else {
                Result.success(responseText)
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * إزالة بادئات التشويش k9x_ من الروابط
     */
    fun sanitizeStreamUrl(url: String): String {
        return url
            .replace("k9x_", "")
            .replace("/k9x/", "/")
    }
}
