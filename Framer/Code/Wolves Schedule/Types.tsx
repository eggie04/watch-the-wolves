export type Game = {
    ID: string
    Date: string
    Time?: string
    Opponent: string
    "Game Status": string
    "Home/Away": string
    "Opponent Logo URL"?: string
    "Wolves Score"?: string
    "Opponent Score"?: string
    "TV Broadcast"?: string
    Result?: string
    approved?: string[]
    waitlist?: string[]
    parsedMonth?: string
    parsedYear?: number
    [key: string]: any
}
