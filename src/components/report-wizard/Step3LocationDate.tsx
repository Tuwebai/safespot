import { AlertCircle, MapPin, Calendar } from 'lucide-react'
import { LocationSelector } from '@/components/LocationSelector'
import { VisualDatePicker } from '@/components/VisualDatePicker'
import { UseFormReturn } from 'react-hook-form'
import { WizardFormData } from './useReportWizard'

interface Step3LocationDateProps {
    form: UseFormReturn<WizardFormData>
    onLocationChange: (location: any) => void
    onDateChange: (date: string) => void
}

export function Step3LocationDate({ form, onLocationChange, onDateChange }: Step3LocationDateProps) {
    const { watch, formState: { errors } } = form
    const location = watch('location')
    const incidentDate = watch('incidentDate')

    return (
        <div className="space-y-6">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">
                    ¿Dónde y cuándo?
                </h2>
                <p className="text-slate-400">
                    La ubicación ayuda a otros a estar alertas en la zona
                </p>
            </div>

            {/* Location Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-[#00ff88]" />
                    <h3 className="text-lg font-semibold text-white">
                        Ubicación <span className="text-[#00ff88]">*</span>
                    </h3>
                </div>
                
                <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4">
                    <LocationSelector
                        value={location || { location_name: '', latitude: undefined, longitude: undefined }}
                        onChange={onLocationChange}
                        error={errors.location?.location_name?.message}
                    />
                    {errors.location?.latitude && (
                        <div className="flex items-center gap-1 mt-2 text-sm text-red-400">
                            <AlertCircle className="h-4 w-4" />
                            Selecciona una ubicación válida en el mapa
                        </div>
                    )}
                </div>

                <div className="bg-[#1e293b]/50 border border-[#334155] rounded-lg p-4">
                    <h4 className="text-sm font-medium text-[#00ff88] mb-2">
                        💡 Consejos de ubicación
                    </h4>
                    <ul className="text-sm text-slate-400 space-y-1">
                        <li>• Señalá la esquina o dirección más cercana</li>
                        <li>• Si fue en un negocio, mencioná el nombre</li>
                        <li>• No uses tu dirección exacta de casa</li>
                    </ul>
                </div>
            </div>

            {/* Date Section */}
            <div className="space-y-4 pt-4 border-t border-[#1e293b]">
                <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-[#00ff88]" />
                    <h3 className="text-lg font-semibold text-white">
                        Fecha del incidente <span className="text-[#00ff88]">*</span>
                    </h3>
                </div>

                <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4">
                    <VisualDatePicker
                        value={incidentDate || ''}
                        onChange={onDateChange}
                        error={errors.incidentDate?.message}
                    />
                </div>

                <p className="text-xs text-slate-500">
                    Seleccioná la fecha más cercana que recuerdes. Si fue hoy, dejá la fecha actual.
                </p>
            </div>
        </div>
    )
}
