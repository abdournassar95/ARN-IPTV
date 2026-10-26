package com.arn.iptv.ui.screens

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.arn.iptv.player.ExoPlayerManager
import com.arn.iptv.ui.theme.*

@Composable
fun RadioScreen(
    playerManager: ExoPlayerManager,
    onClose: () -> Unit,
    modifier: Modifier = Modifier
) {
    val currentChannel by playerManager.currentChannel.collectAsState()
    val isPlaying by playerManager.isPlaying.collectAsState()
    val isBuffering by playerManager.isBuffering.collectAsState()
    val volumePercent by playerManager.volumeBoostPercent.collectAsState()

    // Smooth rotating needle for B&O acoustic feel
    val infiniteTransition = rememberInfiniteTransition(label = "AcousticDial")
    val dialRotation by infiniteTransition.animateFloat(
        initialValue = -15f,
        targetValue = 15f,
        animationSpec = infiniteRepeatable(
            animation = tween(2200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "NeedleRotation"
    )

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        ObsidianBase,
                        Color(0xFF0A0F1D),
                        ObsidianBase
                    )
                )
            )
            .padding(24.dp)
    ) {
        // Top Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(
                onClick = onClose,
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.06f))
            ) {
                Icon(Icons.Default.ArrowBack, contentDescription = "رجوع", tint = Color.White)
            }

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "استوديو الراديو العربي",
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Bang & Olufsen Acoustic Engine",
                    color = TextSecondary,
                    fontSize = 10.sp
                )
            }

            Spacer(modifier = Modifier.size(40.dp))
        }

        // Center Acoustic Dial
        Column(
            modifier = Modifier
                .align(Alignment.Center)
                .fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(240.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.radialGradient(
                            colors = listOf(
                                Color(0xFF1E2638),
                                Color(0xFF0F1523),
                                Color(0xFF070B14)
                            )
                        )
                    )
                    .border(2.dp, Color.White.copy(alpha = 0.12f), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                // Radio Frequency Dial markings
                Box(
                    modifier = Modifier
                        .size(190.dp)
                        .rotate(if (isPlaying) dialRotation else 0f)
                ) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopCenter)
                            .width(3.dp)
                            .height(24.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(EmeraldPrimary)
                    )
                }

                // Center Hub
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(CircleShape)
                        .background(Color.Black.copy(alpha = 0.8f))
                        .border(1.dp, EmeraldPrimary.copy(alpha = 0.4f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    if (isBuffering) {
                        CircularProgressIndicator(
                            color = EmeraldPrimary,
                            modifier = Modifier.size(32.dp)
                        )
                    } else {
                        Icon(
                            Icons.Default.Radio,
                            contentDescription = "Radio",
                            tint = if (isPlaying) EmeraldPrimary else Color.White,
                            modifier = Modifier.size(36.dp)
                        )
                    }
                }
            }

            // Radio Info
            Text(
                text = currentChannel?.name ?: "محطة إذاعية",
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "بث حي فائق الجودة · مسار صوتي نقي بدون تقطيع",
                color = TextSecondary,
                fontSize = 12.sp
            )

            // Play / Pause Button
            IconButton(
                onClick = { playerManager.togglePlayPause() },
                modifier = Modifier
                    .size(68.dp)
                    .clip(CircleShape)
                    .background(EmeraldPrimary)
            ) {
                Icon(
                    if (isPlaying) Icons.Default.Pause else Icons.Default.PlayArrow,
                    contentDescription = "تشغيل",
                    tint = Color.Black,
                    modifier = Modifier.size(38.dp)
                )
            }
        }

        // Bottom Volume Slider
        Card(
            colors = CardDefaults.cardColors(containerColor = Color.Black.copy(alpha = 0.6f)),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .fillMaxWidth()
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(Icons.Default.VolumeUp, contentDescription = "Volume", tint = EmeraldPrimary)
                Slider(
                    value = volumePercent.toFloat(),
                    onValueChange = { playerManager.setVolume(it.toInt()) },
                    valueRange = 0f..200f,
                    colors = SliderDefaults.colors(
                        thumbColor = EmeraldPrimary,
                        activeTrackColor = EmeraldPrimary
                    ),
                    modifier = Modifier.weight(1f)
                )
                Text(
                    text = "$volumePercent%",
                    color = Color.White,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}
