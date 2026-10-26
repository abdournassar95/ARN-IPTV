package com.arn.iptv.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

@Composable
fun ARNIPTVTheme(
    isDeepBlackMode: Boolean = false,
    content: @Composable () -> Unit
) {
    val backgroundColor = if (isDeepBlackMode) OledBlack else ObsidianBase
    val surfaceColor = if (isDeepBlackMode) OledBlack else ObsidianCard

    val colorScheme = darkColorScheme(
        primary = EmeraldPrimary,
        secondary = SkyAccent,
        background = backgroundColor,
        surface = surfaceColor,
        onPrimary = Color.Black,
        onSecondary = Color.Black,
        onBackground = TextPrimary,
        onSurface = TextPrimary
    )

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
