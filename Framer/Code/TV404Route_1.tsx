import { useLayoutEffect } from "react"
import type { Override } from "framer"

const TV_ROUTE = "/tv"
const OVERLAY_ID = "tv-route-overlay"
const BUILD_TAG = "TV UI v4"
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

async function attachStream(video: HTMLVideoElement, streamUrl: string) {
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

function buildTapToStart(onTap: () => void, label = "Tap Here to Start Stream") {
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
    button.textContent = label
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

        const picker = document.createElement("div")
        picker.style.position = "fixed"
        picker.style.inset = "0"
        picker.style.display = "flex"
        picker.style.flexDirection = "column"
        picker.style.justifyContent = "center"
        picker.style.alignItems = "center"
        picker.style.padding = "24px"
        picker.style.background =
            "radial-gradient(circle at 20% 20%, rgba(37,99,235,0.25), rgba(0,0,0,0.92) 42%)"
        picker.style.zIndex = "2147483647"
        overlay.appendChild(picker)

        const pickerTitle = document.createElement("div")
        pickerTitle.textContent = "Choose a channel"
        pickerTitle.style.color = "white"
        pickerTitle.style.fontSize = "clamp(24px, 4vw, 40px)"
        pickerTitle.style.fontWeight = "700"
        pickerTitle.style.marginBottom = "16px"
        picker.appendChild(pickerTitle)

        const pickerGrid = document.createElement("div")
        pickerGrid.style.display = "grid"
        pickerGrid.style.gridTemplateColumns =
            "repeat(auto-fit, minmax(220px, 1fr))"
        pickerGrid.style.gap = "14px"
        pickerGrid.style.width = "min(900px, 100%)"
        picker.appendChild(pickerGrid)

        const channelSwitchBar = document.createElement("div")
        channelSwitchBar.style.position = "fixed"
        channelSwitchBar.style.top = "16px"
        channelSwitchBar.style.left = "16px"
        channelSwitchBar.style.display = "none"
        channelSwitchBar.style.gap = "8px"
        channelSwitchBar.style.flexWrap = "wrap"
        channelSwitchBar.style.zIndex = "2147483647"
        overlay.appendChild(channelSwitchBar)

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

        let retryWrap: HTMLDivElement | null = null
        const clearRetry = () => {
            if (retryWrap) {
                retryWrap.remove()
                retryWrap = null
            }
        }

        const startStream = async (
            channel: (typeof CHANNELS)[number],
            preferSound: boolean
        ) => {
            try {
                selectedChannel = channel
                setSelectedChannel(channel.id)
                clearRetry()
                await attachStream(video, channel.streamUrl)
                if (preferSound) video.muted = false
                const started = await safePlay(video)
                if (!started) {
                    retryWrap = buildTapToStart(
                        async () => {
                            retryWrap = null
                            await startStream(channel, true)
                        },
                        "Tap to Start Playback"
                    )
                    overlay.appendChild(retryWrap)
                    return
                }
                picker.style.display = "none"
                channelSwitchBar.style.display = "flex"
                video.controls = true
            } catch (error) {
                console.error(error)
                showError()
            }
        }

        CHANNELS.forEach((channel) => {
            const button = document.createElement("button")
            button.type = "button"
            button.textContent = channel.name
            button.style.padding = "18px 16px"
            button.style.border = "1px solid #374151"
            button.style.borderRadius = "14px"
            button.style.background = "rgba(17,24,39,0.9)"
            button.style.color = "white"
            button.style.fontSize = "18px"
            button.style.fontWeight = "700"
            button.style.cursor = "pointer"
            button.style.textAlign = "left"
            button.addEventListener("click", async () => {
                await startStream(channel, true)
            })
            pickerGrid.appendChild(button)

            const switchButton = document.createElement("button")
            switchButton.type = "button"
            switchButton.textContent = channel.name
            switchButton.style.padding = "10px 14px"
            switchButton.style.border = "1px solid #374151"
            switchButton.style.borderRadius = "10px"
            switchButton.style.background = "#111827"
            switchButton.style.color = "white"
            switchButton.style.fontSize = "14px"
            switchButton.style.cursor = "pointer"
            switchButton.addEventListener("click", async () => {
                await startStream(channel, true)
            })
            channelSwitchBar.appendChild(switchButton)
        })

        const presetChannel = getChannelById(
            new URLSearchParams(window.location.search).get("ch")
        )
        if (presetChannel) {
            void startStream(presetChannel, !isTouchDevice())
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
