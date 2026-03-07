import { Game } from "./Types.tsx"

export async function fetchSchedule(): Promise<Game[]> {
    const SCHEDULE_URL =
        "https://script.google.com/macros/s/AKfycbzRxgEcBLq9LE1LpJ713tZ78jqm8vZ5XTt0-TGLPve1cshfeYlWsja3-Jox7VSdqHuChA/exec"

    const res = await fetch(SCHEDULE_URL)
    const data: Game[] = await res.json()

    const valid = data.filter((g) => g?.Date)
    const upcoming = valid.filter(
        (g) => g["Game Status"] === "Scheduled" || g["Game Status"] === "Final"
    )

    return upcoming.map((g) => ({
        ...g,
        parsedMonth: new Date(g.Date).toLocaleString("default", {
            month: "long",
        }),
        parsedYear: new Date(g.Date).getFullYear(),
    }))
}
