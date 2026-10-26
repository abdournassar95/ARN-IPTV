package com.arn.iptv.data.model

data class Channel(
    val id: String,
    val name: String,
    val categoryId: String,
    val categoryName: String,
    val logo: String? = null,
    val streamUrl: String,
    val backupStreams: List<StreamServer> = emptyList(),
    val isRadio: Boolean = false,
    val isFavorite: Boolean = false,
    val section: ContentSection = ContentSection.LIVE
)

data class StreamServer(
    val id: String,
    val label: String,
    val url: String,
    val isDefault: Boolean = false
)

data class Category(
    val id: String,
    val name: String,
    val count: Int = 0,
    val section: ContentSection = ContentSection.LIVE
)

enum class ContentSection {
    LIVE,
    MOVIES,
    SERIES,
    RADIO,
    FAVORITES,
    HISTORY
}

data class Playlist(
    val id: String,
    val name: String,
    val type: PlaylistType,
    val channelCount: Int = 0,
    val updatedAt: String? = null
)

enum class PlaylistType {
    BUILTIN,
    FG_CODE,
    XTREAM,
    M3U
}

data class XtreamAccountInfo(
    val username: String,
    val status: String,
    val expDate: String,
    val maxConnections: String
)
