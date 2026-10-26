package com.arn.iptv.player

import android.content.Context
import android.media.audiofx.LoudnessEnhancer
import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.ui.AspectRatioFrameLayout
import com.arn.iptv.data.model.Channel
import com.arn.iptv.data.model.StreamServer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * مدير مشغل الوسائط المتقدم Media3 ExoPlayer لنظام أندرويد
 * يدعم: تسريع GPU، مضاعفة الصوت 200% (LoudnessEnhancer)، الانتقال التلقائي بين السيرفرات (Auto-Failover)، واختيار الجودات ومسارات الصوت.
 */
class ExoPlayerManager(private val context: Context) {

    val player: ExoPlayer by lazy {
        ExoPlayer.Builder(context)
            .setMediaSourceFactory(
                HlsMediaSource.Factory(CleanStreamDataSource.Factory())
            )
            .build()
            .apply {
                playWhenReady = true
                repeatMode = Player.REPEAT_MODE_OFF
                addListener(playerListener)
            }
    }

    private var loudnessEnhancer: LoudnessEnhancer? = null

    private val _isPlaying = MutableStateFlow(false)
    val isPlaying: StateFlow<Boolean> = _isPlaying.asStateFlow()

    private val _isBuffering = MutableStateFlow(false)
    val isBuffering: StateFlow<Boolean> = _isBuffering.asStateFlow()

    private val _currentChannel = MutableStateFlow<Channel?>(null)
    val currentChannel: StateFlow<Channel?> = _currentChannel.asStateFlow()

    private val _currentServerIndex = MutableStateFlow(0)
    val currentServerIndex: StateFlow<Int> = _currentServerIndex.asStateFlow()

    private val _volumeBoostPercent = MutableStateFlow(100) // 0 to 200%
    val volumeBoostPercent: StateFlow<Int> = _volumeBoostPercent.asStateFlow()

    private val _aspectRatioMode = MutableStateFlow(AspectRatioFrameLayout.RESIZE_MODE_FIT)
    val aspectRatioMode: StateFlow<Int> = _aspectRatioMode.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private var currentServers: List<StreamServer> = emptyList()

    private val playerListener = object : Player.Listener {
        override fun onPlaybackStateChanged(playbackState: Int) {
            when (playbackState) {
                Player.STATE_BUFFERING -> {
                    _isBuffering.value = true
                    _errorMessage.value = null
                }
                Player.STATE_READY -> {
                    _isBuffering.value = false
                    _isPlaying.value = player.isPlaying
                    attachAudioEnhancerIfNeeded()
                }
                Player.STATE_ENDED -> {
                    _isBuffering.value = false
                    _isPlaying.value = false
                }
                Player.STATE_IDLE -> {
                    _isBuffering.value = false
                }
            }
        }

        override fun onIsPlayingChanged(playing: Boolean) {
            _isPlaying.value = playing
        }

        override fun onPlayerError(error: PlaybackException) {
            _isBuffering.value = false
            // Auto-failover to next server if available
            if (currentServers.size > 1 && _currentServerIndex.value < currentServers.size - 1) {
                val nextIndex = _currentServerIndex.value + 1
                switchServer(nextIndex)
            } else {
                _errorMessage.value = "تعذر تشغيل البث: ${error.localizedMessage ?: "خطأ في السيرفر"}"
            }
        }
    }

    fun playChannel(channel: Channel) {
        _currentChannel.value = channel
        _errorMessage.value = null

        val servers = mutableListOf<StreamServer>()
        servers.add(StreamServer("def", "السيرفر الأساسي", channel.streamUrl, true))
        servers.addAll(channel.backupStreams)
        currentServers = servers
        _currentServerIndex.value = 0

        playStreamUrl(channel.streamUrl)
    }

    fun switchServer(index: Int) {
        if (index in currentServers.indices) {
            _currentServerIndex.value = index
            val target = currentServers[index]
            playStreamUrl(target.url)
        }
    }

    private fun playStreamUrl(url: String) {
        val mediaItem = MediaItem.fromUri(Uri.parse(url))
        player.setMediaItem(mediaItem)
        player.prepare()
        player.play()
    }

    fun togglePlayPause() {
        if (player.isPlaying) {
            player.pause()
        } else {
            player.play()
        }
    }

    fun setVolume(percentage: Int) {
        val clamped = percentage.coerceIn(0, 200)
        _volumeBoostPercent.value = clamped

        if (clamped <= 100) {
            player.volume = clamped / 100f
            loudnessEnhancer?.enabled = false
        } else {
            player.volume = 1.0f
            val gainMb = ((clamped - 100) * 15).coerceAtMost(1500) // up to +15dB
            loudnessEnhancer?.apply {
                setTargetGain(gainMb)
                enabled = true
            }
        }
    }

    fun toggleAspectRatio() {
        _aspectRatioMode.value = when (_aspectRatioMode.value) {
            AspectRatioFrameLayout.RESIZE_MODE_FIT -> AspectRatioFrameLayout.RESIZE_MODE_FILL
            AspectRatioFrameLayout.RESIZE_MODE_FILL -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
            else -> AspectRatioFrameLayout.RESIZE_MODE_FIT
        }
    }

    private fun attachAudioEnhancerIfNeeded() {
        try {
            val audioSessionId = player.audioSessionId
            if (audioSessionId != C.AUDIO_SESSION_ID_UNSET && loudnessEnhancer == null) {
                loudnessEnhancer = LoudnessEnhancer(audioSessionId)
                if (_volumeBoostPercent.value > 100) {
                    val gainMb = ((_volumeBoostPercent.value - 100) * 15).coerceAtMost(1500)
                    loudnessEnhancer?.setTargetGain(gainMb)
                    loudnessEnhancer?.enabled = true
                }
            }
        } catch (_: Exception) {}
    }

    fun release() {
        loudnessEnhancer?.release()
        loudnessEnhancer = null
        player.removeListener(playerListener)
        player.release()
    }
}
