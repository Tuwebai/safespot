import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { AlertCircle } from 'lucide-react'
import { ALL_CATEGORIES } from '@/lib/constants'
import { UseFormReturn } from 'react-hook-form'
import { WizardFormData } from './useReportWizard'

interface Step1BasicInfoProps {
    form: UseFormReturn<WizardFormData>
}

export function Step1BasicInfo({ form }: Step1BasicInfoProps) {
    const { register, formState: { errors }, watch } = form
    const category = watch('category')

    const getCategoryPlaceholder = (cat: string) => {
        const placeholders: Record<string, string> = {
            'Autos': 'Ej: Robo de auto VW Gol rojo estacionado en Av. Corrientes',
            'Bicicletas': 'Ej: Robo de bicicleta Trek azul del frente del supermercado',
            'Celulares': 'Ej: Robo de iPhone 14 Pro en zona de bares',
            'Laptops': 'Ej: Robo de notebook Dell de mochila en café',
            'Motos': 'Ej: Robo de moto Honda CG 150 negra',
        }
        return placeholders[cat] || 'Ej: Describe brevemente lo que se robó'
    }

    return (
        <div className="space-y-6">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-white mb-2">
                    ¿Qué se robó?
                </h2>
                <p className="text-slate-400">
                    Comenzá con la información básica del incidente
                </p>
            </div>

            {/* Category Selection */}
            <div className="space-y-2">
                <label htmlFor="category" className="block text-sm font-medium text-white">
                    Categoría <span className="text-[#00ff88]">*</span>
                </label>
                <Select
                    id="category"
                    {...register('category')}
                    className={errors.category ? 'border-red-500' : ''}
                >
                    <option value="">Selecciona una categoría</option>
                    {ALL_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </Select>
                {errors.category && (
                    <div className="flex items-center gap-1 text-sm text-red-400">
                        <AlertCircle className="h-4 w-4" />
                        {errors.category.message}
                    </div>
                )}
            </div>

            {/* Title */}
            <div className="space-y-2">
                <label htmlFor="title" className="block text-sm font-medium text-white">
                    Título <span className="text-[#00ff88]">*</span>
                </label>
                <Input
                    id="title"
                    {...register('title')}
                    placeholder={getCategoryPlaceholder(category || '')}
                    className={errors.title ? 'border-red-500' : ''}
                    autoComplete="off"
                />
                {errors.title && (
                    <div className="flex items-center gap-1 text-sm text-red-400">
                        <AlertCircle className="h-4 w-4" />
                        {errors.title.message}
                    </div>
                )}
                <p className="text-xs text-slate-500">
                    Sé específico: marca, modelo, color y características distintivas
                </p>
            </div>

            {/* Tips Card */}
            <div className="bg-[#1e293b]/50 border border-[#334155] rounded-lg p-4">
                <h3 className="text-sm font-semibold text-[#00ff88] mb-2">
                    💡 Tips para un buen título
                </h3>
                <ul className="text-sm text-slate-400 space-y-1">
                    <li>• Incluye marca, modelo y color</li>
                    <li>• Menciona el lugar aproximado</li>
                    <li>• Sé conciso (entre 5 y 200 caracteres)</li>
                </ul>
            </div>
        </div>
    )
}
