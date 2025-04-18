import RetroTimerStopwatch from "@/components/retro-timer-stopwatch"
import { Suspense } from "react"

export default function Home() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-white">Loading timer...</div>}>
        <RetroTimerStopwatch />
      </Suspense>
    </div>
  )
}
