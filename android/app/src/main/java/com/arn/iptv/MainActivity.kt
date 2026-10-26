package com.arn.iptv

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.arn.iptv.data.catalog.BuiltinCatalog
import com.arn.iptv.data.local.AppDatabase
import com.arn.iptv.data.local.ChannelEntity
import com.arn.iptv.data.model.Channel
import com.arn.iptv.player.ExoPlayerManager
import com.arn.iptv.ui.screens.MainScreen
import com.arn.iptv.ui.screens.PlayerScreen
import com.arn.iptv.ui.screens.PlaylistDialog
import com.arn.iptv.ui.screens.RadioScreen
import com.arn.iptv.ui.theme.ARNIPTVTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {

    private lateinit var playerManager: ExoPlayerManager
    private lateinit var appDatabase: AppDatabase

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        playerManager = ExoPlayerManager(this)
        appDatabase = AppDatabase.getInstance(this)

        setContent {
            var isDeepBlackMode by remember { mutableStateOf(false) }
            var isPlaylistDialogOpen by remember { mutableStateOf(false) }
            var activePlayingChannel by remember { mutableStateOf<Channel?>(null) }
            var channelsList by remember { mutableStateOf<List<Channel>>(emptyList()) }

            val coroutineScope = rememberCoroutineScope()

            // Seed Built-in Egyptian Channels & Quran Radio
            LaunchedEffect(Unit) {
                withContext(Dispatchers.IO) {
                    val builtin = BuiltinCatalog.getBuiltinChannels()
                    val entities = builtin.map { ChannelEntity.fromChannel(it, "builtin") }
                    appDatabase.channelDao().insertChannels(entities)
                }
                appDatabase.channelDao().getChannelsByPlaylist("builtin").collect { entities ->
                    if (channelsList.isEmpty()) {
                        channelsList = entities.map { it.toChannel() }
                    }
                }
            }

            ARNIPTVTheme(isDeepBlackMode = isDeepBlackMode) {
                when {
                    activePlayingChannel != null && activePlayingChannel?.isRadio == true -> {
                        RadioScreen(
                            playerManager = playerManager,
                            onClose = {
                                activePlayingChannel = null
                                playerManager.player.stop()
                            },
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                    activePlayingChannel != null -> {
                        PlayerScreen(
                            playerManager = playerManager,
                            onClosePlayer = {
                                activePlayingChannel = null
                                playerManager.player.stop()
                            },
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                    else -> {
                        MainScreen(
                            channels = channelsList,
                            currentPlayingChannel = activePlayingChannel,
                            isDeepBlackMode = isDeepBlackMode,
                            onToggleDeepBlackMode = { isDeepBlackMode = !isDeepBlackMode },
                            onSelectChannel = { channel ->
                                activePlayingChannel = channel
                                playerManager.playChannel(channel)
                            },
                            onToggleFavorite = { channel ->
                                val updated = channel.copy(isFavorite = !channel.isFavorite)
                                channelsList = channelsList.map { if (it.id == channel.id) updated else it }
                                coroutineScope.launch(Dispatchers.IO) {
                                    appDatabase.channelDao().setFavorite(channel.id, updated.isFavorite)
                                }
                            },
                            onOpenPlaylistDialog = { isPlaylistDialogOpen = true },
                            modifier = Modifier.fillMaxSize()
                        )
                    }
                }

                if (isPlaylistDialogOpen) {
                    PlaylistDialog(
                        onDismiss = { isPlaylistDialogOpen = false },
                        onChannelsImported = { playlistName, newChannels ->
                            channelsList = newChannels + channelsList
                            coroutineScope.launch(Dispatchers.IO) {
                                val entities = newChannels.map { ChannelEntity.fromChannel(it, playlistName) }
                                appDatabase.channelDao().insertChannels(entities)
                            }
                        }
                    )
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        playerManager.release()
    }
}
