import { useState } from "react"
import { Game } from "./Types.tsx"

const WEBHOOK_URL =
    "https://script.google.com/macros/s/AKfycbyj9gjP_iIJpr5g0EwSD0u-K9KHCszjUL17T5Vom0XluJRj75O_Ix_i6PF9KCXkfqfa/exec"

const submitWaitlist = async (
    gameId: string,
    name: string,
    onSuccess: () => void,
    onError: () => void
) => {
    try {
        const res = await fetch(
            `${WEBHOOK_URL}?gameId=${encodeURIComponent(gameId)}&name=${encodeURIComponent(name)}`
        )
        const json = await res.json()
        if (json.status === "success") {
            onSuccess()
        } else {
            throw new Error("Submission failed")
        }
    } catch (error) {
        console.error(error)
        onError()
    }
}

// 🧩 Jersey styling helpers
const getJerseyStyle = (jersey: string): React.CSSProperties => {
    const lowered = jersey.toLowerCase()
    const isAlternate = /\balt(?:ernate)?\b/.test(lowered)
    if (lowered.includes("icon")) {
        return { color: "#2363c4", fontWeight: 600 } // Timberwolves blue
    }
    if (lowered.includes("association")) {
        return { color: "#ffffff", fontWeight: 600 } // White
    }
    if (lowered.includes("statement")) {
        return { color: "#21d07a", fontWeight: 600 } // Green
    }
    if (lowered.includes("city") && !isAlternate) {
        return { color: "#901A89", fontWeight: 600 } // Purple
    }
    if (lowered.includes("classic") && !isAlternate) {
        return { color: "#0B6336", fontWeight: 600 } // Green
    }
    return { color: "#aaa" }
}

const styleSpecialJersey = (jersey: string): JSX.Element | string => {
    return jersey
}

export default function GameCard({ game }: { game: Game }) {
    const [modalOpen, setModalOpen] = useState(false)
    const [viewWaitlistOpen, setViewWaitlistOpen] = useState(false)
    const [name, setName] = useState("")
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    if (!game || !game.Date) return null

    const gameDate = new Date(game.Date + " " + (game.Time || ""))
    const now = new Date()
    const gameStarted = gameDate < now

    const getLogo = (team: string) => {
        if (team === "TBD")
            return "https://a.espncdn.com/i/teamlogos/nba/500/nba.png"
        const sanitized = team.toLowerCase().replace(/ /g, "-")
        return `https://a.espncdn.com/i/teamlogos/nba/500/${sanitized}.png`
    }

    const getResultBadge = (result: string | undefined) => {
        if (result === "W")
            return <span style={{ color: "#0f0", fontWeight: 600 }}>W</span>
        if (result === "L")
            return <span style={{ color: "#f44", fontWeight: 600 }}>L</span>
        return null
    }

    return (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                padding: "12px 20px",
                borderBottom: "1px solid #222",
                gap: 12,
            }}
        >
            <div style={{ display: "flex", gap: 12, flex: 1 }}>
                <img
                    src={game["Opponent Logo URL"] || getLogo(game.Opponent)}
                    alt={game.Opponent}
                    style={{
                        width: 40,
                        height: 40,
                        objectFit: "contain",
                        background: "#111",
                        borderRadius: 8,
                    }}
                />
                <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>
                        Wolves {game["Home/Away"] === "Home" ? "vs" : "@"}{" "}
                        {game.Opponent}
                    </div>
                    <div style={{ color: "#aaa", fontSize: 14 }}>
                        {game.Date} • {game.Time || ""}
                    </div>
                    <div style={{ color: "#555", fontSize: 13 }}>
                        {game["Home/Away"] === "Home"
                            ? "Target Center, Minneapolis"
                            : "Away Game"}
                    </div>
                    <div
                        style={{ color: "#777", fontSize: 13, lineHeight: 1.5 }}
                    >
                        Broadcast: {game["TV Broadcast"] || "TBD"}
                    </div>
                    {game.Jersey && (
                        <div style={{ fontSize: 13 }}>
                            <span style={{ color: "#aaa" }}>Jersey: </span>
                            <span style={getJerseyStyle(game.Jersey)}>
                                {styleSpecialJersey(game.Jersey)}
                            </span>
                        </div>
                    )}
                    {game["Wolves Score"] && game["Opponent Score"] && (
                        <div style={{ color: "#ccc", fontSize: 13 }}>
                            Final Score: Wolves {game["Wolves Score"]} -{" "}
                            {game["Opponent Score"]}{" "}
                            {getResultBadge(game.Result)}
                        </div>
                    )}
                    {!success &&
                        game["Home/Away"] === "Home" &&
                        !gameStarted && (
                            <div
                                style={{
                                    display: "flex",
                                    gap: 8,
                                    marginTop: 12,
                                }}
                            >
                                <button
                                    onClick={() => setModalOpen(true)}
                                    style={{
                                        padding: "6px 12px",
                                        backgroundColor: "#2563eb",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: 6,
                                        fontSize: 14,
                                    }}
                                >
                                    Join Waitlist
                                </button>
                                <button
                                    onClick={() => setViewWaitlistOpen(true)}
                                    style={{
                                        padding: "6px 12px",
                                        backgroundColor: "#9ea2a2",
                                        color: "#000",
                                        border: "none",
                                        borderRadius: 6,
                                        fontSize: 14,
                                        position: "relative",
                                    }}
                                >
                                    View Waitlist
                                    {Array.isArray(game.waitlist) &&
                                        game.waitlist.length > 0 && (
                                            <span
                                                style={{
                                                    position: "absolute",
                                                    top: -6,
                                                    right: -6,
                                                    backgroundColor: "#2563eb",
                                                    color: "#fff",
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    borderRadius: "50%",
                                                    width: 20,
                                                    height: 20,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                }}
                                            >
                                                {game.waitlist.length}
                                            </span>
                                        )}
                                </button>
                            </div>
                        )}
                </div>
            </div>

            {Array.isArray(game.approved) && game.approved.length > 0 && (
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        justifyContent: "flex-start",
                        minWidth: 80,
                        gap: 4,
                        marginLeft: "auto",
                    }}
                >
                    <div style={{ fontSize: 12, color: "#0f0" }}>
                        {gameStarted ? "Attended:" : "Attending:"}
                    </div>
                    {game.approved.map((person, idx) => (
                        <div
                            key={idx}
                            style={{
                                background: "#1f2937",
                                color: "#0f0",
                                fontSize: 12,
                                padding: "4px 10px",
                                borderRadius: 999,
                                whiteSpace: "nowrap",
                            }}
                        >
                            {person}
                        </div>
                    ))}
                </div>
            )}

            {modalOpen && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100vw",
                        height: "100vh",
                        backgroundColor: "rgba(0, 0, 0, 0.7)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 999,
                    }}
                >
                    <div
                        style={{
                            background: "#111",
                            padding: 20,
                            borderRadius: 8,
                            width: 300,
                        }}
                    >
                        <h3 style={{ color: "#fff", marginBottom: 10 }}>
                            Join Waitlist
                        </h3>
                        <input
                            type="text"
                            placeholder="Your name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            style={{
                                width: "100%",
                                padding: 10,
                                marginBottom: 10,
                                borderRadius: 6,
                                border: "1px solid #444",
                                fontSize: 14,
                            }}
                        />
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: 10,
                            }}
                        >
                            <button
                                onClick={() => setModalOpen(false)}
                                style={{
                                    padding: "6px 12px",
                                    backgroundColor: "#555",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 6,
                                    fontSize: 14,
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (!name.trim()) return
                                    setLoading(true)
                                    submitWaitlist(
                                        game.ID,
                                        name.trim(),
                                        () => {
                                            setSuccess(true)
                                            setLoading(false)
                                            setModalOpen(false)
                                        },
                                        () => {
                                            alert("Something went wrong.")
                                            setLoading(false)
                                        }
                                    )
                                }}
                                style={{
                                    padding: "6px 12px",
                                    backgroundColor: "#2563eb",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 6,
                                    fontSize: 14,
                                }}
                            >
                                {loading ? "Submitting..." : "Submit"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {viewWaitlistOpen && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        width: "100vw",
                        height: "100vh",
                        backgroundColor: "rgba(0, 0, 0, 0.7)",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        zIndex: 999,
                    }}
                >
                    <div
                        style={{
                            background: "#111",
                            padding: 20,
                            borderRadius: 8,
                            width: 300,
                            maxHeight: "70vh",
                            overflowY: "auto",
                        }}
                    >
                        <h3 style={{ color: "#fff", marginBottom: 10 }}>
                            Waitlist for {game.Opponent}
                        </h3>
                        {Array.isArray(game.waitlist) &&
                        game.waitlist.length > 0 ? (
                            game.waitlist.map((person, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        background: "#1f2937",
                                        color: "#fff",
                                        fontSize: 13,
                                        padding: "6px 10px",
                                        borderRadius: 6,
                                        marginBottom: 6,
                                    }}
                                >
                                    {person}
                                </div>
                            ))
                        ) : (
                            <div style={{ color: "#aaa" }}>
                                No users on waitlist yet.
                            </div>
                        )}
                        <button
                            onClick={() => setViewWaitlistOpen(false)}
                            style={{
                                marginTop: 12,
                                padding: "6px 12px",
                                backgroundColor: "#9ea2a2",
                                color: "#000",
                                border: "none",
                                borderRadius: 6,
                                fontSize: 14,
                                width: "100%",
                            }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
