# Minimal Stremio Addon

This repo now includes a minimal single-channel Stremio addon for stream testing.

## 1) Configure `.env`

Add these values:

```bash
STREMIO_STREAM_URL=https://example.com/live/channel.m3u8
# Optional
# STREMIO_PORT=7010
# STREMIO_PUBLIC_BASE_URL=https://streamio.watchthewolves.com
# STREMIO_ADDON_ID=watchthewolves.test
# STREMIO_ADDON_NAME=Watch The Wolves Test
# STREMIO_ADDON_DESCRIPTION=My custom addon
# STREMIO_ADDON_LOGO=https://your-site.com/addon-logo.png
# STREMIO_ADDON_BACKGROUND=https://your-site.com/addon-background.jpg
# STREMIO_CHANNEL_ID=wtw-live
# STREMIO_CHANNEL_NAME=Watch The Wolves Live
# STREMIO_CHANNEL_POSTER=https://your-site.com/poster.jpg
# STREMIO_CHANNEL_LOGO=https://your-site.com/channel-logo.png
# STREMIO_CHANNEL_BACKGROUND=https://your-site.com/channel-background.jpg
# STREMIO_CHANNEL_DESCRIPTION=Channel description
# STREMIO_CHANNEL_POSTER_SHAPE=poster
```

## Multi-channel mode (recommended)

Use one JSON variable instead of single-channel fields:

```bash
STREMIO_ADDON_NAME=EggTV
STREMIO_ADDON_DESCRIPTION=Your addon summary
STREMIO_ADDON_LOGO=https://your-site.com/addon-logo.png
STREMIO_ADDON_BACKGROUND=https://your-site.com/addon-background.jpg
STREMIO_CHANNELS_JSON=[{"id":"rick-morty","name":"Rick and Morty","streamUrl":"https://adultswim-vodlive.cdn.turner.com/live/rick-and-morty/stream_3.m3u8","poster":"https://upload.wikimedia.org/wikipedia/en/6/6e/Rick_and_Morty_season_7.jpg","logo":"https://your-site.com/rm-logo.png","background":"https://your-site.com/rm-background.jpg","description":"24/7 Rick and Morty stream","posterShape":"poster"}]
```

You can add more channel objects in the same array.

## 2) Start addon

```bash
cmd /c npm run stremio:addon
```

Manifest URL:

`http://127.0.0.1:7010/manifest.json`

## 3) Install in Stremio

Use the manifest URL in Stremio addon install.

If you need to install on another device, expose local port with a tunnel (Cloudflare Tunnel or ngrok) and use the public HTTPS manifest URL.
