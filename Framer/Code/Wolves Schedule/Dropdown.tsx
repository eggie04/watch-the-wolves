type DropdownProps = {
    label: string
    value: string
    options: string[]
    onChange: (val: string) => void
}

export default function Dropdown({
    label,
    value,
    options = [],
    onChange,
}: DropdownProps) {
    return (
        <div style={{ position: "relative", display: "inline-block" }}>
            <label style={{ marginRight: 8 }}>{label}:</label>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    background: "#333",
                    color: "#fff",
                    border: "1px solid #444",
                    padding: "8px 32px 8px 16px",
                    borderRadius: "999px",
                    fontSize: 14,
                    cursor: "pointer",
                    appearance: "none",
                }}
            >
                {(options || []).map((opt, idx) => (
                    <option key={idx} value={opt}>
                        {opt}
                    </option>
                ))}
            </select>
            <span
                style={{
                    position: "absolute",
                    right: 16,
                    top: "50%",
                    transform: "translateY(-50%)",
                    borderTop: "6px solid white",
                    borderLeft: "6px solid transparent",
                    borderRight: "6px solid transparent",
                }}
            />
        </div>
    )
}
9
