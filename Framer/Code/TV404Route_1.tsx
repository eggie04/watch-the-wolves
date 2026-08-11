import { useLayoutEffect } from "react"
import type { Override } from "framer"

const TV_ROUTE = "/tv"
const SECRET_LOOP_ROUTE = "/jerry70"
const OVERLAY_ID = "tv-route-overlay"
const BUILD_TAG = "TV UI v13"
const DEFAULT_CHANNEL_ID = "rick-morty"
const STREAM_HEALTHCHECK_TIMEOUT_MS = 3200
const PLAYBACK_READY_TIMEOUT_MS = 4500
const PLAYBACK_START_TIMEOUT_MS = 10000
const SECRET_LOOP_VIDEO_URL =
    "https://video.watchthewolves.com/jerry70.mp4"
const NBA_TV_POSTER =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 900'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0' x2='0' y1='0' y2='1'%3E%3Cstop offset='0' stop-color='%230b1220'/%3E%3Cstop offset='1' stop-color='%2302030a'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='600' height='900' fill='url(%23bg)'/%3E%3Crect x='55' y='80' width='490' height='740' rx='36' fill='%230a0f1e' stroke='%23243a63' stroke-width='6'/%3E%3Crect x='80' y='120' width='220' height='440' rx='20' fill='%23cf123f'/%3E%3Crect x='300' y='120' width='220' height='440' rx='20' fill='%231d4ed8'/%3E%3Crect x='88' y='128' width='204' height='424' rx='16' fill='none' stroke='%23ffffff' stroke-opacity='.35' stroke-width='4'/%3E%3Crect x='308' y='128' width='204' height='424' rx='16' fill='none' stroke='%23ffffff' stroke-opacity='.35' stroke-width='4'/%3E%3Ctext x='300' y='660' fill='%23ffffff' font-family='Arial,sans-serif' font-size='94' font-weight='700' text-anchor='middle'%3ENBA%3C/text%3E%3Ctext x='300' y='748' fill='%2393c5fd' font-family='Arial,sans-serif' font-size='94' font-weight='700' text-anchor='middle'%3ETV%3C/text%3E%3C/svg%3E"
const STREMIO_CATALOG_URL =
    "https://streamio.watchthewolves.com/catalog/tv/eggtv-catalog.json"

type Channel = {
    id: string
    name: string
    streamUrl: string
    streamUrls?: string[]
    poster?: string
    description?: string
}

const CHANNELS: Channel[] = [
    {
        id: "wolves-live",
        name: "Wolves Live",
        streamUrl: "https://video.watchthewolves.com/wolves-live/index.m3u8",
        poster: "https://streamio.watchthewolves.com/assets/stremio/eggtv.png",
        description: "Watch The Wolves live stream.",
    },
    {
        id: "rick-morty",
        name: "Rick and Morty",
        streamUrl:
            "https://adultswim-vodlive.cdn.turner.com/live/rick-and-morty/stream.m3u8",
        poster: "https://image.tmdb.org/t/p/original/WGRQ8FpjkDTzivQJ43t94bOuY0.jpg",
        description: "24/7 Rick and Morty stream.",
    },
    {
        id: "nbc-hd",
        name: "NBC HD",
        streamUrl:
            "https://nbculocallive.akamaized.net/hls/live/2037084/losangeles/stream1/master.m3u8",
        streamUrls: [
            "https://nbculocallive.akamaized.net/hls/live/2037084/losangeles/stream1/master.m3u8",
            "https://nbculocallive.akamaized.net/hls/live/2037098/sandiego/stream1/master.m3u8",
            "https://nbculocallive.akamaized.net/hls/live/2037096/lx/use1.m3u8",
            "https://dn7vkzd5khpp3.cloudfront.net/master.m3u8",
            "https://tvpass.org/live/nbc-knbc-los-angeles-ca/hd",
            "https://tvpass.org/live/nbc-knbc-los-angeles-ca/sd",
        ],
        poster: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/NBC_logo.svg/512px-NBC_logo.svg.png",
        description: "NBC local live stream in HD.",
    },
    {
        id: "nba-tv",
        name: "NBA TV",
        streamUrl:
            "https://amg00556-amg00556c3-firetv-us-6060.playouts.now.amagi.tv/playlist.m3u8",
        streamUrls: [
            "https://amg00556-amg00556c3-firetv-us-6060.playouts.now.amagi.tv/playlist.m3u8",
            "https://pb-5pdyic0cu7tri.akamaized.net/NBA.m3u8",
            "https://tvpass.org/live/NBATV/hd",
            "https://tvpass.org/live/NBATV/sd",
        ],
        poster: NBA_TV_POSTER,
        description: "NBA TV live feed.",
    },
]

const HLS_SCRIPT_URLS = [
    "https://cdn.jsdelivr.net/npm/hls.js@latest",
    "https://unpkg.com/hls.js@latest",
]

let hlsScriptPromise: Promise<void> | null = null
let activeHls: any = null
const PREHIDE_STYLE_ID = "tv-route-prehide-style"

function getCurrentPath() {
    if (typeof window === "undefined") return "/"
    return window.location.pathname.replace(/\/+$/, "") || "/"
}

function installPrehideIfNeeded() {
    if (typeof window === "undefined" || typeof document === "undefined") return
    const path = getCurrentPath()
    if (path !== TV_ROUTE && path !== SECRET_LOOP_ROUTE) return
    if (document.getElementById(PREHIDE_STYLE_ID)) return

    const style = document.createElement("style")
    style.id = PREHIDE_STYLE_ID
    style.textContent = `
html, body { background: #000 !important; }
body { opacity: 0 !important; transition: opacity 120ms linear; }
`
    document.head.appendChild(style)
}

function clearPrehide() {
    if (typeof document === "undefined") return
    const style = document.getElementById(PREHIDE_STYLE_ID)
    if (style) style.remove()
    document.documentElement.classList.remove("tv-prehide")
    document.documentElement.classList.add("tv-prehide-ready")
    document.body.style.opacity = "1"
}

installPrehideIfNeeded()

function renderSecretLoopRoute() {
    const body = document.body
    const oldOverflow = body.style.overflow
    body.style.overflow = "hidden"
    clearPrehide()

    const existing = document.getElementById(OVERLAY_ID) as HTMLDivElement | null
    if (existing) {
        return () => {
            body.style.overflow = oldOverflow
        }
    }

    const overlay = document.createElement("div")
    overlay.id = OVERLAY_ID
    overlay.style.position = "fixed"
    overlay.style.inset = "0"
    overlay.style.background = "black"
    overlay.style.zIndex = "2147483647"
    overlay.style.margin = "0"
    overlay.style.overflow = "hidden"
    overlay.style.display = "flex"
    overlay.style.alignItems = "center"
    overlay.style.justifyContent = "center"

    const video = document.createElement("video")
    video.autoplay = true
    video.loop = true
    video.muted = true
    video.controls = true
    video.playsInline = true
    video.preload = "auto"
    video.src = SECRET_LOOP_VIDEO_URL
    video.setAttribute("playsinline", "")
    video.setAttribute("webkit-playsinline", "")
    video.style.width = "100vw"
    video.style.height = "100vh"
    video.style.objectFit = "contain"
    overlay.appendChild(video)

    const soundButton = document.createElement("button")
    soundButton.type = "button"
    soundButton.textContent = "Tap for sound"
    soundButton.style.position = "fixed"
    soundButton.style.left = "50%"
    soundButton.style.bottom = "28px"
    soundButton.style.transform = "translateX(-50%)"
    soundButton.style.padding = "10px 14px"
    soundButton.style.border = "1px solid rgba(255,255,255,0.22)"
    soundButton.style.borderRadius = "999px"
    soundButton.style.background = "rgba(15,23,42,0.78)"
    soundButton.style.color = "white"
    soundButton.style.fontSize = "14px"
    soundButton.style.cursor = "pointer"
    soundButton.style.backdropFilter = "blur(8px)"
    overlay.appendChild(soundButton)

    const directLink = document.createElement("a")
    directLink.href = SECRET_LOOP_VIDEO_URL
    directLink.textContent = "Open video directly"
    directLink.style.position = "fixed"
    directLink.style.right = "18px"
    directLink.style.bottom = "18px"
    directLink.style.color = "#cbd5e1"
    directLink.style.fontSize = "12px"
    directLink.style.textDecoration = "underline"
    overlay.appendChild(directLink)

    const playVideo = async () => {
        try {
            await video.play()
        } catch {
            // Ignore autoplay blocks; controls remain available.
        }
    }

    const enableSound = async () => {
        video.muted = false
        soundButton.remove()
        await playVideo()
    }

    soundButton.addEventListener("click", () => {
        void enableSound()
    })
    video.addEventListener("click", () => {
        if (!video.muted) return
        void enableSound()
    })
    video.addEventListener("error", () => {
        soundButton.textContent = "Video unavailable"
    })

    body.appendChild(overlay)
    void playVideo()

    return () => {
        const currentPath = getCurrentPath()
        if (currentPath !== SECRET_LOOP_ROUTE) {
            video.pause()
            overlay.remove()
        }
        body.style.overflow = oldOverflow
    }
}

function loadHlsScript(): Promise<void> {
    if ((window as any).Hls) return Promise.resolve()
    if (hlsScriptPromise) return hlsScriptPromise

    hlsScriptPromise = new Promise((resolve, reject) => {
        let index = 0
        const tryNext = () => {
            if (index >= HLS_SCRIPT_URLS.length) {
                reject(new Error("Failed to load hls.js from CDN"))
                return
            }

            const script = document.createElement("script")
            script.src = HLS_SCRIPT_URLS[index++]
            script.async = true
            script.onload = () => resolve()
            script.onerror = () => tryNext()
            document.head.appendChild(script)
        }

        tryNext()
    })

    return hlsScriptPromise
}

function canUseNativeHls(video: HTMLVideoElement) {
    return Boolean(video.canPlayType("application/vnd.apple.mpegurl"))
}

function teardownStream(video: HTMLVideoElement) {
    if (activeHls && typeof activeHls.destroy === "function") {
        activeHls.destroy()
    }
    activeHls = null
    video.pause()
    video.removeAttribute("src")
    video.load()
}

function tryNativePlayback(
    video: HTMLVideoElement,
    streamUrl: string
): Promise<boolean> {
    return new Promise((resolve) => {
        let settled = false
        const finish = (ok: boolean) => {
            if (settled) return
            settled = true
            video.removeEventListener("loadedmetadata", onReady)
            video.removeEventListener("error", onError)
            resolve(ok)
        }

        const onReady = () => finish(true)
        const onError = () => finish(false)

        video.addEventListener("loadedmetadata", onReady, { once: true })
        video.addEventListener("error", onError, { once: true })
        video.src = streamUrl

        setTimeout(() => finish(false), 3500)
    })
}

async function attachStream(video: HTMLVideoElement, streamUrl: string) {
    teardownStream(video)

    if (canUseNativeHls(video)) {
        const nativeOk = await tryNativePlayback(video, streamUrl)
        if (nativeOk) return
    }

    await loadHlsScript()
    const Hls = (window as any).Hls
    if (!Hls || !Hls.isSupported()) {
        video.src = streamUrl
        return
    }

    const hls = new Hls({ lowLatencyMode: true })
    hls.loadSource(streamUrl)
    hls.attachMedia(video)
    activeHls = hls
}

async function safePlay(video: HTMLVideoElement) {
    try {
        await video.play()
        return true
    } catch {
        return false
    }
}

async function waitForPlaybackReady(video: HTMLVideoElement) {
    if (video.readyState >= 2) return true
    return new Promise<boolean>((resolve) => {
        let settled = false
        const finish = (ok: boolean) => {
            if (settled) return
            settled = true
            video.removeEventListener("loadedmetadata", onReady)
            video.removeEventListener("canplay", onReady)
            video.removeEventListener("error", onError)
            resolve(ok)
        }
        const onReady = () => finish(true)
        const onError = () => finish(false)

        video.addEventListener("loadedmetadata", onReady, { once: true })
        video.addEventListener("canplay", onReady, { once: true })
        video.addEventListener("error", onError, { once: true })
        setTimeout(
            () => finish(video.readyState >= 2),
            PLAYBACK_READY_TIMEOUT_MS
        )
    })
}

async function playWithRetries(
    video: HTMLVideoElement,
    attempts = 3,
    retryDelayMs = 180
) {
    for (let index = 0; index < attempts; index++) {
        const started = await safePlay(video)
        if (started) return true
        if (index < attempts - 1) {
            await new Promise((resolve) => {
                setTimeout(resolve, retryDelayMs)
            })
        }
    }
    return false
}

async function waitForPlaybackStarted(video: HTMLVideoElement) {
    if (!video.paused && video.currentTime > 0) return true
    return new Promise<boolean>((resolve) => {
        let settled = false
        const finish = (ok: boolean) => {
            if (settled) return
            settled = true
            video.removeEventListener("playing", onPlaying)
            video.removeEventListener("timeupdate", onTimeUpdate)
            video.removeEventListener("error", onError)
            resolve(ok)
        }
        const onPlaying = () => finish(true)
        const onTimeUpdate = () => finish(true)
        const onError = () => finish(false)

        video.addEventListener("playing", onPlaying, { once: true })
        video.addEventListener("timeupdate", onTimeUpdate, { once: true })
        video.addEventListener("error", onError, { once: true })
        setTimeout(
            () => finish(!video.paused && video.currentTime > 0),
            PLAYBACK_START_TIMEOUT_MS
        )
    })
}

function withCacheBust(streamUrl: string) {
    if (!streamUrl.includes("tvpass.org/live/")) return streamUrl
    const separator = streamUrl.includes("?") ? "&" : "?"
    return `${streamUrl}${separator}cb=${Date.now()}`
}

async function startPlaybackForDevice(
    video: HTMLVideoElement,
    preferSound: boolean,
    mobileDevice: boolean
) {
    await waitForPlaybackReady(video)
    video.muted = true

    const started = await playWithRetries(video, 4, 300)
    if (!started) return false
    const playbackStarted = await waitForPlaybackStarted(video)
    if (!playbackStarted) return false

    if (preferSound && !mobileDevice) {
        video.muted = false
        const soundStarted = await safePlay(video)
        if (!soundStarted) {
            video.muted = true
        }
    }

    return true
}

function isTouchDevice() {
    return (
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia("(pointer: coarse)").matches
    )
}

async function getCatalogMetadata() {
    try {
        const response = await fetch(STREMIO_CATALOG_URL, {
            method: "GET",
            mode: "cors",
        })
        if (!response.ok) return new Map()
        const json = await response.json()
        const metas = Array.isArray(json?.metas) ? json.metas : []
        const map = new Map<string, { poster?: string; description?: string }>()
        metas.forEach((meta: any) => {
            const id = String(meta?.id || "").trim()
            if (!id) return
            map.set(id, {
                poster: String(meta?.poster || "").trim() || undefined,
                description: String(meta?.description || "").trim() || undefined,
            })
        })
        return map
    } catch {
        return new Map()
    }
}

function getChannelById(channelId: string | null) {
    if (!channelId) return null
    return CHANNELS.find((item) => item.id === channelId) || null
}

function getSelectedChannel() {
    const params = new URLSearchParams(window.location.search)
    const ch = params.get("ch")
    return (
        getChannelById(ch) ||
        CHANNELS.find((item) => item.id === DEFAULT_CHANNEL_ID) ||
        CHANNELS[0]
    )
}

function setSelectedChannel(channelId: string) {
    const url = new URL(window.location.href)
    url.searchParams.set("ch", channelId)
    window.history.replaceState({}, "", url.toString())
}

async function canLoadStreamManifest(streamUrl: string) {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => {
        controller.abort()
    }, STREAM_HEALTHCHECK_TIMEOUT_MS)
    try {
        const response = await fetch(streamUrl, {
            method: "GET",
            mode: "cors",
            cache: "no-store",
            signal: controller.signal,
        })
        return response.ok
    } catch {
        return false
    } finally {
        window.clearTimeout(timeoutId)
    }
}

function getChannelStreamCandidates(channel: Channel) {
    const raw = [channel.streamUrl, ...(channel.streamUrls || [])]
    const unique = new Set<string>()
    raw.forEach((url) => {
        const trimmed = String(url || "").trim()
        if (!trimmed) return
        unique.add(trimmed)
    })
    return Array.from(unique)
}

export const TV404Route: Override = () => {
    useLayoutEffect(() => {
        const path = getCurrentPath()
        if (path === SECRET_LOOP_ROUTE) {
            return renderSecretLoopRoute()
        }
        if (path !== TV_ROUTE) return

        const body = document.body
        const oldOverflow = body.style.overflow
        body.style.overflow = "hidden"
        clearPrehide()

        const existing = document.getElementById(OVERLAY_ID) as
            | HTMLDivElement
            | null
        if (existing) {
            return () => {
                body.style.overflow = oldOverflow
            }
        }

        const overlay = document.createElement("div")
        overlay.id = OVERLAY_ID
        overlay.style.position = "fixed"
        overlay.style.inset = "0"
        overlay.style.background = "black"
        overlay.style.zIndex = "2147483647"
        overlay.style.margin = "0"
        overlay.style.overflow = "hidden"
        overlay.style.fontFamily = "sans-serif"

        const video = document.createElement("video")
        video.id = "player"
        video.controls = !isTouchDevice()
        video.autoplay = false
        video.muted = true
        video.playsInline = true
        video.setAttribute("playsinline", "")
        video.setAttribute("webkit-playsinline", "")
        video.preload = "auto"
        video.style.width = "100vw"
        video.style.height = "100vh"
        video.style.objectFit = "contain"
        overlay.appendChild(video)
        body.appendChild(overlay)
        let selectedChannel = getSelectedChannel()

        const buildTag = document.createElement("div")
        buildTag.textContent = BUILD_TAG
        buildTag.style.position = "fixed"
        buildTag.style.right = "16px"
        buildTag.style.top = "16px"
        buildTag.style.padding = "8px 10px"
        buildTag.style.borderRadius = "8px"
        buildTag.style.background = "rgba(17,24,39,0.85)"
        buildTag.style.border = "1px solid #374151"
        buildTag.style.color = "#d1d5db"
        buildTag.style.fontSize = "12px"
        buildTag.style.zIndex = "2147483647"
        overlay.appendChild(buildTag)

        const picker = document.createElement("div")
        picker.style.position = "fixed"
        picker.style.inset = "0"
        picker.style.display = "flex"
        picker.style.flexDirection = "column"
        picker.style.justifyContent = "flex-start"
        picker.style.alignItems = "center"
        picker.style.padding =
            "max(18px, env(safe-area-inset-top)) 16px max(18px, env(safe-area-inset-bottom))"
        picker.style.background =
            "radial-gradient(circle at 20% 20%, rgba(37,99,235,0.25), rgba(0,0,0,0.92) 42%)"
        picker.style.zIndex = "2147483647"
        picker.style.overflowY = "auto"
        overlay.appendChild(picker)

        const pickerTitle = document.createElement("div")
        pickerTitle.textContent = "Choose a channel"
        pickerTitle.style.color = "white"
        pickerTitle.style.fontSize = "clamp(24px, 4vw, 40px)"
        pickerTitle.style.fontWeight = "700"
        pickerTitle.style.marginTop = "max(26px, env(safe-area-inset-top))"
        pickerTitle.style.marginBottom = "16px"
        pickerTitle.style.textAlign = "center"
        picker.appendChild(pickerTitle)

        const pickerGrid = document.createElement("div")
        pickerGrid.style.display = "grid"
        pickerGrid.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))"
        pickerGrid.style.gap = "18px"
        pickerGrid.style.width = "min(900px, 100vw - 32px)"
        pickerGrid.style.justifyContent = "center"
        pickerGrid.style.paddingBottom = "20px"
        picker.appendChild(pickerGrid)

        const channelSwitchBar = document.createElement("div")
        channelSwitchBar.style.position = "fixed"
        channelSwitchBar.style.top = "50%"
        channelSwitchBar.style.left = "max(10px, env(safe-area-inset-left))"
        channelSwitchBar.style.transform = "translateY(-50%)"
        channelSwitchBar.style.display = "none"
        channelSwitchBar.style.flexDirection = "column"
        channelSwitchBar.style.alignItems = "stretch"
        channelSwitchBar.style.gap = "10px"
        channelSwitchBar.style.maxWidth = "min(46vw, 250px)"
        channelSwitchBar.style.maxHeight = "72vh"
        channelSwitchBar.style.overflowY = "auto"
        channelSwitchBar.style.padding = "8px"
        channelSwitchBar.style.borderRadius = "12px"
        channelSwitchBar.style.background = "rgba(2,6,23,0.74)"
        channelSwitchBar.style.backdropFilter = "blur(8px)"
        channelSwitchBar.style.opacity = "0"
        channelSwitchBar.style.pointerEvents = "none"
        channelSwitchBar.style.transition = "opacity 180ms ease"
        channelSwitchBar.style.zIndex = "2147483647"
        overlay.appendChild(channelSwitchBar)
        let isPlaybackMode = false
        let guideVisible = false
        let hideGuideTimer: ReturnType<typeof setTimeout> | null = null

        const clearGuideTimer = () => {
            if (hideGuideTimer) {
                clearTimeout(hideGuideTimer)
                hideGuideTimer = null
            }
        }

        const hideGuide = () => {
            guideVisible = false
            channelSwitchBar.style.opacity = "0"
            channelSwitchBar.style.pointerEvents = "none"
        }

        const showGuide = () => {
            if (!isPlaybackMode) return
            guideVisible = true
            channelSwitchBar.style.opacity = "1"
            channelSwitchBar.style.pointerEvents = "auto"
        }

        const scheduleGuideHide = (delayMs = 3000) => {
            clearGuideTimer()
            hideGuideTimer = setTimeout(() => {
                hideGuide()
            }, delayMs)
        }

        const applyResponsiveLayout = () => {
            const mobile = window.innerWidth <= 760
            const narrow = window.innerWidth <= 359
            pickerGrid.style.gridTemplateColumns = mobile
                ? narrow
                    ? "minmax(0, 1fr)"
                    : "repeat(2, minmax(0, 1fr))"
                : "repeat(auto-fit, minmax(220px, 240px))"
            pickerGrid.style.gap = mobile ? "12px" : "18px"
            pickerTitle.style.marginBottom = mobile ? "12px" : "16px"
            Array.from(pickerGrid.children).forEach((node) => {
                const button = node as HTMLButtonElement
                const poster = button.querySelector(
                    "[data-role='poster']"
                ) as HTMLDivElement | null
                const desc = button.querySelector(
                    "[data-role='desc']"
                ) as HTMLDivElement | null
                if (poster) {
                    poster.style.aspectRatio = mobile ? "3 / 4" : "2 / 3"
                }
                if (desc) {
                    desc.style.display = mobile ? "none" : "block"
                }
            })
        }

        const showError = () => {
            const message = document.createElement("div")
            message.style.color = "white"
            message.style.padding = "24px"
            message.style.display = "flex"
            message.style.flexDirection = "column"
            message.style.gap = "10px"

            const text = document.createElement("div")
            text.textContent =
                "Unable to load embedded stream. Try opening stream directly."
            message.appendChild(text)

            const directLink = document.createElement("a")
            directLink.href = selectedChannel.streamUrl
            directLink.textContent = "Open Direct Stream"
            directLink.style.color = "#7dd3fc"
            directLink.style.textDecoration = "underline"
            message.appendChild(directLink)
            overlay.appendChild(message)
        }
        let guideChannels: Channel[] = CHANNELS

        const pickFallbackChannel = async (
            attemptedIds: Set<string>
        ): Promise<Channel | null> => {
            for (const channel of guideChannels) {
                if (attemptedIds.has(channel.id)) continue
                const available = await canLoadStreamManifest(channel.streamUrl)
                if (available) return channel
            }
            return (
                guideChannels.find((channel) => !attemptedIds.has(channel.id)) ||
                null
            )
        }

        const startStream = async (
            channel: Channel,
            preferSound: boolean,
            attemptedIds = new Set<string>()
        ) => {
            attemptedIds.add(channel.id)
            try {
                selectedChannel = channel
                setSelectedChannel(channel.id)
                renderGuideButtons(guideChannels)
                const mobileDevice = isTouchDevice()
                const streamCandidates = getChannelStreamCandidates(channel)
                let started = false
                let lastError: unknown = null
                for (const streamUrl of streamCandidates) {
                    try {
                        const attemptUrl = withCacheBust(streamUrl)
                        await attachStream(video, attemptUrl)
                        started = await startPlaybackForDevice(
                            video,
                            preferSound,
                            mobileDevice
                        )
                        if (!started) continue
                        break
                    } catch (error) {
                        lastError = error
                    }
                }
                if (!started) {
                    throw lastError || new Error("No playable stream candidate")
                }
                picker.style.display = "none"
                channelSwitchBar.style.display = "flex"
                video.controls = true
                isPlaybackMode = true
                showGuide()
                scheduleGuideHide(2200)
            } catch (error) {
                console.error(error)
                const fallbackChannel = await pickFallbackChannel(attemptedIds)
                if (fallbackChannel) {
                    return startStream(fallbackChannel, false, attemptedIds)
                }
                showError()
            }
        }

        const renderPickerCards = (channels: Channel[]) => {
            pickerGrid.innerHTML = ""
            channels.forEach((channel) => {
                const button = document.createElement("button")
                button.type = "button"
                button.textContent = ""
                button.style.border = "1px solid #334155"
                button.style.borderRadius = "14px"
                button.style.background = "rgba(15,23,42,0.92)"
                button.style.color = "white"
                button.style.cursor = "pointer"
                button.style.overflow = "hidden"
                button.style.padding = "0"
                button.style.textAlign = "left"
                button.style.display = "flex"
                button.style.flexDirection = "column"
                button.style.minHeight = "100%"

                const poster = document.createElement("div")
                poster.dataset.role = "poster"
                poster.style.width = "100%"
                poster.style.aspectRatio = "2 / 3"
                poster.style.backgroundColor = "#0b1220"
                if (channel.poster) {
                    poster.style.backgroundImage = `url("${channel.poster}")`
                    poster.style.backgroundSize = "cover"
                    poster.style.backgroundPosition = "center"
                }

                const content = document.createElement("div")
                content.style.padding = "12px"
                content.style.display = "flex"
                content.style.flexDirection = "column"
                content.style.gap = "6px"

                const title = document.createElement("div")
                title.textContent = channel.name
                title.style.fontSize = "clamp(16px, 2vw, 20px)"
                title.style.fontWeight = "700"

                const description = document.createElement("div")
                description.dataset.role = "desc"
                description.textContent =
                    channel.description || "Select channel to watch."
                description.style.fontSize = "13px"
                description.style.lineHeight = "1.35"
                description.style.color = "#cbd5e1"

                content.appendChild(title)
                content.appendChild(description)
                button.appendChild(poster)
                button.appendChild(content)

                button.addEventListener("click", async () => {
                    await startStream(channel, true)
                })
                pickerGrid.appendChild(button)
            })
            applyResponsiveLayout()
        }

        const renderGuideButtons = (channels: Channel[]) => {
            channelSwitchBar.innerHTML = ""
            channels.forEach((channel) => {
                const switchButton = document.createElement("button")
                switchButton.type = "button"
                switchButton.style.padding = "0"
                switchButton.style.border = "1px solid #334155"
                switchButton.style.borderRadius = "10px"
                switchButton.style.background = "rgba(15,23,42,0.94)"
                switchButton.style.color = "white"
                switchButton.style.cursor = "pointer"
                switchButton.style.display = "flex"
                switchButton.style.flexDirection = "column"
                switchButton.style.overflow = "hidden"
                switchButton.style.position = "relative"
                switchButton.style.textAlign = "left"
                switchButton.style.boxShadow = "inset 0 -2px 0 #e11d48"
                const isActive = selectedChannel.id === channel.id
                if (isActive) {
                    switchButton.style.borderColor = "#93c5fd"
                    switchButton.style.boxShadow = "inset 0 -2px 0 #3b82f6"
                }

                const row = document.createElement("div")
                row.style.display = "grid"
                row.style.gridTemplateColumns = "54px 1fr"
                row.style.gap = "8px"
                row.style.padding = "10px 10px 12px"

                const thumb = document.createElement("div")
                thumb.style.width = "54px"
                thumb.style.height = "54px"
                thumb.style.borderRadius = "8px"
                thumb.style.background = "#0b1220"
                thumb.style.backgroundSize = "cover"
                thumb.style.backgroundPosition = "center"
                if (channel.poster) {
                    thumb.style.backgroundImage = `url("${channel.poster}")`
                }

                const textWrap = document.createElement("div")
                textWrap.style.display = "flex"
                textWrap.style.flexDirection = "column"
                textWrap.style.justifyContent = "center"
                textWrap.style.gap = "2px"

                const title = document.createElement("div")
                title.textContent = channel.name
                title.style.fontSize = "14px"
                title.style.fontWeight = "700"
                title.style.lineHeight = "1.2"

                const subtitle = document.createElement("div")
                subtitle.textContent = isActive ? "Now Playing" : "Available"
                subtitle.style.fontSize = "11px"
                subtitle.style.color = isActive ? "#93c5fd" : "#94a3b8"

                textWrap.appendChild(title)
                textWrap.appendChild(subtitle)
                row.appendChild(thumb)
                row.appendChild(textWrap)
                switchButton.appendChild(row)

                switchButton.addEventListener("click", async () => {
                    await startStream(channel, true)
                    showGuide()
                    scheduleGuideHide()
                })
                channelSwitchBar.appendChild(switchButton)
            })
        }

        renderGuideButtons(CHANNELS)
        renderPickerCards(CHANNELS)

        void (async () => {
            const metadata = await getCatalogMetadata()
            const enriched = CHANNELS.map((channel) => {
                const item = metadata.get(channel.id)
                return {
                    ...channel,
                    poster: item?.poster || channel.poster,
                    description: item?.description || channel.description,
                }
            })
            guideChannels = enriched
            renderGuideButtons(enriched)
            renderPickerCards(enriched)
        })()

        const presetChannel = getChannelById(
            new URLSearchParams(window.location.search).get("ch")
        )
        if (presetChannel) {
            void startStream(presetChannel, !isTouchDevice())
        }
        window.addEventListener("resize", applyResponsiveLayout)
        let onDesktopMove: ((event: MouseEvent) => void) | null = null
        let onDesktopKey: ((event: KeyboardEvent) => void) | null = null
        if (isTouchDevice()) {
            video.addEventListener("touchstart", () => {
                if (!isPlaybackMode) return
                if (guideVisible) {
                    hideGuide()
                    clearGuideTimer()
                    return
                }
                showGuide()
                scheduleGuideHide()
            })
        } else {
            onDesktopMove = () => {
                if (!isPlaybackMode) return
                showGuide()
                scheduleGuideHide(2400)
            }
            onDesktopKey = (event) => {
                if (!isPlaybackMode) return
                if (event.key.toLowerCase() !== "g") return
                if (guideVisible) {
                    hideGuide()
                    clearGuideTimer()
                    return
                }
                showGuide()
                scheduleGuideHide()
            }
            overlay.addEventListener("mousemove", onDesktopMove)
            window.addEventListener("keydown", onDesktopKey)
        }

        return () => {
            window.removeEventListener("resize", applyResponsiveLayout)
            if (onDesktopMove) {
                overlay.removeEventListener("mousemove", onDesktopMove)
            }
            if (onDesktopKey) {
                window.removeEventListener("keydown", onDesktopKey)
            }
            clearGuideTimer()
            const currentPath = getCurrentPath()
            if (currentPath !== TV_ROUTE) {
                teardownStream(video)
                overlay.remove()
            }
            body.style.overflow = oldOverflow
        }
    }, [])

    return {}
}
