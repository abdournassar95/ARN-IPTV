package com.arn.iptv.ui.screens

import android.app.Activity
import android.app.PictureInPictureParams
import android.os.Build
import android.util.Rational
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.arn.iptv.player.ExoPlayerManager
import com.arn.iptv.ui.theme.*
import kotlinx.coroutines.delay

@Composable
fun PlayerScreen(
    playerManager: ExoPlayerManager,
    onClosePlayer: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val currentChannel by playerManager.currentChannel.collectAsState()
    val isPlaying by playerManager.isPlaying.collectAsState()
    val isBuffering by playerManager.isBuffering.collectAsState()
    val currentServerIndex by playerManager.currentServerIndex.collectAsState()
    val volumeBoostPercent by playerManager.volumeBoostPercent.collectAsState()
    val aspectRatioMode by playerManager.aspectRatioMode.collectAsState()
    val errorMessage by playerManager.errorMessage.collectAsState()

    var areControlsVisible by remember { mutableStateOf(true) }

    // Auto-hide controls after 4 seconds of inactivity
    LaunchedEffect(areControlsVisible, isPlaying) {
        if (areControlsVisible && isPlaying) {
            delay(4000)
            areControlsVisible = false
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black)
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null
            ) {
                areControlsVisible = !areControlsVisible
            }
    ) {
        // Video Viewport with Hardware Acceleration
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    player = playerManager.player
                    useController = false
                    resizeMode = aspectRatioMode
                }
            },
            update = { playerView ->
                playerView.player = playerManager.player
                playerView.resizeMode = aspectRatioMode
            },
            modifier = Modifier.fillMaxSize()
        )

        // Buffering Indicator
        if (isBuffering) {
            CircularProgressIndicator(
                color = EmeraldPrimary,
                modifier = Modifier
                    .size(54.dp)
                    .align(Alignment.Center)
            )
        }

        // Error Banner
        errorMessage?.let { error ->
            Card(
                colors = CardDefaults.cardColors(containerColor = RoseDanger.copy(alpha = 0.9f)),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(24.dp)
            ) {
                Text(
                    text = error,
                    color = Color.White,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(16.dp)
                )
            }
        }

        // Overlay Controls
        AnimatedVisibility(
            visible = areControlsVisible,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.fillMaxSize()
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.45f))
            ) {
                // Top Action Bar
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .statusBarsPadding()
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        IconButton(
                            onClick = onClosePlayer,
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(Color.Black.copy(alpha = 0.6f))
                        ) {
                            Icon(Icons.Default.Close, contentDescription = "إغلاق", tint = Color.White)
                        }

                        Column {
                            Text(
                                text = currentChannel?.name ?: "البث التلفزيوني",
                                color = Color.White,
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = currentChannel?.categoryName ?: "",
                                color = TextSecondary,
                                fontSize = 11.sp
                            )
                        }
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        // Picture in Picture
                        IconButton(
                            onClick = {
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                    val activity = context as? Activity
                                    val params = PictureInPictureParams.Builder()
                                        .setAspectRatio(Rational(16, 9))
                                        .build()
                                    activity?.enterPictureInPictureMode(params)
                                }
                            },
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(Color.Black.copy(alpha = 0.6f))
                        ) {
                            Icon(Icons.Default.PictureInPicture, contentDescription = "PiP", tint = Color.White)
                        }

                        // Aspect Ratio Toggle
                        IconButton(
                            onClick = { playerManager.toggleAspectRatio() },
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(Color.Black.copy(alpha = 0.6f))
                        ) {
                            Icon(Icons.Default.AspectRatio, contentDescription = "الأبعاد", tint = Color.White)
                        }
                    }
                }

                // Center Play/Pause button
                IconButton(
                    onClick = { playerManager.togglePlayPause() },
                    modifier = Modifier
                        .size(64.dp)
                        .align(Alignment.Center)
                        .clip(CircleShape)
                        .background(Color.Black.copy(alpha = 0.65f))
                ) {
                    Icon(
                        if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                        contentDescription = "تشغيل / إيقاف",
                        tint = EmeraldPrimary,
                        modifier = Modifier.size(36.dp)
                    )
                }

                // Bottom Unified Segmented Control Track
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color.Black.copy(alpha = 0.85f)),
                    shape = RoundedCornerShape(20.dp),
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .navigationBarsPadding()
                        .padding(16.dp)
                        .fillMaxWidth()
                ) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Server Switcher
                        currentChannel?.backupStreams?.let { backups ->
                            if (backups.isNotEmpty()) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Button(
                                        onClick = { playerManager.switchServer(0) },
                                        colors = ButtonDefaults.buttonColors(
                                            containerColor = if (currentServerIndex == 0) EmeraldPrimary else Color.White.copy(alpha = 0.1f)
                                        ),
                                        shape = RoundedCornerShape(10.dp),
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text("سيرفر أساسي", fontSize = 11.sp, color = if (currentServerIndex == 0) Color.Black else Color.White)
                                    }

                                    backups.forEachIndexed { idx, srv ->
                                        val srvIndex = idx + 1
                                        Button(
                                            onClick = { playerManager.switchServer(srvIndex) },
                                            colors = ButtonDefaults.buttonColors(
                                                containerColor = if (currentServerIndex == srvIndex) EmeraldPrimary else Color.White.copy(alpha = 0.1f)
                                            ),
                                            shape = RoundedCornerShape(10.dp),
                                            modifier = Modifier.weight(1f)
                                        ) {
                                            Text(srv.label, fontSize = 11.sp, color = if (currentServerIndex == srvIndex) Color.Black else Color.White)
                                        }
                                    }
                                }
                            }
                        }

                        // WebAudio 200% Volume Booster Fader
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Icon(
                                if (volumeBoostPercent > 100) Icons.Default.VolumeUp else Icons.Default.VolumeDown,
                                contentDescription = "الصوت",
                                tint = if (volumeBoostPercent > 100) SkyAccent else EmeraldPrimary,
                                modifier = Modifier.size(20.dp)
                            )

                            Slider(
                                value = volumeBoostPercent.toFloat(),
                                onValueChange = { playerManager.setVolume(it.toInt()) },
                                valueRange = 0f..200f,
                                colors = SliderDefaults.colors(
                                    thumbColor = if (volumeBoostPercent > 100) SkyAccent else EmeraldPrimary,
                                    activeTrackColor = if (volumeBoostPercent > 100) SkyAccent else EmeraldPrimary
                                ),
                                modifier = Modifier.weight(1f)
                            )

                            Text(
                                text = "$volumeBoostPercent%",
                                color = if (volumeBoostPercent > 100) SkyAccent else Color.White,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}
