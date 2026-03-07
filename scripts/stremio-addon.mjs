import process from "node:process"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
let AddonBuilder = null
let serveHTTP = null

try {
    const stremioAddonSdk = require("stremio-addon-sdk")
    if (typeof stremioAddonSdk?.addonBuilder === "function") {
        AddonBuilder = stremioAddonSdk.addonBuilder
    }
    if (typeof stremioAddonSdk?.serveHTTP === "function") {
        serveHTTP = stremioAddonSdk.serveHTTP
    }
} catch {
    // Fallback handled below.
}

if (typeof AddonBuilder !== "function") {
    try {
        AddonBuilder = require("stremio-addon-sdk/src/builder")
    } catch {
        AddonBuilder = null
    }
}

if (typeof serveHTTP !== "function") {
    try {
        serveHTTP = require("stremio-addon-sdk/src/serveHTTP")
    } catch {
        serveHTTP = null
    }
}

if (typeof AddonBuilder !== "function" || typeof serveHTTP !== "function") {
    console.error("Invalid stremio-addon-sdk exports (addonBuilder/serveHTTP).")
    process.exit(1)
}

const PORT = Number(process.env.STREMIO_PORT || 7010)
const ADDON_ID = String(process.env.STREMIO_ADDON_ID || "watchthewolves.test")
const PUBLIC_BASE_URL = String(process.env.STREMIO_PUBLIC_BASE_URL || "").trim()
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

function normalizeAssetUrl(value) {
    const raw = String(value || "").trim()
    if (!raw) return ""
    if (/^https?:\/\//i.test(raw)) return raw
    if (raw.startsWith("//")) return `https:${raw}`
    if (raw.startsWith("/")) {
        if (!PUBLIC_BASE_URL) return ""
        return `${PUBLIC_BASE_URL.replace(/\/+$/, "")}${raw}`
    }
    return ""
}

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
    logo: normalizeAssetUrl(ADDON_LOGO) || undefined,
    background: normalizeAssetUrl(ADDON_BACKGROUND) || undefined,
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
            poster: normalizeAssetUrl(item.poster) || undefined,
            posterShape: item.posterShape || undefined,
            logo: normalizeAssetUrl(item.logo) || undefined,
            background: normalizeAssetUrl(item.background) || undefined,
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
            poster: normalizeAssetUrl(channel.poster) || undefined,
            posterShape: channel.posterShape || undefined,
            logo: normalizeAssetUrl(channel.logo) || undefined,
            background: normalizeAssetUrl(channel.background) || undefined,
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
