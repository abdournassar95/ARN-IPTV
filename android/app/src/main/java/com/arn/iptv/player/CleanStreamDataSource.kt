package com.arn.iptv.player

import android.net.Uri
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.TransferListener
import com.arn.iptv.engine.FgCryptoEngine

/**
 * محول ومزود وسائط مخصص لمشغل ExoPlayer يعترض كافة استدعاءات HLS / TS
 * ويقوم تلقائياً بتطهير بادئات التشويش k9x_ وحقن ترويسات دراما لايف.
 */
class CleanStreamDataSource(
    private val baseDataSource: DataSource
) : DataSource {

    override fun addTransferListener(transferListener: TransferListener) {
        baseDataSource.addTransferListener(transferListener)
    }

    override fun open(dataSpec: DataSpec): Long {
        val originalUri = dataSpec.uri.toString()
        val cleanedUriString = FgCryptoEngine.sanitizeStreamUrl(originalUri)
        val cleanedUri = Uri.parse(cleanedUriString)

        val modifiedDataSpec = dataSpec.buildUpon()
            .setUri(cleanedUri)
            .setHttpRequestHeaders(
                mapOf(
                    "User-Agent" to "DramaLive/187 (Android; ARN-IPTV-Pro)",
                    "Referer" to "https://dramalive.app/"
                )
            )
            .build()

        return baseDataSource.open(modifiedDataSpec)
    }

    override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        return baseDataSource.read(buffer, offset, length)
    }

    override fun getUri(): Uri? {
        return baseDataSource.uri
    }

    override fun close() {
        baseDataSource.close()
    }

    class Factory(
        private val baseHttpFactory: DefaultHttpDataSource.Factory = DefaultHttpDataSource.Factory()
            .setUserAgent("DramaLive/187 (Android; ARN-IPTV-Pro)")
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(15000)
            .setReadTimeoutMs(20000)
    ) : DataSource.Factory {
        override fun createDataSource(): DataSource {
            return CleanStreamDataSource(baseHttpFactory.createDataSource())
        }
    }
}
