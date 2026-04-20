import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'

export function useVrmScene() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
    const sceneRef = useRef<THREE.Scene | null>(null)
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
    const controlsRef = useRef<OrbitControls | null>(null)
    const vrmRef = useRef<VRM | null>(null)
    const animFrameRef = useRef<number>(0)
    const clockRef = useRef(new THREE.Clock())

    const [isLoading, setIsLoading] = useState(false)
    const [vrmName, setVrmName] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    // ── Szene initialisieren ──────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const parent = canvas.parentElement!

        // Renderer
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
        renderer.setPixelRatio(window.devicePixelRatio)
        renderer.setSize(parent.clientWidth, parent.clientHeight)
        renderer.outputColorSpace = THREE.SRGBColorSpace
        rendererRef.current = renderer

        // Szene
        const scene = new THREE.Scene()
        sceneRef.current = scene

        // Kamera – auf Brusthöhe, leicht herausgezoomt
        const camera = new THREE.PerspectiveCamera(
            30,
            parent.clientWidth / parent.clientHeight,
            0.1,
            20
        )
        camera.position.set(0, 1.3, 3.5)
        cameraRef.current = camera

        // Beleuchtung
        scene.add(new THREE.AmbientLight(0xffffff, 0.7))
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
        dirLight.position.set(1, 2, 2)
        scene.add(dirLight)
        const rimLight = new THREE.DirectionalLight(0x8899ff, 0.3)
        rimLight.position.set(-1, 1, -2)
        scene.add(rimLight)

        // OrbitControls – Maus-Navigation
        const controls = new OrbitControls(camera, renderer.domElement)
        controls.target.set(0, 1.0, 0)
        controls.enableDamping = true
        controls.dampingFactor = 0.06
        controls.minDistance = 0.5
        controls.maxDistance = 8
        controls.update()
        controlsRef.current = controls

        // Animations-Loop
        function animate() {
            animFrameRef.current = requestAnimationFrame(animate)
            const delta = clockRef.current.getDelta()
            vrmRef.current?.update(delta)
            controls.update()
            renderer.render(scene, camera)
        }
        animate()

        // Resize-Handler
        const onResize = () => {
            const w = parent.clientWidth
            const h = parent.clientHeight
            renderer.setSize(w, h)
            camera.aspect = w / h
            camera.updateProjectionMatrix()
        }
        const ro = new ResizeObserver(onResize)
        ro.observe(parent)

        return () => {
            cancelAnimationFrame(animFrameRef.current)
            ro.disconnect()
            controls.dispose()
            renderer.dispose()
        }
    }, [])

    // ── VRM laden ─────────────────────────────────────────────────
    const loadVRM = useCallback(async (file: File) => {
  const scene = sceneRef.current
  if (!scene) return

  setIsLoading(true)
  setError(null)

  let blobUrl: string | null = null

  try {
    // Vorheriges Modell entfernen
    if (vrmRef.current) {
      scene.remove(vrmRef.current.scene)
      VRMUtils.deepDispose(vrmRef.current.scene)
      vrmRef.current = null
    }

    // Datei über Hauptprozess lesen (Node.js fs — kein fetch)
    const filePath = window.api.getPathForFile(file)
    const uint8Array = await window.api.readFile(filePath)

    // Blob aus dem Buffer erzeugen und als lokale URL bereitstellen.
    // Ein selbst erzeugter Blob ist ein Renderer-seitiges Objekt —
    // fetch() auf blob:-URLs funktioniert in Electrons Renderer-Kontext.
    const blob = new Blob([uint8Array.buffer as ArrayBuffer], { type: 'model/gltf-binary' })
    blobUrl = URL.createObjectURL(blob)

    const loader = new GLTFLoader()
    loader.register(parser => new VRMLoaderPlugin(parser))

    const gltf = await loader.loadAsync(blobUrl)

    const vrm = gltf.userData.vrm as VRM | undefined
    if (!vrm) throw new Error('VRMLoaderPlugin hat das Modell nicht erkannt')

    // rotateVRM0 nur für VRM 0.x
    const version = (vrm.meta as any)?.metaVersion ?? (vrm.meta as any)?.specVersion
    if (version === '0' || version === undefined) {
      VRMUtils.rotateVRM0(vrm)
    }

    scene.add(vrm.scene)
    vrmRef.current = vrm
    setVrmName(file.name.replace(/\.vrm$/i, ''))

  } catch (e) {
    console.error('[VRM Load Error]', e)
    setError(`Ladefehler: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    if (blobUrl) URL.revokeObjectURL(blobUrl)
    setIsLoading(false)
  }
}, [])

    return { canvasRef, loadVRM, isLoading, vrmName, error }
}