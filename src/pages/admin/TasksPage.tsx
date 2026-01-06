import { useState, useEffect } from 'react'
import {
    CheckCircle2,
    Clock,
    AlertCircle,
    Search,
    Plus,
    MoreVertical,
    ExternalLink,
    Bug,
    Terminal,
    ShieldAlert,
    Inbox,
    X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface AdminTask {
    id: string
    type: 'manual' | 'bug' | 'error' | 'alert' | 'system'
    title: string
    description: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    status: 'pending' | 'in_progress' | 'done'
    source: string
    metadata: any
    created_at: string
    resolved_at: string | null
}

function CreateTaskModal({ isOpen, onClose, onSuccess }: { isOpen: boolean, onClose: () => void, onSuccess: () => void }) {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        severity: 'low',
        type: 'manual'
    })

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const token = localStorage.getItem('safespot_admin_token')
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            })

            if (response.ok) {
                onSuccess()
                onClose()
            }
        } catch (error) {
            console.error('Error creating task:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#0f172a] border border-[#1e293b] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-[#1e293b] flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Plus className="h-5 w-5 text-[#00ff88]" />
                        Nueva Tarea
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Título</label>
                        <input
                            required
                            type="text"
                            placeholder="Ej: Revisar logs de base de datos"
                            className="w-full bg-[#020617] border border-[#1e293b] rounded-xl px-4 py-3 text-white focus:border-[#00ff88]/50 outline-none transition-all"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tipo</label>
                            <select
                                className="w-full bg-[#020617] border border-[#1e293b] rounded-xl px-4 py-3 text-white focus:border-[#00ff88]/50 outline-none transition-all"
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                            >
                                <option value="manual">Manual</option>
                                <option value="bug">Bug</option>
                                <option value="system">Sistema</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Severidad</label>
                            <select
                                className="w-full bg-[#020617] border border-[#1e293b] rounded-xl px-4 py-3 text-white focus:border-[#00ff88]/50 outline-none transition-all"
                                value={formData.severity}
                                onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                            >
                                <option value="low">Baja</option>
                                <option value="medium">Media</option>
                                <option value="high">Alta</option>
                                <option value="critical">Crítica</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Descripción</label>
                        <textarea
                            rows={3}
                            placeholder="Detalles adicionales sobre la tarea..."
                            className="w-full bg-[#020617] border border-[#1e293b] rounded-xl px-4 py-3 text-white focus:border-[#00ff88]/50 outline-none transition-all resize-none"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-xl border border-[#1e293b] text-slate-400 font-bold hover:bg-[#1e293b] hover:text-white transition-all"
                        >
                            Cancelar
                        </button>
                        <Button
                            type="submit"
                            variant="neon"
                            className="flex-1"
                            disabled={loading}
                        >
                            {loading ? 'Creando...' : 'Crear Tarea'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export function TasksPage() {
    const [tasks, setTasks] = useState<AdminTask[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [filter, setFilter] = useState({
        status: '',
        severity: '',
        type: ''
    })

    const fetchTasks = async () => {
        try {
            const token = localStorage.getItem('safespot_admin_token')
            const query = new URLSearchParams(filter as any).toString()
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/tasks?${query}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            const data = await response.json()
            setTasks(data)
        } catch (error) {
            console.error('Error fetching tasks:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTasks()
        const interval = setInterval(fetchTasks, 30000) // Auto-refresh every 30s
        return () => clearInterval(interval)
    }, [filter])

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/20'
            case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/20'
            case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
            default: return 'text-blue-500 bg-blue-500/10 border-blue-500/20'
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'done': return <CheckCircle2 className="h-4 w-4 text-[#00ff88]" />
            case 'in_progress': return <Clock className="h-4 w-4 text-blue-400 animate-pulse" />
            default: return <AlertCircle className="h-4 w-4 text-slate-400" />
        }
    }

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'bug': return <Bug className="h-4 w-4" />
            case 'error': return <Terminal className="h-4 w-4" />
            case 'system': return <ShieldAlert className="h-4 w-4" />
            default: return <Inbox className="h-4 w-4" />
        }
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        Gestión de Tareas
                        <div className="h-2 w-2 rounded-full bg-[#00ff88] animate-pulse" />
                    </h1>
                    <p className="text-slate-400 mt-1">Control de eventos críticos, bugs y logs del sistema.</p>
                </div>
                <Button
                    variant="neon"
                    className="gap-2"
                    onClick={() => setIsModalOpen(true)}
                >
                    <Plus className="h-4 w-4" /> Nueva Tarea
                </Button>
            </div>

            {/* Stats Quick View */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Pendientes', value: tasks.filter(t => t.status === 'pending').length, color: 'text-[#00ff88]' },
                    { label: 'Críticas', value: tasks.filter(t => t.severity === 'critical').length, color: 'text-red-500' },
                    { label: 'Bugs Reportados', value: tasks.filter(t => t.type === 'bug').length, color: 'text-orange-500' },
                    { label: 'Resueltas hoy', value: tasks.filter(t => t.status === 'done').length, color: 'text-blue-400' },
                ].map((stat, i) => (
                    <div key={i} className="bg-[#0f172a] border border-[#1e293b] p-4 rounded-xl">
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{stat.label}</p>
                        <p className={cn("text-2xl font-bold mt-1", stat.color)}>{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center bg-[#0f172a]/50 p-4 border border-[#1e293b] rounded-xl">
                <div className="flex items-center gap-2 px-3 py-2 bg-[#020617] border border-[#1e293b] rounded-lg focus-within:border-[#00ff88]/50 transition-colors flex-1 min-w-[200px]">
                    <Search className="h-4 w-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Buscar tareas..."
                        className="bg-transparent border-none outline-none text-sm text-white w-full"
                    />
                </div>

                <select
                    className="bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#00ff88]/50 transition-colors"
                    onChange={(e) => setFilter({ ...filter, severity: e.target.value })}
                >
                    <option value="">Todas las Severidades</option>
                    <option value="critical">Crítica</option>
                    <option value="high">Alta</option>
                    <option value="medium">Media</option>
                    <option value="low">Baja</option>
                </select>

                <select
                    className="bg-[#020617] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#00ff88]/50 transition-colors"
                    onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                >
                    <option value="">Todos los Tipos</option>
                    <option value="manual">Manual</option>
                    <option value="bug">Bug</option>
                    <option value="error">Error</option>
                </select>
            </div>

            {/* Tasks List */}
            <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#1e293b]/50 border-b border-[#1e293b]">
                                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider uppercase">Evento</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider uppercase">Severidad</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider uppercase">Estado</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider uppercase">Fecha</th>
                                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider uppercase text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1e293b]">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="h-6 w-6 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin" />
                                            Cargando tareas...
                                        </div>
                                    </td>
                                </tr>
                            ) : tasks.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center text-slate-500">
                                        <Inbox className="h-10 w-10 mx-auto mb-4 opacity-20" />
                                        No se encontraron tareas.
                                    </td>
                                </tr>
                            ) : (
                                tasks.map((task) => (
                                    <tr
                                        key={task.id}
                                        className={cn(
                                            "group hover:bg-[#1e293b]/30 transition-colors",
                                            task.severity === 'critical' ? 'bg-red-500/5' : ''
                                        )}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex gap-4">
                                                <div className={cn(
                                                    "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border",
                                                    task.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                                                        task.type === 'bug' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' :
                                                            'bg-blue-500/10 border-blue-500/20 text-blue-500'
                                                )}>
                                                    {getTypeIcon(task.type)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-white text-sm truncate max-w-[300px]">{task.title}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5 uppercase tracking-tighter">Source: {task.source} • ID: {task.id.split('-')[0]}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                                getSeverityColor(task.severity)
                                            )}>
                                                {task.severity}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(task.status)}
                                                <span className="text-xs font-medium text-slate-300 capitalize">
                                                    {task.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm text-white">{new Date(task.created_at).toLocaleDateString()}</span>
                                                <span className="text-[10px] text-slate-500 font-mono">{new Date(task.created_at).toLocaleTimeString()}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button className="p-2 text-slate-400 hover:text-[#00ff88] bg-[#020617] rounded-lg border border-[#1e293b] transition-all hover:scale-105">
                                                    <ExternalLink className="h-4 w-4" />
                                                </button>
                                                <button className="p-2 text-slate-400 hover:text-white bg-[#020617] rounded-lg border border-[#1e293b] transition-all hover:scale-105">
                                                    <MoreVertical className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <CreateTaskModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchTasks}
            />
        </div>
    )
}
