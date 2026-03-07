// AdminProtectedGameCard.tsx
import { useState, useEffect } from "react"
import { Game } from "./Types.tsx"

const WEBHOOK_URL =
    "https://script.google.com/macros/s/AKfycbyj9gjP_iIJpr5g0EwSD0u-K9KHCszjUL17T5Vom0XluJRj75O_Ix_i6PF9KCXkfqfa/exec"

const ADMIN_PASSWORD = "wolves123" // 🔒 Change this as needed

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

export default function AdminProtectedGameCard({ game }: { game: Game }) {
    if (!game || typeof game !== "object") return null

    const [modalOpen, setModalOpen] = useState(false)
    const [viewWaitlistOpen, setViewWaitlistOpen] = useState(false)
    const [name, setName] = useState("")
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [isAdmin, setIsAdmin] = useState(false)
    const [approvedList, setApprovedList] = useState<string[]>(
        Array.isArray((game as any)?.approved) ? (game as any).approved : []
    )

    useEffect(() => {
        if (localStorage.getItem("isAdmin") === "true") {
            setIsAdmin(true)
        }
    }, [])

    if (!game.Date) return null

    const gameDate = new Date(game.Date + " " + (game.Time || ""))
    const now = new Date()
    const gameStarted = gameDate < now

    const getLogo = (team: string) => {
        if (team === "TBD")
            return "https://a.espncdn.com/i/teamlogos/nba/500/nba.png"
        const sanitized = team.toLowerCase().replace(/ /g, "-")
        return `https://a.espncdn.com/i/teamlogos/nba/500/${sanitized}.png`
    }

    const toggleApproval = (person: string) => {
        setApprovedList((prev) =>
            prev.includes(person)
                ? prev.filter((p) => p !== person)
                : [...prev, person]
        )
    }

    const saveApproved = async () => {
        try {
            const res = await fetch(WEBHOOK_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    gameId: game.ID,
                    approved: approvedList,
                }),
            })
            const json = await res.json()
            if (json.status === "success") {
                alert("Approved list updated!")
            } else {
                throw new Error("Save failed")
            }
        } catch (error) {
            console.error(error)
            alert("Something went wrong while saving.")
        }
    }

    return (
        <div style={{ padding: 16, borderBottom: "1px solid #222" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img
                    src={game["Opponent Logo URL"] || getLogo(game.Opponent)}
                    alt={game.Opponent}
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 6,
                        objectFit: "contain",
                    }}
                />
                <div>
                    <div style={{ fontWeight: 600 }}>
                        Wolves {game["Home/Away"] === "Home" ? "vs" : "@"}{" "}
                        {game.Opponent}
                    </div>
                    <div style={{ fontSize: 14, color: "#aaa" }}>
                        {game.Date} • {game.Time || ""}
                    </div>
                </div>
            </div>

            {game["Home/Away"] === "Home" && !gameStarted && (
                <div style={{ marginTop: 12 }}>
                    <button onClick={() => setModalOpen(true)}>
                        Join Waitlist
                    </button>
                    <button onClick={() => setViewWaitlistOpen(true)}>
                        View Waitlist
                    </button>
                    <button
                        onClick={() => {
                            if (!isAdmin) {
                                const input = prompt("Enter admin password:")
                                if (input === ADMIN_PASSWORD) {
                                    setIsAdmin(true)
                                    localStorage.setItem("isAdmin", "true")
                                } else {
                                    alert("Incorrect password")
                                }
                            } else {
                                alert("You are already logged in as admin.")
                            }
                        }}
                    >
                        Manage Waitlist
                    </button>
                </div>
            )}

            {viewWaitlistOpen && (
                <div style={{ marginTop: 16 }}>
                    <h4>Waitlist</h4>
                    {Array.isArray(game.waitlist) &&
                    game.waitlist.length > 0 ? (
                        game.waitlist.map((person, idx) => (
                            <div key={idx}>
                                {person}
                                {isAdmin && (
                                    <button
                                        onClick={() => toggleApproval(person)}
                                    >
                                        {approvedList.includes(person)
                                            ? "Remove"
                                            : "Approve"}
                                    </button>
                                )}
                            </div>
                        ))
                    ) : (
                        <div>No users yet.</div>
                    )}
                    {isAdmin && (
                        <button onClick={saveApproved} style={{ marginTop: 8 }}>
                            Save Approved
                        </button>
                    )}
                    <button onClick={() => setViewWaitlistOpen(false)}>
                        Close
                    </button>
                </div>
            )}

            {modalOpen && (
                <div style={{ marginTop: 16 }}>
                    <h4>Join Waitlist</h4>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                    />
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
                    >
                        {loading ? "Submitting..." : "Submit"}
                    </button>
                    <button onClick={() => setModalOpen(false)}>Cancel</button>
                </div>
            )}
        </div>
    )
}
