import { createServer } from "node:http"
import { createReadStream, promises as fs } from "node:fs"
import path from "node:path"
import process from "node:process"

const port = Number(process.env.VIDEO_HOST_PORT || 8787)
const routePath = normalizeRoute(process.env.VIDEO_ROUTE_PATH || "/jerry70.mp4")
const defaultFilePath = path.resolve(process.cwd(), "private-video", "jerry70.mp4")
const videoFilePath = path.resolve(process.env.VIDEO_FILE_PATH || defaultFilePath)

function normalizeRoute(input) {
    const value = String(input || "").trim()
    if (!value) return "/jerry70.mp4"
    return value.startsWith("/") ? value : `/${value}`
}

function sendText(res, statusCode, body) {
    res.writeHead(statusCode, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
    })
    res.end(body)
}

function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase()
    if (ext === ".webm") return "video/webm"
    if (ext === ".mov") return "video/quicktime"
    if (ext === ".m4v") return "video/x-m4v"
    return "video/mp4"
}

function parseRangeHeader(rangeHeader, size) {
    const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader || "")
    if (!match) return null

    const startText = match[1]
    const endText = match[2]
    let start
    let end

    if (startText === "" && endText === "") return null

    if (startText === "") {
        const suffixLength = Number(endText)
        if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null
        start = Math.max(size - suffixLength, 0)
        end = size - 1
    } else {
        start = Number(startText)
        end = endText === "" ? size - 1 : Number(endText)
    }

    if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 0 ||
        end < start ||
        start >= size
    ) {
        return null
    }

    end = Math.min(end, size - 1)
    return { start, end }
}

const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`)

    if (req.method === "GET" && url.pathname === "/healthz") {
        sendText(res, 200, "ok")
        return
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
        sendText(res, 405, "Method not allowed")
        return
    }

    if (url.pathname !== routePath) {
        sendText(res, 404, `Not found. Expected ${routePath}`)
        return
    }

    let stat
    try {
        stat = await fs.stat(videoFilePath)
    } catch {
        sendText(res, 404, `Video file not found: ${videoFilePath}`)
        return
    }

    const contentType = getContentType(videoFilePath)
    const commonHeaders = {
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
        "Content-Disposition": `inline; filename="${path.basename(videoFilePath)}"`,
    }

    const range = parseRangeHeader(req.headers.range, stat.size)
    if (req.headers.range && !range) {
        res.writeHead(416, {
            ...commonHeaders,
            "Content-Range": `bytes */${stat.size}`,
        })
        res.end()
        return
    }

    if (range) {
        const contentLength = range.end - range.start + 1
        res.writeHead(206, {
            ...commonHeaders,
            "Content-Length": contentLength,
            "Content-Range": `bytes ${range.start}-${range.end}/${stat.size}`,
        })
        if (req.method === "HEAD") {
            res.end()
            return
        }
        createReadStream(videoFilePath, range).pipe(res)
        return
    }

    res.writeHead(200, {
        ...commonHeaders,
        "Content-Length": stat.size,
    })
    if (req.method === "HEAD") {
        res.end()
        return
    }
    createReadStream(videoFilePath).pipe(res)
})

server.listen(port, () => {
    console.log(`Video host listening on http://127.0.0.1:${port}${routePath}`)
    console.log(`Serving file: ${videoFilePath}`)
})
