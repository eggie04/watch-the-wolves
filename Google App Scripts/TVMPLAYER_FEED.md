# TVMplayer Spinoff Feed

This project now exposes a TVM-focused feed from the same Apps Script web app.

## Endpoints

Use your existing web app URL from Apps Script deploy, then append:

- JSON feed: `?mode=tvm&format=json`
- M3U playlist: `?mode=tvm&format=m3u`

Default schedule API is unchanged (no `mode` param).

## Configure Stream Metadata

In Apps Script editor (for this project), run:

```javascript
setTvmFeedConfig_({
  streamUrl: "https://your-cdn/live/channel/index.m3u8",
  title: "Watch The Wolves Live",
  id: "wtw-live-1",
  poster: "https://your-site.com/poster.jpg",
})
```

If you do not set properties, fallback values are used.

## Suggested TVMplayer Test Order

1. Test the direct `.m3u8` URL in TVMplayer first.
2. Test the `?mode=tvm&format=m3u` URL.
3. If TVMplayer supports JSON providers, test `?mode=tvm&format=json`.

## Notes

- This feed is intentionally simple: one live item.
- Expand `getTvmFeedConfig_()` if you want multiple channels/items.
- Keep stream URLs HTTPS for broad device compatibility.
