import { Textarea } from '@/components/ui/textarea'
import { AlertCircle, Lightbulb } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import { WizardFormData } from './useReportWizard'

interface Step2DescriptionProps {
    form: UseFormReturn<WizardFormData>
}

export function Step2Description({ form }: Step2DescriptionProps) {
    const { register, formState: { errors }, watch } = form
    const description = watch('description') || ''
    const charCount = description.length
    const minChars = 20
    const maxChars = 2000

    const getTips = (category: string) => {
        const tips: Record<string, string[]> = {
            'Autos': [
                'Patente, marca, modelo y color',
                'Dirección exacta o esquina del robo',
                'Horario aproximado',
                '¿Había cámaras en la zona?',
                'Características distintivas (rayones, abolladuras)'
            ],
            'Bicicletas': [
                'Marca, modelo y color principal',
                'Tipo de cuadro y rodado',
                'Número de serie si lo tenés',
                'Accesorios (luces, canasto, etc.)',
                'Cómo estaba asegurada (cadena, U-lock)'
            ],
            'Celulares': [
                'Marca, modelo y color',
                'Funda (color, diseño)',
                'Protector de pantalla',
                'IMEI (en la caja o factura)',
                'Última ubicación conocida'
            ],
            'default': [
                'Marca, modelo y color exacto',
                'Número de serie o IMEI si aplica',
                'Características únicas (rayas, stickers)',
                'Dónde y cuándo ocurrió',
                'Si había testigos o cámaras'
            ]
        }
        return tips[category] || tips['default']
    }

    return (
        <div className="space-y-6">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">
                    Contanos los detalles
                </h2>
                <p className="text-slate-400">
                    Cuanta más información, mejor chance de recuperarlo
                </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label htmlFor="description" className="block text-sm font-medium text-white">
                        Descripción <span className="text-[#00ff88]">*</span>
                    </label>
                    <span className={cn(
                        "text-xs font-mono",
                        charCount < minChars ? "text-slate-500" : 
                        charCount > maxChars ? "text-red-400" : "text-[#00ff88]"
                    )}>
                        {charCount}/{maxChars}
                    </span>
                </div>
                <Textarea
                    id="description"
                    {...register('description')}
                    placeholder="Describe el incidente en detalle: cómo ocurrió, características del objeto, cualquier información que pueda ayudar a identificarlo..."
                    rows={6}
                    className={errors.description ? 'border-red-500' : ''}
                />
                {errors.description && (
                    <div className="flex items-center gap-1 text-sm text-red-400">
                        <AlertCircle className="h-4 w-4" />
                        {errors.description.message}
                    </div>
                )}
                {charCount < minChars && charCount > 0 && (
                    <p className="text-xs text-amber-400">
                        Mínimo {minChars} caracteres (faltan {minChars - charCount})
                    </p>
                )}
            </div>

            {/* Tips Card */}
            <div className="bg-[#1e293b]/50 border border-[#334155] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="h-5 w-5 text-[#00ff88]" />
                    <h3 className="text-sm font-semibold text-white">
                        Información útil para incluir
                    </h3>
                </div>
                <ul className="grid grid-cols-1 gap-2">
                    {getTips('').map((tip, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-slate-400">
                            <span className="text-[#00ff88] mt-0.5">•</span>
                            {tip}
                        </li>
                    ))}
                </ul>
            </div>

            {/* Privacy Note */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <p className="text-sm text-blue-300">
                    🔒 Tu reporte es público pero tu identidad permanece anónima. 
                    No incluyas datos personales como DNI o dirección exacta de tu hogar.
                </p>
            </div>
        </div>
    )
}

function cn(...classes: (string | boolean | undefined)[]) {
    return classes.filter(Boolean).join(' ')
}
