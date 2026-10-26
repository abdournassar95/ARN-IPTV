package com.arn.iptv.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.arn.iptv.data.model.Category
import com.arn.iptv.data.model.Channel
import com.arn.iptv.data.model.ContentSection
import com.arn.iptv.ui.theme.*

@Composable
fun MainScreen(
    channels: List<Channel>,
    currentPlayingChannel: Channel?,
    isDeepBlackMode: Boolean,
    onToggleDeepBlackMode: () -> Unit,
    onSelectChannel: (Channel) -> Unit,
    onToggleFavorite: (Channel) -> Unit,
    onOpenPlaylistDialog: () -> Unit,
    modifier: Modifier = Modifier
) {
    var searchQuery by remember { mutableStateOf("") }
    var selectedCategoryId by remember { mutableStateOf<String?>(null) }
    var selectedSection by remember { mutableStateOf(ContentSection.LIVE) }

    // Derive Categories
    val categories = remember(channels, selectedSection) {
        val filteredBySection = when (selectedSection) {
            ContentSection.FAVORITES -> channels.filter { it.isFavorite }
            ContentSection.RADIO -> channels.filter { it.isRadio }
            else -> channels.filter { !it.isRadio }
        }
        val grouped = filteredBySection.groupBy { it.categoryId }
        grouped.map { (catId, chs) ->
            Category(
                id = catId,
                name = chs.firstOrNull()?.categoryName ?: "عام",
                count = chs.size,
                section = selectedSection
            )
        }
    }

    // Filtered Channels
    val filteredChannels = remember(channels, selectedSection, selectedCategoryId, searchQuery) {
        channels.filter { ch ->
            val matchSection = when (selectedSection) {
                ContentSection.FAVORITES -> ch.isFavorite
                ContentSection.RADIO -> ch.isRadio
                else -> !ch.isRadio
            }
            val matchCategory = selectedCategoryId == null || ch.categoryId == selectedCategoryId
            val matchQuery = searchQuery.isBlank() ||
                    ch.name.contains(searchQuery, ignoreCase = true) ||
                    ch.categoryName.contains(searchQuery, ignoreCase = true)

            matchSection && matchCategory && matchQuery
        }
    }

    val backgroundColor = if (isDeepBlackMode) OledBlack else ObsidianBase

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(backgroundColor)
            .statusBarsPadding()
    ) {
        // Top 1-Row Apple TV Bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color.White.copy(alpha = 0.08f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.Tv,
                        contentDescription = "App Icon",
                        tint = EmeraldPrimary,
                        modifier = Modifier.size(20.dp)
                    )
                }
                Column {
                    Text(
                        text = "ARN IPTV Pro",
                        color = Color.White,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Android Native Edition",
                        color = TextSecondary,
                        fontSize = 10.sp
                    )
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                // OLED Deep Black Mode Toggle
                IconButton(
                    onClick = onToggleDeepBlackMode,
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(if (isDeepBlackMode) Color.Black else Color.White.copy(alpha = 0.06f))
                        .border(1.dp, if (isDeepBlackMode) EmeraldPrimary.copy(alpha = 0.5f) else Color.White.copy(alpha = 0.1f), CircleShape)
                ) {
                    Icon(
                        Icons.Default.DarkMode,
                        contentDescription = "OLED Deep Black",
                        tint = if (isDeepBlackMode) EmeraldPrimary else TextSecondary,
                        modifier = Modifier.size(18.dp)
                    )
                }

                // Add / Manage Playlists
                Button(
                    onClick = onOpenPlaylistDialog,
                    colors = ButtonDefaults.buttonColors(containerColor = EmeraldPrimary),
                    shape = RoundedCornerShape(10.dp),
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "إضافة", tint = Color.Black, modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("القوائم والأكواد", color = Color.Black, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Search Bar
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("ابحث عن القنوات والمحطات...", fontSize = 12.sp, color = TextMuted) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = "بحث", tint = TextSecondary, modifier = Modifier.size(18.dp)) },
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = EmeraldPrimary.copy(alpha = 0.6f),
                unfocusedBorderColor = Color.White.copy(alpha = 0.08f),
                focusedContainerColor = ObsidianCard,
                unfocusedContainerColor = ObsidianCard,
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White
            ),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 6.dp)
        )

        // Section Tabs (البث المباشر / إذاعات الراديو / المفضلة)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            SectionPill(
                title = "القنوات الفضائية",
                icon = Icons.Default.LiveTv,
                isSelected = selectedSection == ContentSection.LIVE,
                onClick = {
                    selectedSection = ContentSection.LIVE
                    selectedCategoryId = null
                },
                modifier = Modifier.weight(1f)
            )
            SectionPill(
                title = "الراديو العربي",
                icon = Icons.Default.Radio,
                isSelected = selectedSection == ContentSection.RADIO,
                onClick = {
                    selectedSection = ContentSection.RADIO
                    selectedCategoryId = null
                },
                modifier = Modifier.weight(1f)
            )
            SectionPill(
                title = "المفضلة",
                icon = Icons.Default.Star,
                isSelected = selectedSection == ContentSection.FAVORITES,
                onClick = {
                    selectedSection = ContentSection.FAVORITES
                    selectedCategoryId = null
                },
                modifier = Modifier.weight(1f)
            )
        }

        // Categories Row
        if (categories.isNotEmpty()) {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                item {
                    CategoryChip(
                        name = "الكل",
                        count = channels.size,
                        isSelected = selectedCategoryId == null,
                        onClick = { selectedCategoryId = null }
                    )
                }
                items(categories) { cat ->
                    CategoryChip(
                        name = cat.name,
                        count = cat.count,
                        isSelected = selectedCategoryId == cat.id,
                        onClick = { selectedCategoryId = cat.id }
                    )
                }
            }
        }

        // Seamless Channel List (Zero-Pill rows with D-Pad focus)
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            items(filteredChannels, key = { it.id }) { channel ->
                val isCurrentPlaying = currentPlayingChannel?.id == channel.id
                var isFocused by remember { mutableStateOf(false) }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(
                            when {
                                isCurrentPlaying -> EmeraldPrimary.copy(alpha = 0.12f)
                                isFocused -> Color.White.copy(alpha = 0.10f)
                                else -> Color.White.copy(alpha = 0.03f)
                            }
                        )
                        .border(
                            1.dp,
                            when {
                                isCurrentPlaying -> EmeraldPrimary.copy(alpha = 0.4f)
                                isFocused -> Color.White.copy(alpha = 0.3f)
                                else -> Color.Transparent
                            },
                            RoundedCornerShape(12.dp)
                        )
                        .focusable()
                        .onFocusChanged { isFocused = it.isFocused }
                        .clickable { onSelectChannel(channel) }
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        // Live indicator dot
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(if (isCurrentPlaying) EmeraldPrimary else Color.White.copy(alpha = 0.2f))
                        )

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = channel.name,
                                color = if (isCurrentPlaying) EmeraldPrimary else Color.White,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1
                            )
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = channel.categoryName,
                                    color = TextSecondary,
                                    fontSize = 11.sp
                                )
                                Text(text = "·", color = TextMuted)
                                Text(
                                    text = if (channel.isRadio) "بث راديو صوتي" else "بث فضائي مباشر",
                                    color = TextMuted,
                                    fontSize = 10.sp
                                )
                            }
                        }
                    }

                    // Favorite Button
                    IconButton(
                        onClick = { onToggleFavorite(channel) },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            if (channel.isFavorite) Icons.Default.Star else Icons.Default.StarBorder,
                            contentDescription = "تفضيل",
                            tint = if (channel.isFavorite) Color(0xFFFBBF24) else TextSecondary,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionPill(
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Button(
        onClick = onClick,
        colors = ButtonDefaults.buttonColors(
            containerColor = if (isSelected) EmeraldPrimary else Color.White.copy(alpha = 0.06f)
        ),
        shape = RoundedCornerShape(10.dp),
        contentPadding = PaddingValues(vertical = 8.dp, horizontal = 10.dp),
        modifier = modifier
    ) {
        Icon(icon, contentDescription = title, tint = if (isSelected) Color.Black else Color.White, modifier = Modifier.size(16.dp))
        Spacer(modifier = Modifier.width(6.dp))
        Text(text = title, fontSize = 11.sp, fontWeight = FontWeight.Bold, color = if (isSelected) Color.Black else Color.White)
    }
}

@Composable
private fun CategoryChip(
    name: String,
    count: Int,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(if (isSelected) Color.White.copy(alpha = 0.12f) else Color.White.copy(alpha = 0.04f))
            .border(1.dp, if (isSelected) Color.White.copy(alpha = 0.2f) else Color.Transparent, RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 6.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = name,
                color = if (isSelected) Color.White else TextSecondary,
                fontSize = 11.sp,
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal
            )
            Text(
                text = "$count",
                color = if (isSelected) EmeraldPrimary else TextMuted,
                fontSize = 10.sp
            )
        }
    }
}
