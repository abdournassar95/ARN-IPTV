package com.arn.iptv.data.catalog

import com.arn.iptv.data.model.Channel
import com.arn.iptv.data.model.ContentSection
import com.arn.iptv.data.model.StreamServer

/**
 * الكتالوج المدمج للقنوات المصرية وإذاعات القرآن والراديو العربي
 */
object BuiltinCatalog {

    fun getBuiltinChannels(): List<Channel> {
        return listOf(
            Channel(
                id = "eg_aloula",
                name = "القناة الأولى المصرية",
                categoryId = "cat_egypt",
                categoryName = "باقة قنوات مصر التلفزيونية",
                logo = "https://raw.githubusercontent.com/iptv-org/epg/master/sites/tv.apple.com/aloula.png",
                streamUrl = "https://stream.media.maspero.eg/hls/aloula.m3u8",
                section = ContentSection.LIVE
            ),
            Channel(
                id = "eg_dostour",
                name = "إكسترا نيوز — Extra News HD",
                categoryId = "cat_egypt",
                categoryName = "باقة قنوات مصر التلفزيونية",
                logo = "https://raw.githubusercontent.com/iptv-org/epg/master/sites/tv.apple.com/extranews.png",
                streamUrl = "https://stream.media.maspero.eg/hls/extra_news.m3u8",
                backupStreams = listOf(
                    StreamServer("s2", "سيرفر احتياطي UMP", "https://live-extranews.edgenextcdn.net/extranews/index.m3u8")
                ),
                section = ContentSection.LIVE
            ),
            Channel(
                id = "eg_on_e",
                name = "أون إي — ON E HD",
                categoryId = "cat_egypt",
                categoryName = "باقة قنوات مصر التلفزيونية",
                logo = "https://raw.githubusercontent.com/iptv-org/epg/master/sites/tv.apple.com/one.png",
                streamUrl = "https://live-on.edgenextcdn.net/on/index.m3u8",
                section = ContentSection.LIVE
            ),
            Channel(
                id = "eg_dmc",
                name = "دي إم سي — dmc العامة HD",
                categoryId = "cat_egypt",
                categoryName = "باقة قنوات مصر التلفزيونية",
                logo = "https://raw.githubusercontent.com/iptv-org/epg/master/sites/tv.apple.com/dmc.png",
                streamUrl = "https://live-dmc.edgenextcdn.net/dmc/index.m3u8",
                section = ContentSection.LIVE
            ),
            Channel(
                id = "eg_cbc",
                name = "سي بي سي — CBC HD",
                categoryId = "cat_egypt",
                categoryName = "باقة قنوات مصر التلفزيونية",
                logo = "https://raw.githubusercontent.com/iptv-org/epg/master/sites/tv.apple.com/cbc.png",
                streamUrl = "https://live-cbc.edgenextcdn.net/cbc/index.m3u8",
                section = ContentSection.LIVE
            ),
            // Radio Section
            Channel(
                id = "radio_quran_cairo",
                name = "إذاعة القرآن الكريم من القاهرة",
                categoryId = "cat_radio",
                categoryName = "إذاعات القرآن والراديو العربي",
                streamUrl = "https://stream.radiojar.com/8s5u8tpdtwzuv",
                isRadio = true,
                section = ContentSection.RADIO
            ),
            Channel(
                id = "radio_quran_makkah",
                name = "إذاعة نداء الإسلام من مكة المكرمة",
                categoryId = "cat_radio",
                categoryName = "إذاعات القرآن والراديو العربي",
                streamUrl = "https://stream.radiojar.com/0t5u8tpdtwzuv",
                isRadio = true,
                section = ContentSection.RADIO
            ),
            Channel(
                id = "radio_sout_elarab",
                name = "إذاعة صوت العرب من القاهرة",
                categoryId = "cat_radio",
                categoryName = "إذاعات القرآن والراديو العربي",
                streamUrl = "https://stream.media.maspero.eg/radio/sout_alarab.mp3",
                isRadio = true,
                section = ContentSection.RADIO
            ),
            Channel(
                id = "radio_shabab",
                name = "إذاعة الشباب والرياضة",
                categoryId = "cat_radio",
                categoryName = "إذاعات القرآن والراديو العربي",
                streamUrl = "https://stream.media.maspero.eg/radio/shabab_riyada.mp3",
                isRadio = true,
                section = ContentSection.RADIO
            )
        )
    }
}
