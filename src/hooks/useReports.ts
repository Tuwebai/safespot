import { useState } from 'react'
import { reportsApi, type CreateReportData } from '@/lib/api'
import { useNavigate } from 'react-router-dom'

export interface CreateReportPayload extends CreateReportData {
  image_urls?: string[]
  incident_date?: string
}

export function useCreateReport() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const createReport = async (data: CreateReportPayload) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const result = await reportsApi.create(data)
      navigate(`/reporte/${result.id}`)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create report')
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  return {
    createReport,
    isLoading,
    error
  }
}

