"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { Play, Pause, Square, Flag, Clock, TimerIcon, Plus, Minus, Volume2, VolumeX } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

type Mode = "timer" | "stopwatch"
type TimerState = "idle" | "running" | "paused" | "completed"
type SoundType = "click" | "complete" | "lap"

interface Lap {
  id: number
  time: number
}

// Preset timer durations in seconds
const TIMER_PRESETS = [
  { label: "1m", value: 60 },
  { label: "3m", value: 180 },
  { label: "5m", value: 300 },
  { label: "10m", value: 600 },
]

export default function RetroTimerStopwatch() {
  // State management
  const [mode, setMode] = useState<Mode>("stopwatch")
  const [state, setState] = useState<TimerState>("idle")
  const [time, setTime] = useState(0)
  const [timerDuration, setTimerDuration] = useState(300) // 5 minutes default
  const [laps, setLaps] = useState<Lap[]>([])
  const [currentTime, setCurrentTime] = useState("")
  const [weather, setWeather] = useState("☀ +16")
  const [showTimerSettings, setShowTimerSettings] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [soundsLoaded, setSoundsLoaded] = useState<Record<SoundType, boolean>>({
    click: false,
    complete: false,
    lap: false,
  })

  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const clickSoundRef = useRef<HTMLAudioElement | null>(null)
  const completeSoundRef = useRef<HTMLAudioElement | null>(null)
  const lapSoundRef = useRef<HTMLAudioElement | null>(null)

  // Update current time
  useEffect(() => {
    const updateTime = () => {
      try {
        const now = new Date()
        const hours = now.getHours()
        const minutes = now.getMinutes()
        const ampm = hours >= 12 ? "PM" : "AM"
        const formattedHours = hours % 12 || 12
        const formattedMinutes = minutes.toString().padStart(2, "0")
        setCurrentTime(`${formattedHours}:${formattedMinutes} ${ampm}`)
      } catch (error) {
        console.error("Error updating time:", error)
        setCurrentTime("--:-- --")
      }
    }

    updateTime()
    const interval = setInterval(updateTime, 60000)
    return () => clearInterval(interval)
  }, [])

  // Handle timer/stopwatch logic
  useEffect(() => {
    if (state === "running") {
      intervalRef.current = setInterval(() => {
        setTime((prevTime) => {
          if (mode === "timer") {
            const newTime = prevTime - 0.01
            if (newTime <= 0) {
              clearInterval(intervalRef.current!)
              setState("completed")
              playSound("complete")
              return 0
            }
            return newTime
          } else {
            return prevTime + 0.01
          }
        })
      }, 10)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [state, mode])

  // Initialize audio - improved implementation
  useEffect(() => {
    // Create audio elements
    const createAudioElement = () => {
      const audio = new Audio()
      audio.preload = "none" // Don't preload automatically
      return audio
    }

    // Setup audio elements with proper error handling
    const setupAudio = (type: SoundType, src: string, audioRef: React.MutableRefObject<HTMLAudioElement | null>) => {
      try {
        const audio = createAudioElement()

        // Add event listeners
        const handleCanPlay = () => {
          setSoundsLoaded((prev) => ({ ...prev, [type]: true }))
          // Remove event listeners after successful load
          audio.removeEventListener("canplaythrough", handleCanPlay)
          audio.removeEventListener("error", handleError)
        }

        const handleError = (e: Event) => {
          console.warn(`Sound ${type} failed to load:`, e)
          setSoundsLoaded((prev) => ({ ...prev, [type]: false }))
          // Remove event listeners after error
          audio.removeEventListener("canplaythrough", handleCanPlay)
          audio.removeEventListener("error", handleError)
        }

        audio.addEventListener("canplaythrough", handleCanPlay)
        audio.addEventListener("error", handleError)

        // Set source and start loading
        audio.src = src
        audioRef.current = audio

        // Start loading the audio
        audio.load()
      } catch (error) {
        console.error(`Error setting up ${type} sound:`, error)
        setSoundsLoaded((prev) => ({ ...prev, [type]: false }))
      }
    }

    // Setup all audio elements
    setupAudio("click", "/sounds/click.mp3", clickSoundRef)
    setupAudio("complete", "/sounds/complete.mp3", completeSoundRef)
    setupAudio("lap", "/sounds/lap.mp3", lapSoundRef)

    // Cleanup function
    return () => {
      const cleanupAudio = (audioRef: React.MutableRefObject<HTMLAudioElement | null>) => {
        if (audioRef.current) {
          audioRef.current.pause()
          audioRef.current.src = ""
          audioRef.current = null
        }
      }

      cleanupAudio(clickSoundRef)
      cleanupAudio(completeSoundRef)
      cleanupAudio(lapSoundRef)
    }
  }, [])

  // Sound player with improved error handling
  const playSound = useCallback(
    (type: SoundType) => {
      if (!soundEnabled) return

      let audioElement: HTMLAudioElement | null = null

      switch (type) {
        case "click":
          audioElement = clickSoundRef.current
          break
        case "complete":
          audioElement = completeSoundRef.current
          break
        case "lap":
          audioElement = lapSoundRef.current
          break
      }

      if (!audioElement || !soundsLoaded[type]) {
        // If sound isn't loaded, don't try to play it
        return
      }

      try {
        // Reset the audio to the beginning
        audioElement.currentTime = 0

        // Play with error handling
        const playPromise = audioElement.play()

        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            // This will happen on browsers that block autoplay
            console.warn(`Error playing ${type} sound:`, error)
          })
        }
      } catch (error) {
        console.warn(`Error playing ${type} sound:`, error)
      }
    },
    [soundEnabled, soundsLoaded],
  )

  // Mode toggle handler
  const toggleMode = useCallback(
    (newMode: Mode) => {
      if (mode !== newMode) {
        playSound("click")
        setState("idle")
        setTime(newMode === "timer" ? timerDuration : 0)
        setLaps([])
        setMode(newMode)
        setShowTimerSettings(false)
      }
    },
    [mode, timerDuration, playSound],
  )

  // Play/pause handler
  const togglePlayPause = useCallback(() => {
    playSound("click")
    if (state === "idle" || state === "completed") {
      if (mode === "timer" && time === 0) {
        setTime(timerDuration)
      }
      setState("running")
    } else if (state === "running") {
      setState("paused")
    } else {
      setState("running")
    }
  }, [state, mode, time, timerDuration, playSound])

  // Stop/reset handler
  const stopReset = useCallback(() => {
    playSound("click")
    setState("idle")
    setTime(mode === "timer" ? timerDuration : 0)
    setLaps([])
  }, [mode, timerDuration, playSound])

  // Lap recording handler
  const addLap = useCallback(() => {
    if (state === "running" && mode === "stopwatch") {
      playSound("lap")
      setLaps((prevLaps) => [...prevLaps, { id: prevLaps.length + 1, time }])
    }
  }, [state, mode, time, playSound])

  // Timer duration adjustment handler
  const adjustTimerDuration = useCallback(
    (amount: number) => {
      playSound("click")
      const newDuration = Math.max(10, Math.min(3600, timerDuration + amount))
      setTimerDuration(newDuration)
      if (state === "idle") {
        setTime(newDuration)
      }
    },
    [timerDuration, state, playSound],
  )

  // Set timer to preset value
  const setTimerPreset = useCallback(
    (seconds: number) => {
      playSound("click")
      setTimerDuration(seconds)
      if (state === "idle") {
        setTime(seconds)
      }
    },
    [state, playSound],
  )

  // Time formatting functions
  const formatTime = useCallback((timeInSeconds: number) => {
    const isNegative = timeInSeconds < 0
    const absTime = Math.abs(timeInSeconds)

    const minutes = Math.floor(absTime / 60)
    const seconds = Math.floor(absTime % 60)
    const milliseconds = Math.floor((absTime * 100) % 100)

    return `${isNegative ? "-" : ""}${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}.${milliseconds.toString().padStart(2, "0")}`
  }, [])

  const formatTimerDuration = useCallback((seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
  }, [])

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, type: "spring" }}
      className="relative w-full max-w-md aspect-square bg-gray-600 rounded-3xl p-4 shadow-2xl retro-device"
      aria-label={`${mode} ${state}`}
    >
      {/* Scanlines effect */}
      <div className="absolute inset-0 pointer-events-none z-10 rounded-3xl overflow-hidden opacity-10">
        <div className="scanlines"></div>
      </div>

      {/* Faux glass screen glare */}
      <div className="absolute top-0 left-1/4 w-1/2 h-1/6 bg-white/5 rounded-full blur-sm z-10" />

      <div className="relative h-full w-full bg-black rounded-2xl flex flex-col overflow-hidden border-4 border-gray-700">
        {/* Top status bar */}
        <div className="flex justify-between items-center px-4 py-2 text-gray-400 text-xs bg-gray-900 border-b border-gray-800">
          <div className="flex items-center">
            <span className="text-yellow-400 mr-1">☀</span>
            <span>{weather}</span>
          </div>
          <div className="flex items-center">
            <Clock className="w-3 h-3 mr-1 text-cyan-400" />
            <span>{currentTime}</span>
          </div>
        </div>

        {/* Main display */}
        <div className="flex-1 flex flex-col items-center justify-start pt-6 px-4 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={`mode-${mode}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="text-white text-center mb-2 w-full"
            >
              <h1 className="text-xl font-bold tracking-widest text-cyan-400 glow-text">
                {mode === "stopwatch" ? "STOPWATCH" : "TIMER"}
              </h1>
            </motion.div>
          </AnimatePresence>

          <div className="relative mb-4 w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={`time-${state === "completed" ? "completed" : "normal"}`}
                initial={{ scale: 0.9 }}
                animate={{
                  scale: 1,
                  color: state === "completed" ? "#FF5555" : "#FFFFFF",
                }}
                exit={{ scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "text-white text-7xl font-bold font-mono tracking-wider digital-display text-center",
                  state === "completed" && "text-red-500 animate-pulse",
                )}
                aria-live="polite"
                aria-atomic="true"
              >
                {formatTime(time)}
              </motion.div>
            </AnimatePresence>

            {/* Pixel dust effect for completed timer */}
            {state === "completed" && mode === "timer" && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="pixel-dust"></div>
              </div>
            )}
          </div>

          {/* Mode buttons */}
          <div className="flex space-x-4 mb-4 w-full justify-center">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleMode("stopwatch")}
              className={cn(
                "px-4 py-2 rounded-md font-bold tracking-wide shadow-inner transition-all duration-200",
                mode === "stopwatch"
                  ? "bg-gray-700 text-cyan-400 border-b-2 border-cyan-400 shadow-cyan-400/20 glow-button"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700",
              )}
              aria-pressed={mode === "stopwatch"}
            >
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                <span>STOPWATCH</span>
              </div>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => toggleMode("timer")}
              className={cn(
                "px-4 py-2 rounded-md font-bold tracking-wide shadow-inner transition-all duration-200",
                mode === "timer"
                  ? "bg-gray-700 text-cyan-400 border-b-2 border-cyan-400 shadow-cyan-400/20 glow-button"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700",
              )}
              aria-pressed={mode === "timer"}
            >
              <div className="flex items-center">
                <TimerIcon className="w-4 h-4 mr-1" />
                <span>TIMER</span>
              </div>
            </motion.button>
          </div>

          {/* Timer settings */}
          {mode === "timer" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{
                height: showTimerSettings || state === "idle" ? "auto" : 0,
                opacity: showTimerSettings || state === "idle" ? 1 : 0,
              }}
              transition={{ duration: 0.3 }}
              className="w-full mb-4 overflow-hidden"
            >
              <div className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-cyan-400 text-sm font-bold">SET TIME:</span>
                  <span className="text-white font-mono text-lg">{formatTimerDuration(timerDuration)}</span>
                </div>

                {/* Timer presets */}
                <div className="flex justify-between gap-2 mb-3">
                  {TIMER_PRESETS.map((preset) => (
                    <motion.button
                      key={preset.label}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setTimerPreset(preset.value)}
                      className={cn(
                        "bg-gray-700 text-white px-3 py-1 rounded flex-1 flex items-center justify-center transition-colors",
                        timerDuration === preset.value && "bg-cyan-900 border border-cyan-700",
                      )}
                    >
                      <span>{preset.label}</span>
                    </motion.button>
                  ))}
                </div>

                {/* Fine adjustment */}
                <div className="flex justify-between gap-2 mb-3">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => adjustTimerDuration(-60)}
                    className="bg-gray-700 text-white px-3 py-1 rounded flex-1 flex items-center justify-center"
                  >
                    <span className="mr-1">-1m</span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => adjustTimerDuration(-10)}
                    className="bg-gray-700 text-white px-3 py-1 rounded flex-1 flex items-center justify-center"
                  >
                    <span className="mr-1">-10s</span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => adjustTimerDuration(10)}
                    className="bg-gray-700 text-white px-3 py-1 rounded flex-1 flex items-center justify-center"
                  >
                    <span className="mr-1">+10s</span>
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => adjustTimerDuration(60)}
                    className="bg-gray-700 text-white px-3 py-1 rounded flex-1 flex items-center justify-center"
                  >
                    <span className="mr-1">+1m</span>
                  </motion.button>
                </div>

                {/* Slider control */}
                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => adjustTimerDuration(-1)}
                    className="bg-gray-700 text-white h-8 w-8 rounded-full flex items-center justify-center"
                    aria-label="Decrease by 1 second"
                  >
                    <Minus className="w-4 h-4" />
                  </motion.button>

                  <input
                    type="range"
                    min="10"
                    max="3600"
                    step="10"
                    value={timerDuration}
                    onChange={(e) => {
                      const newDuration = Number.parseInt(e.target.value)
                      setTimerDuration(newDuration)
                      if (state === "idle") {
                        setTime(newDuration)
                      }
                    }}
                    className="w-full accent-cyan-400 bg-gray-900 h-2 rounded-full appearance-none retro-slider"
                    aria-label="Timer duration"
                    aria-valuemin={10}
                    aria-valuemax={3600}
                    aria-valuenow={timerDuration}
                  />

                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => adjustTimerDuration(1)}
                    className="bg-gray-700 text-white h-8 w-8 rounded-full flex items-center justify-center"
                    aria-label="Increase by 1 second"
                  >
                    <Plus className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Lap section */}
          {mode === "stopwatch" && (
            <div className="w-full mt-2 overflow-y-auto max-h-32 font-mono bg-gray-900/50 rounded-lg p-2 border border-gray-800">
              <div className="text-cyan-400 text-xs mb-1 flex justify-between border-b border-gray-800 pb-1">
                <span>LAP</span>
                <span>TIME</span>
              </div>
              <div className="max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                {laps.length === 0 ? (
                  <div className="text-gray-500 text-center text-sm py-2">No laps recorded</div>
                ) : (
                  laps
                    .slice()
                    .reverse()
                    .map((lap) => (
                      <motion.div
                        key={lap.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex justify-between text-white mb-1 border-b border-gray-800/30 pb-1 last:border-0"
                      >
                        <span className="text-gray-400">Lap {lap.id}</span>
                        <span className="font-mono">{formatTime(lap.time)}</span>
                      </motion.div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Control buttons */}
        <div className="flex justify-around items-center p-4 bg-gray-800 mt-auto border-t border-gray-700">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={stopReset}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30 active:shadow-inner transition-all retro-button"
            aria-label="Stop or Reset"
          >
            <Square className="text-white w-8 h-8" />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={togglePlayPause}
            className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center shadow-lg active:shadow-inner transition-all retro-button",
              state === "running" ? "bg-yellow-500 shadow-yellow-500/30" : "bg-green-500 shadow-green-500/30",
            )}
            aria-label={state === "running" ? "Pause" : "Play"}
          >
            {state === "running" ? (
              <Pause className="text-white w-8 h-8" />
            ) : (
              <Play className="text-white w-8 h-8 ml-1" />
            )}
          </motion.button>

          {mode === "stopwatch" ? (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={addLap}
              className={cn(
                "w-16 h-16 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg shadow-cyan-500/30 active:shadow-inner transition-all retro-button",
                state !== "running" && "opacity-50 cursor-not-allowed",
              )}
              disabled={state !== "running"}
              aria-label="Record Lap"
              aria-disabled={state !== "running"}
            >
              <Flag className="text-white w-8 h-8" />
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowTimerSettings(!showTimerSettings)}
              className="w-16 h-16 rounded-full bg-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/30 active:shadow-inner transition-all retro-button"
              aria-label="Timer Settings"
              aria-expanded={showTimerSettings}
            >
              <TimerIcon className="text-white w-8 h-8" />
            </motion.button>
          )}
        </div>

        {/* Sound toggle button */}
        <button
          onClick={() => {
            setSoundEnabled(!soundEnabled)
            if (soundEnabled) playSound("click")
          }}
          className="absolute top-3 right-3 z-20 text-gray-400 hover:text-cyan-400 transition-colors"
          aria-label={soundEnabled ? "Mute sounds" : "Enable sounds"}
          aria-pressed={!soundEnabled}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>
    </motion.div>
  )
}
