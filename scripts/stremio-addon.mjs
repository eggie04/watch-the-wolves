import process from "node:process"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const stremioAddonSdk = require("stremio-addon-sdk")
const AddonBuilder = stremioAddonSdk?.addonBuilder
const serveHTTP = stremioAddonSdk?.serveHTTP

if (typeof AddonBuilder !== "function" || typeof serveHTTP !== "function") {
    console.error("Invalid stremio-addon-sdk exports (addonBuilder/serveHTTP).")
    process.exit(1)
}

const PORT = Number(process.env.STREMIO_PORT || 7010)
const ADDON_ID = String(process.env.STREMIO_ADDON_ID || "watchthewolves.test")
const ADDON_NAME = String(
    process.env.STREMIO_ADDON_NAME || "Watch The Wolves Test"
).trim()
const ADDON_DESCRIPTION = String(
    process.env.STREMIO_ADDON_DESCRIPTION ||
        "Minimal multi-channel addon for stream testing."
).trim()
const ADDON_LOGO = String(process.env.STREMIO_ADDON_LOGO || "").trim()
const ADDON_BACKGROUND = String(process.env.STREMIO_ADDON_BACKGROUND || "").trim()
const CATALOG_ID = String(process.env.STREMIO_CATALOG_ID || "eggtv-catalog").trim()
const CATALOG_NAME = String(process.env.STREMIO_CATALOG_NAME || "EggTV Live").trim()
const CHANNELS_JSON = String(process.env.STREMIO_CHANNELS_JSON || "").trim()
const DEFAULT_CHANNEL_LOGO = String(process.env.STREMIO_CHANNEL_LOGO || "").trim()
const DEFAULT_CHANNEL_BACKGROUND = String(
    process.env.STREMIO_CHANNEL_BACKGROUND || ""
).trim()
const DEFAULT_CHANNEL_DESCRIPTION = String(
    process.env.STREMIO_CHANNEL_DESCRIPTION || ""
).trim()
const DEFAULT_CHANNEL_POSTER_SHAPE = String(
    process.env.STREMIO_CHANNEL_POSTER_SHAPE || ""
).trim()

function parseChannels() {
    if (CHANNELS_JSON) {
        try {
            const parsed = JSON.parse(CHANNELS_JSON)
            if (!Array.isArray(parsed)) {
                throw new Error("STREMIO_CHANNELS_JSON must be a JSON array")
            }
            const channels = parsed
                .map((item) => ({
                    id: String(item?.id || "").trim(),
                    name: String(item?.name || "").trim(),
                    streamUrl: String(item?.streamUrl || item?.url || "").trim(),
                    poster: String(item?.poster || "").trim(),
                    logo:
                        String(item?.logo || "").trim() || DEFAULT_CHANNEL_LOGO,
                    background:
                        String(item?.background || "").trim() ||
                        DEFAULT_CHANNEL_BACKGROUND,
                    description:
                        String(item?.description || "").trim() ||
                        DEFAULT_CHANNEL_DESCRIPTION,
                    posterShape:
                        String(item?.posterShape || "").trim() ||
                        DEFAULT_CHANNEL_POSTER_SHAPE,
                }))
                .filter((item) => item.id && item.name && item.streamUrl)

            if (channels.length === 0) {
                throw new Error(
                    "STREMIO_CHANNELS_JSON has no valid channels (need id, name, streamUrl)"
                )
            }

            return channels
        } catch (error) {
            console.error("Invalid STREMIO_CHANNELS_JSON:", error.message)
            process.exit(1)
        }
    }

    // Backward-compatible single-channel fallback.
    const streamUrl = String(process.env.STREMIO_STREAM_URL || "").trim()
    const channelId = String(process.env.STREMIO_CHANNEL_ID || "wtw-live").trim()
    const channelName = String(
        process.env.STREMIO_CHANNEL_NAME || "Watch The Wolves Live"
    ).trim()
    const channelPoster = String(process.env.STREMIO_CHANNEL_POSTER || "").trim()

    if (!streamUrl) {
        console.error(
            "Missing STREMIO_STREAM_URL (or STREMIO_CHANNELS_JSON) in .env."
        )
        process.exit(1)
    }

    return [
        {
            id: channelId,
            name: channelName,
            streamUrl,
            poster: channelPoster,
            logo: DEFAULT_CHANNEL_LOGO,
            background: DEFAULT_CHANNEL_BACKGROUND,
            description: DEFAULT_CHANNEL_DESCRIPTION,
            posterShape: DEFAULT_CHANNEL_POSTER_SHAPE,
        },
    ]
}

const channels = parseChannels()
const channelsById = new Map(channels.map((item) => [item.id, item]))

const manifest = {
    id: ADDON_ID,
    version: "0.0.1",
    name: ADDON_NAME,
    description: ADDON_DESCRIPTION,
    logo: ADDON_LOGO || undefined,
    background: ADDON_BACKGROUND || undefined,
    types: ["tv"],
    resources: ["catalog", "meta", "stream"],
    catalogs: [
        {
            type: "tv",
            id: CATALOG_ID,
            name: CATALOG_NAME,
        },
    ],
    idPrefixes: channels.map((item) => item.id),
}

const builder = new AddonBuilder(manifest)

builder.defineCatalogHandler(({ type, id }) => {
    if (type !== "tv" || id !== CATALOG_ID) return Promise.resolve({ metas: [] })

    return Promise.resolve({
        metas: channels.map((item) => ({
            id: item.id,
            type: "tv",
            name: item.name,
            poster: item.poster || undefined,
            posterShape: item.posterShape || undefined,
            logo: item.logo || undefined,
            background: item.background || undefined,
            description: item.description || undefined,
        })),
    })
})

builder.defineMetaHandler(({ type, id }) => {
    const channel = channelsById.get(String(id || ""))
    if (type !== "tv" || !channel) return Promise.resolve({ meta: null })

    return Promise.resolve({
        meta: {
            id: channel.id,
            type: "tv",
            name: channel.name,
            poster: channel.poster || undefined,
            posterShape: channel.posterShape || undefined,
            logo: channel.logo || undefined,
            background: channel.background || undefined,
            description: channel.description || undefined,
        },
    })
})

builder.defineStreamHandler(({ type, id }) => {
    const channel = channelsById.get(String(id || ""))
    if (type !== "tv" || !channel) return Promise.resolve({ streams: [] })

    const looksLikeHls = /\.m3u8(\?|$)/i.test(channel.streamUrl)

    return Promise.resolve({
        streams: [
            {
                name: "Primary",
                title: channel.name,
                url: channel.streamUrl,
                behaviorHints: looksLikeHls ? { notWebReady: true } : undefined,
            },
        ],
    })
})

serveHTTP(builder.getInterface(), { port: PORT, static: "assets/stremio" })
console.log(`Stremio addon running on http://127.0.0.1:${PORT}/manifest.json`)
console.log(`Addon name: ${ADDON_NAME}`)
console.log(`Channels: ${channels.length}`)
channels.forEach((item, index) => {
    console.log(`  ${index + 1}. ${item.name} (${item.id})`)
})
