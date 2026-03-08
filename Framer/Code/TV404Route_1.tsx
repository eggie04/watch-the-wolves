import { useLayoutEffect } from "react"
import type { Override } from "framer"

const TV_ROUTE = "/tv"
const OVERLAY_ID = "tv-route-overlay"
const BUILD_TAG = "TV UI v3"
const DEFAULT_CHANNEL_ID = "wolves-live"
const CHANNELS = [
    {
        id: "wolves-live",
        name: "Wolves Live",
        streamUrl: "https://video.watchthewolves.com/wolves-live/index.m3u8",
    },
    {
        id: "rick-morty",
        name: "Rick and Morty",
        streamUrl:
            "https://adultswim-vodlive.cdn.turner.com/live/rick-and-morty/stream.m3u8",
    },
]
const HLS_SCRIPT_URLS = [
    "https://cdn.jsdelivr.net/npm/hls.js@latest",
    "https://unpkg.com/hls.js@latest",
]

let hlsScriptPromise: Promise<void> | null = null
let activeHls: any = null

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

async function attachStream(video: HTMLVideoElement) {
    const streamUrl = getSelectedChannel().streamUrl
    teardownStream(video)

    if (canUseNativeHls(video)) {
        const nativeOk = await tryNativePlayback(video, streamUrl)
        if (nativeOk) return
    }

    await loadHlsScript()
    const Hls = (window as any).Hls
    if (!Hls || !Hls.isSupported()) {
        // Last fallback for apps/webviews with partial media support.
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

function buildTapToStart(onTap: () => void) {
    const wrapper = document.createElement("div")
    wrapper.style.position = "fixed"
    wrapper.style.left = "50%"
    wrapper.style.top = "50%"
    wrapper.style.transform = "translate(-50%, -50%)"
    wrapper.style.display = "flex"
    wrapper.style.flexDirection = "column"
    wrapper.style.alignItems = "center"
    wrapper.style.gap = "10px"
    wrapper.style.zIndex = "2147483647"

    const button = document.createElement("button")
    button.type = "button"
    button.textContent = "Tap Here to Start Stream"
    button.style.padding = "15px 22px"
    button.style.border = "2px solid #93c5fd"
    button.style.borderRadius = "12px"
    button.style.background = "#0f172a"
    button.style.color = "white"
    button.style.fontSize = "18px"
    button.style.fontWeight = "700"
    button.style.cursor = "pointer"
    button.style.boxShadow = "0 0 0 3px rgba(147,197,253,0.25)"
    button.addEventListener("click", onTap, { once: true })

    wrapper.appendChild(button)
    return wrapper
}

function isTouchDevice() {
    return (
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia("(pointer: coarse)").matches
    )
}

function getSelectedChannel() {
    const params = new URLSearchParams(window.location.search)
    const ch = params.get("ch")
    return (
        CHANNELS.find((item) => item.id === ch) ||
        CHANNELS.find((item) => item.id === DEFAULT_CHANNEL_ID) ||
        CHANNELS[0]
    )
}

function setSelectedChannel(channelId: string) {
    const url = new URL(window.location.href)
    url.searchParams.set("ch", channelId)
    window.history.replaceState({}, "", url.toString())
}

export const TV404Route: Override = () => {
    useLayoutEffect(() => {
        const path = window.location.pathname.replace(/\/+$/, "") || "/"
        if (path !== TV_ROUTE) return

        const body = document.body
        const oldOverflow = body.style.overflow
        body.style.overflow = "hidden"

        const existing = document.getElementById(OVERLAY_ID) as
            | HTMLDivElement
            | null
        if (existing) {
            return
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

        const channelBar = document.createElement("div")
        channelBar.style.position = "fixed"
        channelBar.style.top = "16px"
        channelBar.style.left = "16px"
        channelBar.style.display = "flex"
        channelBar.style.gap = "8px"
        channelBar.style.flexWrap = "wrap"
        channelBar.style.zIndex = "2147483647"
        overlay.appendChild(channelBar)

        const setActiveButton = () => {
            Array.from(channelBar.children).forEach((node) => {
                const button = node as HTMLButtonElement
                const isActive = button.dataset.channelId === selectedChannel.id
                button.style.background = isActive ? "#2563eb" : "#111827"
                button.style.borderColor = isActive ? "#93c5fd" : "#374151"
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

        const startStream = async (preferSound: boolean) => {
            try {
                await attachStream(video)
                if (preferSound) video.muted = false
                const started = await safePlay(video)
                if (!started) showError()
            } catch (error) {
                console.error(error)
                showError()
            }
        }

        CHANNELS.forEach((channel) => {
            const button = document.createElement("button")
            button.type = "button"
            button.dataset.channelId = channel.id
            button.textContent = channel.name
            button.style.padding = "10px 14px"
            button.style.border = "1px solid #374151"
            button.style.borderRadius = "10px"
            button.style.background = "#111827"
            button.style.color = "white"
            button.style.fontSize = "14px"
            button.style.cursor = "pointer"
            button.addEventListener("click", async () => {
                selectedChannel = channel
                setSelectedChannel(channel.id)
                setActiveButton()
                video.muted = false
                await startStream(true)
            })
            channelBar.appendChild(button)
        })
        setActiveButton()

        if (isTouchDevice()) {
            const tapButtonWrap = buildTapToStart(async () => {
                await startStream(true)
                video.controls = true
                tapButtonWrap.remove()
            })
            overlay.appendChild(tapButtonWrap)
        } else {
            void startStream(false)
        }

        // Intentionally persist while on /tv to avoid Framer remount flicker.
        return () => {
            const currentPath =
                window.location.pathname.replace(/\/+$/, "") || "/"
            if (currentPath !== TV_ROUTE) {
                teardownStream(video)
                overlay.remove()
            }
            body.style.overflow = oldOverflow
        }
    }, [])

    return {}
}
