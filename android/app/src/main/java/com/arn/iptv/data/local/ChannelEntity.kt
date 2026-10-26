package com.arn.iptv.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.arn.iptv.data.model.Channel
import com.arn.iptv.data.model.ContentSection

@Entity(tableName = "channels")
data class ChannelEntity(
    @PrimaryKey val id: String,
    val name: String,
    val categoryId: String,
    val categoryName: String,
    val logo: String?,
    val streamUrl: String,
    val isRadio: Boolean,
    val isFavorite: Boolean,
    val section: String,
    val playlistId: String
) {
    fun toChannel(): Channel {
        return Channel(
            id = id,
            name = name,
            categoryId = categoryId,
            categoryName = categoryName,
            logo = logo,
            streamUrl = streamUrl,
            isRadio = isRadio,
            isFavorite = isFavorite,
            section = runCatching { ContentSection.valueOf(section) }.getOrDefault(ContentSection.LIVE)
        )
    }

    companion object {
        fun fromChannel(channel: Channel, playlistId: String): ChannelEntity {
            return ChannelEntity(
                id = channel.id,
                name = channel.name,
                categoryId = channel.categoryId,
                categoryName = channel.categoryName,
                logo = channel.logo,
                streamUrl = channel.streamUrl,
                isRadio = channel.isRadio,
                isFavorite = channel.isFavorite,
                section = channel.section.name,
                playlistId = playlistId
            )
        }
    }
}
