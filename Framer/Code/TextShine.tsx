import { useEffect, useState } from "react"
import type { Override } from "framer"

export const TextShine: Override = (props) => {
    const [hydrated, setHydrated] = useState(false)

    useEffect(() => {
        setHydrated(true)

        const styleId = "shine-animation-style"
        if (!document.getElementById(styleId)) {
            const style = document.createElement("style")
            style.id = styleId
            style.innerHTML = `
@keyframes shine {
  0% { -webkit-mask-position: 200%; }
  100% { -webkit-mask-position: -100%; }
}
.shine {
  -webkit-mask-image: linear-gradient(to right, transparent 30%, #EEE 50%, transparent 70%);
  -webkit-mask-size: 150% auto;
  animation: shine 5s ease-in-out infinite;
}
      `
            document.head.appendChild(style)
        }
    }, [])

    return {
        ...props,
        className: hydrated
            ? `${props.className ?? ""} shine`.trim()
            : props.className,
    }
}
