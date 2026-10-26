package com.arn.iptv.data.parser

import com.arn.iptv.data.model.Channel
import com.arn.iptv.data.model.ContentSection
import java.util.UUID

/**
 * محلل متقدم لقوائم M3U و M3U8 يستخرج القنوات والتصنيفات واللوجو
 */
object M3uParser {

    fun parse(content: String, defaultCategory: String = "قنوات عامة"): List<Channel> {
        val lines = content.lines()
        val channels = mutableListOf<Channel>()

        var currentName = ""
        var currentCategory = defaultCategory
        var currentLogo: String? = null

        val extinfRegex = Regex("""#EXTINF:[-0-9]+(?:\s+tvg-name="([^"]*)")?(?:\s+tvg-logo="([^"]*)")?(?:\s+group-title="([^"]*)")?,?(.*)""")

        for (line in lines) {
            val trimmed = line.trim()
            if (trimmed.startsWith("#EXTINF:")) {
                val match = extinfRegex.find(trimmed)
                if (match != null) {
                    val groupTitle = match.groupValues[3].ifEmpty { null }
                    val channelTitle = match.groupValues[4].ifEmpty { match.groupValues[1] }
                    currentLogo = match.groupValues[2].ifEmpty { null }
                    currentName = channelTitle.ifEmpty { "قناة بدون اسم" }
                    currentCategory = groupTitle ?: defaultCategory
                } else {
                    currentName = trimmed.substringAfter(",").trim()
                }
            } else if (trimmed.isNotEmpty() && !trimmed.startsWith("#")) {
                if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
                    val isRadio = currentCategory.contains("راديو", ignoreCase = true) ||
                                  currentCategory.contains("Radio", ignoreCase = true) ||
                                  currentName.contains("إذاعة", ignoreCase = true)

                    channels.add(
                        Channel(
                            id = UUID.randomUUID().toString(),
                            name = currentName.ifEmpty { "قناة بث حي" },
                            categoryId = "cat_${currentCategory.hashCode()}",
                            categoryName = currentCategory,
                            logo = currentLogo,
                            streamUrl = trimmed,
                            isRadio = isRadio,
                            section = if (isRadio) ContentSection.RADIO else ContentSection.LIVE
                        )
                    )
                    // Reset temporary trackers
                    currentName = ""
                    currentCategory = defaultCategory
                    currentLogo = null
                }
            }
        }
        return channels
    }
}
