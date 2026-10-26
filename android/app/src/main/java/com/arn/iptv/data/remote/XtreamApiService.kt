package com.arn.iptv.data.remote

import com.arn.iptv.data.model.Channel
import com.arn.iptv.data.model.ContentSection
import com.arn.iptv.data.model.XtreamAccountInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * عميل بروتوكول Xtream Codes API الرسمي (player_api.php)
 */
class XtreamApiService {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    suspend fun authenticate(
        serverUrl: String,
        username: String,
        pass: String
    ): Result<XtreamAccountInfo> = withContext(Dispatchers.IO) {
        try {
            val base = serverUrl.trimEnd('/')
            val url = "$base/player_api.php?username=$username&password=$pass"

            val request = Request.Builder().url(url).build()
            val response = client.newCall(request).execute()
            val text = response.body?.string() ?: ""

            val json = JSONObject(text)
            val userInfo = json.optJSONObject("user_info")
                ?: return@withContext Result.failure(Exception("فشل التحقق من بيانات حساب سيرفر Xtream"))

            val authStatus = userInfo.optInt("auth", 0)
            if (authStatus != 1 && userInfo.optString("status") != "Active") {
                return@withContext Result.failure(Exception("الحساب غير مفعل أو منتهي الصلاحية"))
            }

            val expTimestamp = userInfo.optLong("exp_date", 0)
            val expDate = if (expTimestamp > 0) {
                java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault())
                    .format(java.util.Date(expTimestamp * 1000))
            } else {
                "غير محدود / Unlimited"
            }

            Result.success(
                XtreamAccountInfo(
                    username = userInfo.optString("username", username),
                    status = userInfo.optString("status", "Active"),
                    expDate = expDate,
                    maxConnections = userInfo.optString("max_connections", "1")
                )
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getLiveStreams(
        serverUrl: String,
        username: String,
        pass: String
    ): Result<List<Channel>> = withContext(Dispatchers.IO) {
        try {
            val base = serverUrl.trimEnd('/')
            val url = "$base/player_api.php?username=$username&password=$pass&action=get_live_streams"

            val request = Request.Builder().url(url).build()
            val response = client.newCall(request).execute()
            val text = response.body?.string() ?: "[]"

            val jsonArray = JSONArray(text)
            val channels = mutableListOf<Channel>()

            for (i in 0 until jsonArray.length()) {
                val item = jsonArray.getJSONObject(i)
                val streamId = item.optString("stream_id")
                val streamType = item.optString("stream_type", "live")
                val streamUrl = "$base/$streamType/$username/$pass/$streamId.m3u8"

                channels.add(
                    Channel(
                        id = "xtream_$streamId",
                        name = item.optString("name", "قناة بدون اسم"),
                        categoryId = "cat_${item.optString("category_id", "default")}",
                        categoryName = item.optString("category_name", "قنوات عامة"),
                        logo = item.optString("stream_icon").takeIf { it.isNotEmpty() },
                        streamUrl = streamUrl,
                        section = ContentSection.LIVE
                    )
                )
            }
            Result.success(channels)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
