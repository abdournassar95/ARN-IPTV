import { ChannelItem, StreamServerSource } from '../types/iptv.js';

export function buildEgyptSources(code: string, idLive: string, fallbackUrl?: string): StreamServerSource[] {
  // Dedicated rock-solid direct MPEG-TS sources for Egyptian MBC channels
  if (idLive === 'live_tv_panel_c6ab30c8f13fb5b6fc3756b08e5afd1a') {
    // MBC Drama Masr
    return [
      {
        id: `${idLive}-srv-1`,
        serverNumber: 1,
        badge: 'FHD',
        name: 'سيرفر 1 (بث فضائي مباشر FHD)',
        url: `/api/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=0`,
        isProxied: true,
        hasK9xSwap: true,
      },
      {
        id: `${idLive}-srv-2`,
        serverNumber: 2,
        badge: 'FHD Direct',
        name: 'سيرفر 2 (بث مباشر عالي السرعة)',
        url: 'http://185.9.2.18/chid_741/mono.m3u8',
        qualityHint: '1080p FHD Direct',
      },
      {
        id: `${idLive}-srv-3`,
        serverNumber: 3,
        badge: 'Proxy',
        name: 'سيرفر 3 (البروكسي المحلي المباشر)',
        url: `/api/proxy/m3u8?u=${encodeURIComponent('http://185.9.2.18/chid_741/mono.m3u8')}`,
        isProxied: true,
      },
      {
        id: `${idLive}-srv-4`,
        serverNumber: 4,
        badge: 'HD',
        name: 'سيرفر 4 (بث احتياطي)',
        url: `/api/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=1`,
        isProxied: true,
        hasK9xSwap: true,
      },
    ];
  }

  if (idLive === 'live_tv_mbcmsr') {
    // MBC Masr 1
    return [
      {
        id: `${idLive}-srv-1`,
        serverNumber: 1,
        badge: 'FHD',
        name: 'سيرفر 1 (بث فضائي مباشر FHD)',
        url: `/api/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=0`,
        isProxied: true,
        hasK9xSwap: true,
      },
      {
        id: `${idLive}-srv-2`,
        serverNumber: 2,
        badge: 'FHD Direct',
        name: 'سيرفر 2 (بث مباشر عالي السرعة)',
        url: 'http://185.9.2.18/chid_742/mono.m3u8',
        qualityHint: '1080p FHD Direct',
      },
      {
        id: `${idLive}-srv-3`,
        serverNumber: 3,
        badge: 'HD USA',
        name: 'سيرفر 3 (بث دولي احتياطي)',
        url: 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-masr-usa/857e4e8e19c0deea13c1f06ca27d6d97/index.m3u8',
        qualityHint: '720p HD',
      },
      {
        id: `${idLive}-srv-4`,
        serverNumber: 4,
        badge: 'Proxy',
        name: 'سيرفر 4 (عبر البروكسي المحلي)',
        url: `/api/proxy/m3u8?u=${encodeURIComponent('http://185.9.2.18/chid_742/mono.m3u8')}`,
        isProxied: true,
      },
    ];
  }

  if (idLive === 'live_tv_mbcmasr2') {
    // MBC Masr 2
    return [
      {
        id: `${idLive}-srv-1`,
        serverNumber: 1,
        badge: 'FHD',
        name: 'سيرفر 1 (بث فضائي مباشر FHD)',
        url: `/api/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=0`,
        isProxied: true,
        hasK9xSwap: true,
      },
      {
        id: `${idLive}-srv-2`,
        serverNumber: 2,
        badge: 'FHD Direct',
        name: 'سيرفر 2 (بث مباشر عالي السرعة)',
        url: 'http://185.9.2.18/chid_743/mono.m3u8',
        qualityHint: '1080p FHD Direct',
      },
      {
        id: `${idLive}-srv-3`,
        serverNumber: 3,
        badge: 'Proxy',
        name: 'سيرفر 3 (عبر البروكسي المحلي)',
        url: `/api/proxy/m3u8?u=${encodeURIComponent('http://185.9.2.18/chid_743/mono.m3u8')}`,
        isProxied: true,
      },
      {
        id: `${idLive}-srv-4`,
        serverNumber: 4,
        badge: 'HD',
        name: 'سيرفر 4 (بث احتياطي)',
        url: `/api/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=1`,
        isProxied: true,
        hasK9xSwap: true,
      },
    ];
  }

  const directFallback = fallbackUrl || 'https://shd-amg-fast.edgenextcdn.net/tx001/playlist.m3u8';
  return [
    {
      id: `${idLive}-srv-1`,
      serverNumber: 1,
      badge: 'FHD',
      name: 'سيرفر 1 (بث فضائي مباشر)',
      url: `/api/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=0`,
      isProxied: true,
      hasK9xSwap: true,
    },
    {
      id: `${idLive}-srv-2`,
      serverNumber: 2,
      badge: 'HD',
      name: 'سيرفر 2 (جودة عالية)',
      url: `/api/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=1`,
      isProxied: true,
      hasK9xSwap: true,
    },
    {
      id: `${idLive}-srv-3`,
      serverNumber: 3,
      badge: 'SD',
      name: 'سيرفر 3 (بث احتياطي سريع)',
      url: directFallback,
      qualityHint: 'Direct Stream',
    },
    {
      id: `${idLive}-srv-4`,
      serverNumber: 4,
      badge: 'Proxy',
      name: 'سيرفر 4 (عبر البروكسي المحلي)',
      url: `/api/proxy/m3u8?u=${encodeURIComponent(directFallback)}`,
      isProxied: true,
    },
  ];
}

/**
 * All 61 Authentic Egyptian TV Channels from Drama Live Server (Topic 20)
 */
export function getEgyptianChannels(playlistId: string, code = '202122', customCategoryId?: string): ChannelItem[] {
  const categoryId = customCategoryId || `fg-cat-eg-${code}`;

  const channelDefs = [
    { id: 'live_tv_alahlytv', name: 'Al Ahly | الاهلي', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/8/8c/Al_Ahly_SC_logo.svg/320px-Al_Ahly_SC_logo.svg.png' },
    { id: 'live_tv_egzamalek', name: 'Al Zamalek | الزمالك', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/0/04/ZamalekSC.png/320px-ZamalekSC.png' },
    { id: 'live_tv_onsport2', name: 'ON Sport 2 | أون سبورت 2', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/1/1a/ON_Sport_logo.png/320px-ON_Sport_logo.png' },
    { id: 'live_tv_onsport3', name: 'ON Sport 3 | أون سبورت 3', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/1/1a/ON_Sport_logo.png/320px-ON_Sport_logo.png' },
    { id: 'live_tv_onsport', name: 'ON Sport | أون سبورت', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/1/1a/ON_Sport_logo.png/320px-ON_Sport_logo.png' },
    { id: 'live_tv_egyptalfady', name: 'Al Fady TV | قناة الفادي الفضائية', logo: 'https://i.imgur.com/gK998sT.png' },
    { id: 'live_tv_eghayat1', name: 'Al Hayah 1 | الحياة الاولى', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/AlHayah_TV_logo.svg/320px-AlHayah_TV_logo.svg.png' },
    { id: 'live_tv_egyptalhayatmosalsalat', name: 'Al Hayah Drama | الحياة دراما', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/AlHayah_TV_logo.svg/320px-AlHayah_TV_logo.svg.png' },
    { id: 'live_tv_egyhayatmas', name: 'Al Hayat TV | الحياة المسيحية', logo: 'https://i.imgur.com/gK998sT.png' },
    { id: 'live_tv_egyptalhurya', name: 'Al Horreya TV | الحرية', logo: 'https://i.imgur.com/gK998sT.png' },
    { id: 'live_tv_alqaherawalnas', name: 'Al Kahera Wal Nas | القاهرة والناس', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/5/5f/Al_Kahera_Wal_Nas_logo.png/320px-Al_Kahera_Wal_Nas_logo.png' },
    { id: 'live_tv_egypttv', name: 'Al Masriyah | الفضائية المصرية', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/2/22/Al_Oula_logo.png/320px-Al_Oula_logo.png' },
    { id: 'live_tv_egyalnahardrama', name: 'Al Nahar Drama | النهار دراما', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/5/52/Al_Nahar_TV_logo.png/320px-Al_Nahar_TV_logo.png' },
    { id: 'live_tv_egyalnahar', name: 'Al Nahar TV | النهار', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/5/52/Al_Nahar_TV_logo.png/320px-Al_Nahar_TV_logo.png' },
    { id: 'live_tv_masrya1', name: 'Al Oula | القناة الأولى المصرية', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/2/22/Al_Oula_logo.png/320px-Al_Oula_logo.png' },
    { id: 'live_tv_egyptalkarma', name: 'Alkarma TV | الكرمة', logo: 'https://i.imgur.com/gK998sT.png' },
    { id: 'live_tv_panel_4311a5eb310846973cdae8a7e09c7ee3', name: 'Alkeraza | الكرازة', logo: 'https://i.imgur.com/gK998sT.png' },
    { id: 'live_tv_panel_92b99085740686b724810cb75e0e7139', name: 'Alqahera News | القاهرة الاخبارية', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/e/ee/Al_Qahera_News_logo.png/320px-Al_Qahera_News_logo.png' },
    { id: 'live_tv_alshareqmasr', name: 'Alsharq | الشرق المصرية', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/b/b5/El_Sharq_TV_logo.png/320px-El_Sharq_TV_logo.png' },
    { id: 'live_tv_egyptbedaya', name: 'Bedaya TV | قناة بداية', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/5/52/Bedaya_TV_logo.png/320px-Bedaya_TV_logo.png' },
    { id: 'live_tv_cbcegydrama', name: 'CBC Drama | سي بي سي دراما', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/9/91/CBC_Egypt_Logo.png/320px-CBC_Egypt_Logo.png' },
    { id: 'live_tv_cbcsofra', name: 'CBC Sofra | سي بي سي سفرة', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/4/4c/CBC_Sofra_Logo.png/320px-CBC_Sofra_Logo.png' },
    { id: 'live_tv_cbcegyextra', name: 'CBC eXtra | سي بي سي إكسترا', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/f/f6/Extra_News_channel_logo.png/320px-Extra_News_channel_logo.png' },
    { id: 'live_tv_cbcegy', name: 'CBC | سي بي سي', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/9/91/CBC_Egypt_Logo.png/320px-CBC_Egypt_Logo.png' },
    { id: 'live_tv_egdmclive', name: 'DMC | دي إم سي', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/DMC_Network_Logo.svg/320px-DMC_Network_Logo.svg.png' },
    { id: 'live_tv_masrya2', name: 'Egyptian TV 2 | المصرية الثانية', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/2/22/Al_Oula_logo.png/320px-Al_Oula_logo.png' },
    { id: 'live_tv_egkojikidz', name: 'Koogi TV | قناة كوجي', logo: 'https://i.imgur.com/QhX3z0x.png' },
    { id: 'live_tv_panel_c6ab30c8f13fb5b6fc3756b08e5afd1a', name: 'MBC Drama Masr | MBC مصر دراما', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/b/b3/MBC_Masr_logo.png/320px-MBC_Masr_logo.png' },
    { id: 'live_tv_mbcmsr', name: 'MBC Masr 1 |  إم بي سي مصر 1', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/b/b3/MBC_Masr_logo.png/320px-MBC_Masr_logo.png' },
    { id: 'live_tv_mbcmasr2', name: 'MBC Masr 2 | MBC مصر 2', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/6/6f/MBC_Masr_2_logo.png/320px-MBC_Masr_2_logo.png' },
    { id: 'live_tv_mazzikaegypt', name: 'Mazzika | مزيكا', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/2/23/Mazzika_logo.png/320px-Mazzika_logo.png' },
    { id: 'live_tv_egyalmehwar', name: 'Mehwar TV | المحور', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/7/7b/El_Mehwar_TV_logo.png/320px-El_Mehwar_TV_logo.png' },
    { id: 'live_tv_mokamelintv', name: 'Mekameleen | مكملين', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/c/cd/Mekameleen_TV_logo.png/320px-Mekameleen_TV_logo.png' },
    { id: 'live_tv_uaemixtv', name: 'Mix TV | ميكس تي في', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/5/53/Mix_TV_logo.png/320px-Mix_TV_logo.png' },
    { id: 'live_tv_egnilecinema', name: 'Nile Cinema | نيل سينما', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/4/4b/Nile_Cinema_logo.png/320px-Nile_Cinema_logo.png' },
    { id: 'live_tv_egyneelnews', name: 'Nile News | النيل أخبار', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/0/07/Nile_News_logo.png/320px-Nile_News_logo.png' },
    { id: 'live_tv_egyondrama', name: 'ON DRAMA |  أون دراما', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/b/b2/ON_TV_logo.png/320px-ON_TV_logo.png' },
    { id: 'live_tv_egyone', name: 'ON E | أون أي', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/b/b2/ON_TV_logo.png/320px-ON_TV_logo.png' },
    { id: 'live_tv_egpncdrama', name: 'PNC Drama | بي إن سي دراما', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/a/ae/PNC_Drama_logo.png/320px-PNC_Drama_logo.png' },
    { id: 'live_tv_egpncfilm', name: 'PNC Film | بي إن سي فيلم', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/a/ae/PNC_Drama_logo.png/320px-PNC_Drama_logo.png' },
    { id: 'live_tv_rotanacomedy', name: 'Rotana Comedy | روتانا كوميدي', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Rotana_Media_Group_logo.svg/320px-Rotana_Media_Group_logo.svg.png' },
    { id: 'live_tv_sadaalbalad2', name: 'Sada El Balad 2 | صدى البلد 2', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/9/91/Sada_El-Balad_logo.png/320px-Sada_El-Balad_logo.png' },
    { id: 'live_tv_sadaalbalad', name: 'Sada El Balad | صدى البلد', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/9/91/Sada_El-Balad_logo.png/320px-Sada_El-Balad_logo.png' },
    { id: 'live_tv_weyyak_mix', name: 'Weyyak Mix | وياك ميكس', logo: 'https://i.imgur.com/gK998sT.png' },
    { id: 'live_tv_egdmcdrama', name: 'dmc Drama | دي إم سي دراما', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/DMC_Network_Logo.svg/320px-DMC_Network_Logo.svg.png' },
    { id: 'live_tv_new_auto_03d46cbe535b0d202e1a395f29d421fa', name: 'Nile Drama | نيل دراما', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/4/4b/Nile_Cinema_logo.png/320px-Nile_Cinema_logo.png' },
    { id: 'live_tv_new_auto_f544a30111f464cf45e14d7cbce1b032', name: 'Rotana Cinema Egypt | روتانا سينما مصر', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Rotana_Media_Group_logo.svg/320px-Rotana_Media_Group_logo.svg.png' },
    { id: 'live_tv_new_auto_e77ceae041e39fbbab0b06bf4eca478f', name: 'Mix Hollywood | ميكس هوليوود', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/5/53/Mix_TV_logo.png/320px-Mix_TV_logo.png' },
    { id: 'live_tv_new_auto_395552dc75a2d0f377f0cbb2b61c334d', name: 'El Radio 9090 FM | راديو 9090', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/2/22/El_Radio_9090_logo.png/320px-El_Radio_9090_logo.png' },
    { id: 'live_tv_new_auto_1c2dab3bf965b8471c0b2f62b99d9109', name: 'NogoumFMTV | نجوم إف إم تي في', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/8/87/Nogoum_FM_logo.png/320px-Nogoum_FM_logo.png' },
    { id: 'live_tv_new_auto_66611d0ca7c2dfc7187664348c562eb0', name: 'Al Ghad TV | قناة الغد', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/0/07/Nile_News_logo.png/320px-Nile_News_logo.png' },
    { id: 'live_tv_new_auto_7619eff8f242e04bd2ed3b9753ef85fe', name: 'Watan TV | قناة وطن', logo: 'https://i.imgur.com/gK998sT.png' },
    { id: 'live_tv_ten', name: 'TeN TV | تن', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/c/c2/TeN_TV_logo.png/320px-TeN_TV_logo.png' },
    { id: 'live_tv_alshams', name: 'Al Shams TV | الشمس', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/2/23/Al_Shams_TV_logo.png/320px-Al_Shams_TV_logo.png' },
    { id: 'live_tv_new_auto_f41fe6146a04bb2c405869d83e22e0b0', name: 'Aghapy TV | أغابي', logo: 'https://i.imgur.com/gK998sT.png' },
    { id: 'live_tv_new_auto_1edc2a578174263fafa70260a6336243', name: 'Coptic TV | سي تي في', logo: 'https://i.imgur.com/gK998sT.png' },
    { id: 'live_tv_new_auto_53e1cd718520aff4aa396608058c49eb', name: 'Cartoon Network Arabic | كرتون نتورك', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Cartoon_Network_2010_logo.svg/320px-Cartoon_Network_2010_logo.svg.png' },
    { id: 'live_tv_new_auto_c282f48a47e870c301d7e44e7e3917a2', name: 'Huda TV | قناة هدى', logo: 'https://i.imgur.com/gK998sT.png' },
    { id: 'live_tv_new_auto_45a6544c78b15400d235e981316098f1', name: 'For You TV | فور يو', logo: 'https://i.imgur.com/gK998sT.png' },
    { id: 'live_tv_new_auto_1cd5e47b88ab8c5afa479c35d222b2e1', name: 'Elbeshara GTV | البشارة', logo: 'https://i.imgur.com/gK998sT.png' },
    { id: 'live_tv_new_auto_fe85b6d5173bf6bd61a9bfd077548881', name: 'MBC 1 Egypt | إم بي سي 1 مصر', logo: 'https://upload.wikimedia.org/wikipedia/ar/thumb/b/b3/MBC_Masr_logo.png/320px-MBC_Masr_logo.png' },
  ];

  return channelDefs.map((def, idx) => ({
    id: `fg-ch-${code}-eg-${def.id}`,
    playlistId,
    categoryId,
    name: def.name,
    groupTitle: 'مصر — Egypt TV',
    section: 'live',
    logo: def.logo,
    fgLiveId: def.id,
    fgCode: code,
    resolution: '1080p FHD',
    bitrate: 'Live 24/7',
    epgCurrent: `بث فضائي مباشر عبر خادم دراما لايف — ${def.name}`,
    sources: buildEgyptSources(
      code,
      def.id,
      def.id === 'live_tv_mbcmsr'
        ? 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-1-na/eec141533c90dd34722c503a296dd0d8/index.m3u8'
        : undefined
    ),
  }));
}
