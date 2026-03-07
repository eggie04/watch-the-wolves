import { useEffect, useState } from "react"
import Dropdown from "./Dropdown.tsx"
import GameCard from "./GameCard.tsx"
import { fetchSchedule } from "./Api.tsx"
import { Game } from "./Types.tsx"

export default function WolvesSchedule() {
    const [games, setGames] = useState<Game[]>([])
    const [filterLocation, setFilterLocation] = useState("Home")
    const [filterMonth, setFilterMonth] = useState("All")
    const [filterSeason, setFilterSeason] = useState("")
    const [searchOpponent, setSearchOpponent] = useState("")
    const [months, setMonths] = useState<string[]>([])
    const [seasons, setSeasons] = useState<string[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchSchedule()
            .then((enhanced) => {
                setGames(enhanced)
                const now = new Date()
                setFilterMonth(now.toLocaleString("default", { month: "long" }))
                setFilterSeason(String(now.getFullYear()))
                setMonths([
                    "All",
                    ...new Set(enhanced.map((g) => g.parsedMonth)),
                ])
                setSeasons(
                    [...new Set(enhanced.map((g) => g.parsedYear))]
                        .sort((a, b) => b - a)
                        .map(String)
                )
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const filteredGames = games.filter((g) => {
        const matchesMonth =
            filterMonth === "All" || g.parsedMonth === filterMonth
        const matchesLocation =
            filterLocation === "Both" || g["Home/Away"] === filterLocation
        const matchesSeason =
            filterSeason === "" || String(g.parsedYear) === filterSeason
        const matchesOpponent =
            searchOpponent.trim() === "" ||
            g.Opponent.toLowerCase().includes(searchOpponent.toLowerCase())
        return (
            matchesMonth && matchesLocation && matchesSeason && matchesOpponent
        )
    })

    if (loading) {
        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                    backgroundColor: "#000",
                    color: "#c1cbd7",
                }}
            >
                <img
                    src="https://loodibee.com/wp-content/uploads/nba-minnesota-timberwolves-logo.png"
                    alt="Loading Wolves"
                    style={{
                        width: 100,
                        height: 100,
                        animation: "pulse 1.2s ease-in-out infinite",
                    }}
                />
                <div style={{ marginTop: 16, fontSize: 16 }}>
                    Loading Wolves Games...
                </div>
                <style>{`@keyframes pulse { 0% { transform: scale(1); opacity: 0.7; } 50% { transform: scale(1.1); opacity: 1; } 100% { transform: scale(1); opacity: 0.7; }}`}</style>
            </div>
        )
    }

    return (
        <div
            style={{
                background: "#000",
                color: "#fff",
                fontFamily: "system-ui",
                maxWidth: 800,
                margin: "0 auto",
            }}
        >
            <div
                style={{
                    position: "sticky",
                    top: 0,
                    background: "#111",
                    zIndex: 10,
                    borderBottom: "1px solid #222",
                    padding: 12,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                }}
            >
                <Dropdown
                    label="Season"
                    value={filterSeason}
                    options={seasons}
                    onChange={setFilterSeason}
                />
                <Dropdown
                    label="Month"
                    value={filterMonth}
                    options={months}
                    onChange={setFilterMonth}
                />
                <Dropdown
                    label="Location"
                    value={filterLocation}
                    options={["Home", "Away", "Both"]}
                    onChange={setFilterLocation}
                />
                <input
                    type="text"
                    placeholder="Search opponent"
                    value={searchOpponent}
                    onChange={(e) => setSearchOpponent(e.target.value)}
                    style={{
                        background: "#111",
                        color: "#fff",
                        border: "1px solid #444",
                        borderRadius: "999px",
                        padding: "8px 16px",
                        fontSize: 14,
                        flexGrow: 1,
                        minWidth: 160,
                    }}
                />
            </div>

            {filteredGames.length === 0 ? (
                <div
                    style={{ padding: 20, textAlign: "center", color: "#888" }}
                >
                    No games found for {filterLocation} in {filterMonth}{" "}
                    {filterSeason}.
                </div>
            ) : (
                filteredGames.map((game, idx) => (
                    <GameCard key={idx} game={game} />
                ))
            )}
        </div>
    )
}
