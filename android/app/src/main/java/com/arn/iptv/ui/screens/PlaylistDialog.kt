package com.arn.iptv.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.arn.iptv.data.model.Channel
import com.arn.iptv.data.parser.M3uParser
import com.arn.iptv.data.remote.XtreamApiService
import com.arn.iptv.engine.FgCryptoEngine
import com.arn.iptv.ui.theme.*
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

@Composable
fun PlaylistDialog(
    onDismiss: () -> Unit,
    onChannelsImported: (String, List<Channel>) -> Unit
) {
    var selectedTab by remember { mutableStateOf(0) } // 0: FG Code, 1: Xtream, 2: M3U

    // FG Code State
    var fgCode by remember { mutableStateOf("202122") }

    // Xtream State
    var serverHost by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }

    // M3U State
    var m3uUrl by remember { mutableStateOf("") }
    var m3uText by remember { mutableStateOf("") }

    var isLoading by remember { mutableStateOf(false) }
    var statusMessage by remember { mutableStateOf<String?>(null) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val coroutineScope = rememberCoroutineScope()
    val xtreamService = remember { XtreamApiService() }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            colors = CardDefaults.cardColors(containerColor = ObsidianCard),
            shape = RoundedCornerShape(20.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp)
        ) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "إدارة الاشتراكات وقوائم التشغيل",
                        color = Color.White,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                    IconButton(onClick = onDismiss, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.Close, contentDescription = "إغلاق", tint = TextSecondary)
                    }
                }

                // Tab Selector
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color.Black.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
                        .padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    TabButton(
                        text = "كود دراما لايف",
                        isSelected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        modifier = Modifier.weight(1f)
                    )
                    TabButton(
                        text = "Xtream Codes",
                        isSelected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        modifier = Modifier.weight(1f)
                    )
                    TabButton(
                        text = "M3U8 / M3U",
                        isSelected = selectedTab == 2,
                        onClick = { selectedTab = 2 },
                        modifier = Modifier.weight(1f)
                    )
                }

                // Status / Error Messages
                statusMessage?.let {
                    Text(text = it, color = EmeraldPrimary, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }
                errorMessage?.let {
                    Text(text = it, color = RoseDanger, fontSize = 11.sp)
                }

                // Tab 0: FG Code
                if (selectedTab == 0) {
                    OutlinedTextField(
                        value = fgCode,
                        onValueChange = { fgCode = it },
                        label = { Text("كود التفعيل الرسمي (FG Code)") },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = EmeraldPrimary,
                            unfocusedBorderColor = Color.White.copy(alpha = 0.15f),
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Button(
                        onClick = {
                            if (fgCode.isBlank()) return@Button
                            isLoading = true
                            errorMessage = null
                            statusMessage = "جاري الاتصال بمحرك دراما لايف وفك التشفير..."
                            coroutineScope.launch {
                                val result = FgCryptoEngine.activateFgCode(fgCode)
                                isLoading = false
                                result.onSuccess { jsonStr ->
                                    try {
                                        val root = JSONObject(jsonStr)
                                        val channelsJson = root.optJSONArray("channels") ?: JSONArray()
                                        val channelsList = mutableListOf<Channel>()
                                        for (i in 0 until channelsJson.length()) {
                                            val c = channelsJson.getJSONObject(i)
                                            channelsList.add(
                                                Channel(
                                                    id = c.optString("id", "fg_$i"),
                                                    name = c.optString("name", "قناة بدون اسم"),
                                                    categoryId = "cat_${c.optString("category_id")}",
                                                    categoryName = c.optString("category_name", "دراما لايف"),
                                                    streamUrl = c.optString("url"),
                                                    logo = c.optString("logo").takeIf { it.isNotEmpty() }
                                                )
                                            )
                                        }
                                        statusMessage = "تم بنجاح استيراد ${channelsList.size} قناة!"
                                        onChannelsImported("FG-$fgCode", channelsList)
                                        onDismiss()
                                    } catch (e: Exception) {
                                        errorMessage = "فشل تحليل قنوات الكود: ${e.message}"
                                    }
                                }.onFailure { err ->
                                    errorMessage = "خطأ في تفعيل الكود: ${err.message}"
                                }
                            }
                        },
                        enabled = !isLoading,
                        colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(if (isLoading) "جاري التفعيل..." else "تفعيل وجلب القنوات الآن", color = Color.Black, fontWeight = FontWeight.Bold)
                    }
                }

                // Tab 1: Xtream Codes
                if (selectedTab == 1) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = serverHost,
                            onValueChange = { serverHost = it },
                            label = { Text("عنوان السيرفر (http://host:port)") },
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = EmeraldPrimary,
                                unfocusedBorderColor = Color.White.copy(alpha = 0.15f),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = username,
                            onValueChange = { username = it },
                            label = { Text("اسم المستخدم (Username)") },
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = EmeraldPrimary,
                                unfocusedBorderColor = Color.White.copy(alpha = 0.15f),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = password,
                            onValueChange = { password = it },
                            label = { Text("كلمة المرور (Password)") },
                            singleLine = true,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = EmeraldPrimary,
                                unfocusedBorderColor = Color.White.copy(alpha = 0.15f),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Button(
                            onClick = {
                                if (serverHost.isBlank() || username.isBlank() || password.isBlank()) return@Button
                                isLoading = true
                                errorMessage = null
                                statusMessage = "جاري التحقق من الحساب وجلب القنوات..."
                                coroutineScope.launch {
                                    val authRes = xtreamService.authenticate(serverHost, username, password)
                                    authRes.onSuccess {
                                        val streamsRes = xtreamService.getLiveStreams(serverHost, username, password)
                                        isLoading = false
                                        streamsRes.onSuccess { channels ->
                                            statusMessage = "تم استيراد ${channels.size} قناة من Xtream!"
                                            onChannelsImported("Xtream-$username", channels)
                                            onDismiss()
                                        }.onFailure { err ->
                                            errorMessage = "تعذر جلب القنوات: ${err.message}"
                                        }
                                    }.onFailure { err ->
                                        isLoading = false
                                        errorMessage = "فشلت المصادقة: ${err.message}"
                                    }
                                }
                            },
                            enabled = !isLoading,
                            colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(if (isLoading) "جاري الاتصال..." else "مزامنة اشتراك Xtream", color = Color.Black, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                // Tab 2: M3U Import
                if (selectedTab == 2) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = m3uText,
                            onValueChange = { m3uText = it },
                            label = { Text("لصق محتوى #EXTM3U") },
                            maxLines = 4,
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = EmeraldPrimary,
                                unfocusedBorderColor = Color.White.copy(alpha = 0.15f),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Button(
                            onClick = {
                                if (m3uText.isBlank()) return@Button
                                val channels = M3uParser.parse(m3uText)
                                if (channels.isNotEmpty()) {
                                    onChannelsImported("قائمة M3U", channels)
                                    onDismiss()
                                } else {
                                    errorMessage = "لم يتم العثور على روابط قنوات صالحة في النص المدخل."
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("استيراد قائمة M3U", color = Color.Black, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TabButton(
    text: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(
            containerColor = if (isSelected) EmeraldPrimary else Color.Transparent
        ),
        shape = RoundedCornerShape(8.dp),
        contentPadding = PaddingValues(horizontal = 6.dp, vertical = 8.dp),
        modifier = modifier
    ) {
        Text(
            text = text,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = if (isSelected) Color.Black else Color.White
        )
    }
}
