"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  ImagePlus,
  Loader2,
  Save,
  Sparkles,
  Plus,
  Info,
  X,
  Check,
  FolderPlus,
  ChevronRight,
  Lock,
  Globe2,
  Users
} from "lucide-react"
import { Header } from "@/components/header"

interface CreatorModel {
  providerKey: string
  modelKey: string
  displayName: string
  description: string | null
}

interface GenerationJobItem {
  id: string
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled"
  prompt: string
  modelKey: string
  providerKey: string
  createdAt: string
  resultImage: {
    id: string
    url: string
    created_at: string
  } | null
}

interface BoardItem {
  id: string
  title: string
  visibility: "public" | "private" | "collab"
}

const PROMPT_STARTERS = [
  "editorial fashion",
  "streetwear concept",
  "luxury minimal",
  "cinematic film",
  "cyberpunk aesthetic",
] as const

export default function CreatePage() {
  const [prompt, setPrompt] = useState("")
  const [models, setModels] = useState<CreatorModel[]>([])
  const [selectedModel, setSelectedModel] = useState("")
  const [jobs, setJobs] = useState<GenerationJobItem[]>([])
  const [boards, setBoards] = useState<BoardItem[]>([])
  const [selectedBoardId, setSelectedBoardId] = useState("")
  
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [savingImageId, setSavingImageId] = useState<string | null>(null)
  const [remainingToday, setRemainingToday] = useState<number>(0)
  const [dailyLimit, setDailyLimit] = useState<number>(5)
  const [error, setError] = useState<string | null>(null)

  // Estados del Modal
  const [isBoardModalOpen, setIsBoardModalOpen] = useState(false)
  const [showCreateInput, setShowCreateInput] = useState(false)
  const [newBoardTitle, setNewBoardTitle] = useState("")
  const [isCreatingBoard, setIsCreatingBoard] = useState(false)

  const selectedBoard = useMemo(() => 
    boards.find(b => b.id === selectedBoardId), 
  [boards, selectedBoardId])

  const usagePercent = useMemo(() => {
    if (!dailyLimit || dailyLimit <= 0) return 0
    return Math.max(0, Math.min(100, Math.round(((dailyLimit - remainingToday) / dailyLimit) * 100)))
  }, [dailyLimit, remainingToday])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const [modelsRes, jobsRes, boardsRes] = await Promise.all([
          fetch("/api/generation/models", { cache: "no-store" }),
          fetch("/api/generation/jobs?limit=40", { cache: "no-store" }),
          fetch("/api/boards?scope=mine&limit=100", { cache: "no-store" }),
        ])

        const modelsPayload = await modelsRes.json()
        const jobsPayload = await jobsRes.json()
        const boardsPayload = boardsRes.ok ? await boardsRes.json() : { items: [] }

        if (!mounted) return

        setModels(modelsPayload.models)
        const nanoBana = modelsPayload.models.find((m: CreatorModel) => 
          m.displayName.toLowerCase().includes("nano") || m.modelKey.toLowerCase().includes("nano")
        )
        setSelectedModel(nanoBana?.modelKey || modelsPayload.defaultModelKey || "")
        
        setJobs(jobsPayload.items)
        setDailyLimit(jobsPayload.dailyFreeLimit ?? 5)
        setRemainingToday(jobsPayload.remainingToday ?? 0)
        setBoards(boardsPayload.items)
        if (boardsPayload.items.length > 0) setSelectedBoardId(boardsPayload.items[0].id)
      } catch {
        if (mounted) setError("Error de conexión.")
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void load()
    return () => { mounted = false }
  }, [])

  const createImage = async () => {
    if (!prompt.trim()) return
    setGenerating(true)
    setError(null)
    try {
      const response = await fetch("/api/generation/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, modelKey: selectedModel, aspectRatio: "9:16" }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error)
      if (payload.item) setJobs((prev) => [payload.item!, ...prev])
      if (payload.usage) {
        setDailyLimit(payload.usage.dailyFreeLimit)
        setRemainingToday(payload.usage.remainingToday)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error")
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveToBoard = async (imageId: string) => {
    if (!selectedBoardId) {
      setIsBoardModalOpen(true)
      return
    }
    setSavingImageId(imageId)
    try {
      await fetch(`/api/boards/${selectedBoardId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId }),
      })
    } finally {
      setSavingImageId(null)
    }
  }

  const createQuickBoard = async () => {
    if (!newBoardTitle.trim()) return
    setIsCreatingBoard(true)
    try {
      const res = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newBoardTitle, visibility: "private" }),
      })
      const data = await res.json()
      if (res.ok && data.item) {
        setBoards(prev => [data.item, ...prev])
        setSelectedBoardId(data.item.id)
        setNewBoardTitle("")
        setShowCreateInput(false)
        setIsBoardModalOpen(false)
      }
    } finally {
      setIsCreatingBoard(false)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
      <Header />
      
      <div className="pt-[72px] max-w-[1600px] mx-auto flex flex-col h-screen overflow-hidden">
        
        {/* COMMAND DECK SUPERIOR */}
        <section className="bg-card/40 backdrop-blur-3xl border-b border-border/10 p-4 lg:p-6 z-20">
          <div className="max-w-5xl mx-auto space-y-4">
            
            <div className="relative flex flex-col md:flex-row gap-2 bg-surface border border-border/20 rounded-2xl p-2 shadow-2xl focus-within:border-primary/40 transition-all duration-300">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Visualiza tu próxima creación..."
                className="flex-1 bg-transparent border-none px-4 py-3 text-sm focus:ring-0 resize-none h-12 md:h-auto placeholder:text-muted-foreground/20 font-medium"
              />
              <button
                onClick={() => void createImage()}
                disabled={generating || !prompt.trim()}
                className="bg-primary text-black px-10 py-3 rounded-xl font-display font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all disabled:opacity-30 disabled:grayscale"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? "Generando" : "Generar"}
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 px-1">
              <div className="flex items-center gap-2">
                <div className="flex bg-surface/50 rounded-lg border border-border/10 p-1">
                  {PROMPT_STARTERS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setPrompt(p => p ? `${p}, ${s}` : s)}
                      className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors border-r last:border-none border-border/5"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
                  <div className="flex items-center gap-2 bg-surface/30 px-3 py-1.5 rounded-full border border-border/5">
                    <span className="text-primary">{remainingToday}/{dailyLimit}</span>
                    <div className="w-10 h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${usagePercent}%` }} />
                    </div>
                  </div>
                </div>

                {/* SELECTOR DE DESTINO - UI MEJORADA */}
                <button 
                  onClick={() => setIsBoardModalOpen(true)}
                  className="flex items-center gap-3 bg-surface border border-border/20 hover:border-primary/40 px-4 py-2 rounded-xl transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Save className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-[8px] uppercase font-black text-muted-foreground tracking-tighter leading-none">Guardar en</p>
                    <p className="text-[10px] font-bold uppercase text-foreground tracking-wider leading-tight max-w-[120px] truncate">
                      {selectedBoard?.title || "Elegir Tablero"}
                    </p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ÁREA DE RESULTADOS */}
        <section className="flex-1 overflow-y-auto p-4 lg:p-8 scrollbar-hide">
          <div className="max-w-[1500px] mx-auto">
            <AnimatePresence mode="popLayout">
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="aspect-[9/16] rounded-[24px] bg-surface/30 animate-pulse border border-border/5" />
                  ))}
                </div>
              ) : (
                <motion.div 
                  layout
                  className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-8"
                >
                  {jobs.map((job) => (
                    <ArtCard 
                      key={job.id} 
                      job={job} 
                      onSave={() => void handleSaveToBoard(job.resultImage!.id)}
                      isSaving={savingImageId === job.resultImage?.id}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </div>

      {/* MODAL DE TABLEROS - REDISEÑADO PARA MÁXIMA PROFESIONALIDAD */}
      <AnimatePresence>
        {isBoardModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setIsBoardModalOpen(false); setShowCreateInput(false); }}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-card border border-border/20 rounded-[32px] shadow-[0_32px_128px_rgba(0,0,0,0.8)] overflow-hidden"
            >
              {/* Header */}
              <div className="p-8 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-display font-black uppercase tracking-tighter text-foreground italic">Mis Colecciones</h3>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">Organiza tu flujo creativo</p>
                </div>
                <button 
                  onClick={() => setIsBoardModalOpen(false)} 
                  className="w-10 h-10 flex items-center justify-center bg-surface border border-border/10 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Lista de Tableros con más prioridad visual */}
              <div className="px-4 py-2 max-h-[400px] overflow-y-auto scrollbar-hide space-y-2">
                {boards.length === 0 && !showCreateInput && (
                  <div className="py-12 text-center opacity-20">
                    <FolderPlus className="w-12 h-12 mx-auto mb-4" />
                    <p className="text-[10px] uppercase font-black tracking-[0.3em]">Sin Tableros</p>
                  </div>
                )}
                
                {boards.map((board) => (
                  <button
                    key={board.id}
                    onClick={() => { setSelectedBoardId(board.id); setIsBoardModalOpen(false); }}
                    className={`w-full group flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${
                      selectedBoardId === board.id 
                        ? "bg-primary/10 border border-primary/30" 
                        : "bg-surface/30 border border-border/5 hover:border-border/20 hover:bg-surface/60"
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-colors ${
                      selectedBoardId === board.id ? "bg-primary text-black border-primary" : "bg-background text-muted-foreground border-border/10 group-hover:border-primary/30 group-hover:text-primary"
                    }`}>
                      {board.visibility === 'private' ? <Lock className="w-5 h-5" /> : board.visibility === 'public' ? <Globe2 className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 text-left">
                      <p className={`text-sm font-bold uppercase tracking-wide ${selectedBoardId === board.id ? "text-primary" : "text-foreground"}`}>
                        {board.title}
                      </p>
                      <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5 opacity-60">
                        {board.visibility}
                      </p>
                    </div>
                    {selectedBoardId === board.id && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-black" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Acciones de Creación - UX Profesional */}
              <div className="p-8 pt-4">
                <AnimatePresence mode="wait">
                  {!showCreateInput ? (
                    <motion.button
                      key="add-btn"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      onClick={() => setShowCreateInput(true)}
                      className="w-full py-4 rounded-2xl border border-dashed border-border/20 hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-primary flex items-center justify-center gap-3 transition-all duration-300 group"
                    >
                      <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">Crear Nueva Colección</span>
                    </motion.button>
                  ) : (
                    <motion.div
                      key="input-area"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="space-y-4"
                    >
                      <div className="relative">
                        <input
                          autoFocus
                          type="text"
                          value={newBoardTitle}
                          onChange={(e) => setNewBoardTitle(e.target.value)}
                          placeholder="Nombre de la colección..."
                          className="w-full bg-surface border border-primary/30 rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 outline-none transition-all pr-32"
                          onKeyDown={(e) => e.key === 'Enter' && void createQuickBoard()}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                           <button 
                             onClick={() => setShowCreateInput(false)}
                             className="px-3 py-2 text-[9px] font-black uppercase text-muted-foreground hover:text-foreground"
                           >
                             Cancelar
                           </button>
                           <button 
                             onClick={() => void createQuickBoard()}
                             disabled={!newBoardTitle.trim() || isCreatingBoard}
                             className="bg-primary text-black px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest disabled:opacity-30"
                           >
                             {isCreatingBoard ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Crear"}
                           </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  )
}

function ArtCard({ job, onSave, isSaving }: { 
  job: GenerationJobItem, 
  onSave: () => void, 
  isSaving: boolean
}) {
  const isSucceeded = job.status === "succeeded"
  const isFailed = job.status === "failed"

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="group relative"
    >
      <div className="relative aspect-[9/16] rounded-[28px] overflow-hidden bg-surface border border-border/10 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:border-primary/50 group-hover:shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
        
        {job.resultImage ? (
          <>
            <img
              src={job.resultImage.url}
              alt={job.prompt}
              className="w-full h-full object-cover transition-all duration-1000 ease-out group-hover:scale-110 group-hover:brightness-[0.4] group-hover:blur-[2px]"
            />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col items-center justify-center p-8 text-center">
              <div className="absolute top-8 left-8 right-8">
                 <div className="w-8 h-px bg-primary/30 mx-auto mb-4" />
                 <p className="text-[10px] text-white/90 font-medium italic line-clamp-6 leading-relaxed tracking-wider">
                  "{job.prompt}"
                 </p>
                 <div className="w-8 h-px bg-primary/30 mx-auto mt-4" />
              </div>
              
              <button
                onClick={onSave}
                disabled={isSaving}
                className="mt-20 bg-primary text-black px-10 py-4 rounded-full text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3 hover:bg-white hover:scale-105 active:scale-95 transition-all shadow-[0_10px_30px_rgba(209,254,23,0.3)]"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? "Guardando" : "Guardar"}
              </button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/80 backdrop-blur-sm">
            {!isFailed ? (
              <div className="flex flex-col items-center gap-6">
                 <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-[3px] border-primary/10 rounded-full" />
                    <div className="absolute inset-0 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-[0.5em] text-primary/40 animate-pulse ml-2">Revelando</span>
              </div>
            ) : (
              <div className="text-center p-8">
                <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-destructive/20">
                  <X className="w-6 h-6 text-destructive/40" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-destructive/40">Fallo de Motor</p>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.article>
  )
}
