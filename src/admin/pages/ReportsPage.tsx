import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Search, Loader2 } from 'lucide-react';

export function ReportsPage() {
    const [page] = useState(1); // Removed setPage
    const [search, setSearch] = useState('');

    const { isLoading } = useQuery({ // Removed data
        queryKey: ['admin', 'reports', page, search],
        queryFn: async () => {
            const token = localStorage.getItem('safespot_admin_token');
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/reports?page=${page}&search=${search}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch reports');
            return res.json();
        }
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <FileText className="h-6 w-6 text-blue-400" />
                        Todos los Reportes
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Explorador global de reportes</p>
                </div>
                {/* Search - Placeholder logic */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        className="bg-[#0f172a] border border-[#1e293b] rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 w-64"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-[#0f172a] rounded-xl border border-[#1e293b] p-6 text-center text-slate-500">
                {isLoading ? (
                    <div className="flex justify-center items-center gap-2">
                        <Loader2 className="animate-spin h-5 w-5" />
                        Cargando...
                    </div>
                ) : (
                    <p>Tabla de reportes próximamente (Usar Moderación para contenido conflictivo)</p>
                )}
            </div>
        </div>
    );
}
