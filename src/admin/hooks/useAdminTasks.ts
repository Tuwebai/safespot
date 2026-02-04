import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/toast/useToast'

export interface AdminTask {
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

const API_BASE = `${import.meta.env.VITE_API_URL}/api/admin/tasks`

export const useAdminTasks = (filter?: Record<string, string>) => {
    const queryClient = useQueryClient()
    const { error: showError } = useToast()

    // 1. Fetch Query
    const query = useQuery<AdminTask[]>({
        queryKey: ['admin-tasks', filter],
        queryFn: async () => {
            const token = localStorage.getItem('safespot_admin_token')
            const searchParams = new URLSearchParams(filter as any).toString()
            const res = await fetch(`${API_BASE}?${searchParams}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!res.ok) throw new Error('Error fetching tasks')
            return res.json()
        },
        // ❌ ENTERPRISE RULE: NO POLLING
        // State is authoritative on client. We do not poll.
        // refetchInterval is deliberately removed.
        staleTime: 5 * 60 * 1000, // 5 minutes fresh
    })

    // 2. Create Task Mutation (Optimistic)
    const createTask = useMutation({
        mutationFn: async (newTask: Partial<AdminTask>) => {
            const token = localStorage.getItem('safespot_admin_token')
            const res = await fetch(API_BASE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(newTask)
            })
            if (!res.ok) throw new Error('Failed to create task')
            return res.json()
        },
        onMutate: async (newTask) => {
            await queryClient.cancelQueries({ queryKey: ['admin-tasks'] })
            const previousTasks = queryClient.getQueryData<AdminTask[]>(['admin-tasks'])

            // Optimistic Update
            const optimisticTask: AdminTask = {
                id: (newTask.id as string) || crypto.randomUUID(), // Ensure client ID
                title: newTask.title || 'Untitled',
                description: newTask.description || '',
                severity: newTask.severity || 'low',
                type: newTask.type || 'manual',
                status: 'pending',
                source: 'manual',
                created_at: new Date().toISOString(),
                resolved_at: null,
                metadata: {}
            }

            queryClient.setQueryData<AdminTask[]>(['admin-tasks', filter], (old) => {
                return old ? [optimisticTask, ...old] : [optimisticTask]
            })

            return { previousTasks }
        },
        onError: (_err, _newTask, context) => {
            showError('Error al crear la tarea. Revertiendo cambios.')
            if (context?.previousTasks) {
                queryClient.setQueryData(['admin-tasks', filter], context.previousTasks)
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-tasks'] })
        }
    })

    // 3. Update Task Mutation (Optimistic)
    const updateTask = useMutation({
        mutationFn: async ({ id, status }: { id: string, status: string }) => {
            const token = localStorage.getItem('safespot_admin_token')
            const res = await fetch(`${API_BASE}/${id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status })
            })
            if (!res.ok) throw new Error('Failed to update task')
            return res.json()
        },
        onMutate: async ({ id, status }) => {
            await queryClient.cancelQueries({ queryKey: ['admin-tasks'] })
            const previousTasks = queryClient.getQueryData<AdminTask[]>(['admin-tasks'])

            queryClient.setQueryData<AdminTask[]>(['admin-tasks', filter], (old) => {
                return (old || []).map(t =>
                    t.id === id ? { ...t, status: status as any } : t
                )
            })

            return { previousTasks }
        },
        onError: (_err, _variables, context) => {
            showError('Error al actualizar. Revertiendo.')
            if (context?.previousTasks) {
                queryClient.setQueryData(['admin-tasks', filter], context.previousTasks)
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-tasks'] })
        }
    })

    // 4. Delete Task Mutation (Optimistic)
    const deleteTask = useMutation({
        mutationFn: async (id: string) => {
            const token = localStorage.getItem('safespot_admin_token')
            const res = await fetch(`${API_BASE}/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!res.ok) throw new Error('Failed to delete task')
            return res.json()
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ['admin-tasks'] })
            const previousTasks = queryClient.getQueryData<AdminTask[]>(['admin-tasks'])

            queryClient.setQueryData<AdminTask[]>(['admin-tasks', filter], (old) => {
                return (old || []).filter(t => t.id !== id)
            })

            return { previousTasks }
        },
        onError: (_err, _id, context) => {
            showError('Error al eliminar. Revertiendo.')
            if (context?.previousTasks) {
                queryClient.setQueryData(['admin-tasks', filter], context.previousTasks)
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-tasks'] })
        }
    })

    // 5. BULK: Resolve All Tasks (Optimistic)
    const resolveAllTasks = useMutation({
        mutationFn: async () => {
            const token = localStorage.getItem('safespot_admin_token')
            const res = await fetch(`${API_BASE}/resolve-all`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!res.ok) throw new Error('Failed to resolve all tasks')
            return res.json()
        },
        onMutate: async () => {
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: ['admin-tasks'] })

            // Snapshot the previous value
            const previousQueries = queryClient.getQueriesData<AdminTask[]>({ queryKey: ['admin-tasks'] })

            // Optimistically update to the new value
            queryClient.setQueriesData<AdminTask[]>({ queryKey: ['admin-tasks'] }, (old) => {
                if (!old) return []
                return old.map(task => ({
                    ...task,
                    status: 'done',
                    resolved_at: new Date().toISOString()
                }))
            })

            // Return a context object with the snapshotted value
            return { previousQueries }
        },
        onError: (_err, _variables, context) => {
            showError('Error al resolver tareas. Revertiendo.')
            // Rollback all queries
            if (context?.previousQueries) {
                context.previousQueries.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data)
                })
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-tasks'] })
        }
    })

    // 6. BULK: Delete All Tasks (Optimistic)
    const deleteAllTasks = useMutation({
        mutationFn: async () => {
            const token = localStorage.getItem('safespot_admin_token')
            const res = await fetch(API_BASE, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!res.ok) throw new Error('Failed to delete all tasks')
            return res.json()
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ['admin-tasks'] })
            const previousQueries = queryClient.getQueriesData<AdminTask[]>({ queryKey: ['admin-tasks'] })

            // Optimistically delete all
            queryClient.setQueriesData<AdminTask[]>({ queryKey: ['admin-tasks'] }, () => [])

            return { previousQueries }
        },
        onError: (_err, _variables, context) => {
            showError('Error al eliminar tareas. Revertiendo.')
            if (context?.previousQueries) {
                context.previousQueries.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data)
                })
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-tasks'] })
        }
    })

    return {
        tasks: query.data || [],
        isLoading: query.isLoading,
        createTask,
        updateTask,
        deleteTask,
        resolveAllTasks,
        deleteAllTasks,
        refetch: query.refetch
    }
}
