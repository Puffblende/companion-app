import { useRef, useCallback } from 'react'
import { useVrmScene } from './useVrmScene'

export function VrmViewer() {
  const { canvasRef, loadVRM, isLoading, vrmName, error } = useVrmScene()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadVRM(file)
    // Input zurücksetzen damit dieselbe Datei nochmal geladen werden kann
    e.target.value = ''
  }, [loadVRM])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.name.toLowerCase().endsWith('.vrm')) loadVRM(file)
  }, [loadVRM])

  return (
    <div
      className="relative w-full h-full"
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
    >
      {/* Three.js Canvas */}
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Overlay: kein Modell geladen */}
      {!vrmName && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          {/* Punkt-Raster */}
          <div
            className="absolute inset-0 opacity-5 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, #a1a1aa 1px, transparent 1px)',
              backgroundSize: '32px 32px'
            }}
          />
          <div className="relative z-10 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-zinc-700 flex items-center justify-center text-zinc-600 text-3xl">
              ↑
            </div>
            <p className="text-zinc-500 text-sm">VRM-Datei hier ablegen</p>
            <p className="text-zinc-700 text-xs">oder</p>
            <button
              className="px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm hover:bg-zinc-700 active:scale-95 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              Datei auswählen
            </button>
          </div>
        </div>
      )}

      {/* Overlay: Ladeanimation */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-zinc-400 text-sm">Lade VRM-Modell…</p>
          </div>
        </div>
      )}

      {/* Fehler-Toast */}
      {error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-red-950 border border-red-800 text-red-300 text-sm px-4 py-2 rounded-xl whitespace-nowrap">
          {error}
        </div>
      )}

      {/* Badge: geladenes Modell */}
      {vrmName && !isLoading && (
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="bg-zinc-900/80 text-zinc-400 text-xs px-3 py-1 rounded-full border border-zinc-800 backdrop-blur-sm">
            {vrmName}
          </span>
          <button
            className="bg-zinc-900/80 text-zinc-500 text-xs px-2 py-1 rounded-full border border-zinc-800 hover:text-zinc-300 backdrop-blur-sm transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            Wechseln
          </button>
        </div>
      )}

      {/* Steuerungs-Hinweis */}
      {vrmName && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <p className="text-zinc-700 text-xs bg-zinc-900/60 px-3 py-1 rounded-full backdrop-blur-sm">
            Linksklick drehen · Rechtsklick verschieben · Scroll zoomen
          </p>
        </div>
      )}

      {/* Verstecktes File-Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".vrm"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}