import { cn } from '@/lib/utils'
import { Check, FileText, MapPin, Camera, Eye } from 'lucide-react'

interface WizardStepIndicatorProps {
    currentStep: number
    totalSteps: number
    steps: { label: string; icon: React.ReactNode }[]
    onStepClick?: (step: number) => void
}

const defaultSteps = [
    { label: 'Info', icon: <FileText className="h-4 w-4" /> },
    { label: 'Detalles', icon: <FileText className="h-4 w-4" /> },
    { label: 'Ubicación', icon: <MapPin className="h-4 w-4" /> },
    { label: 'Review', icon: <Eye className="h-4 w-4" /> },
]

export function WizardStepIndicator({ 
    currentStep, 
    totalSteps, 
    steps = defaultSteps,
    onStepClick 
}: WizardStepIndicatorProps) {
    return (
        <div className="w-full">
            {/* Desktop: Horizontal with lines */}
            <div className="hidden sm:flex items-center justify-between">
                {steps.map((step, index) => {
                    const stepNumber = index + 1
                    const isActive = stepNumber === currentStep
                    const isCompleted = stepNumber < currentStep
                    const isClickable = onStepClick && (isCompleted || stepNumber <= currentStep + 1)

                    return (
                        <div key={stepNumber} className="flex items-center flex-1 last:flex-none">
                            {/* Step circle */}
                            <button
                                onClick={() => isClickable && onStepClick(stepNumber)}
                                disabled={!isClickable}
                                className={cn(
                                    "relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300",
                                    isActive && "border-[#00ff88] bg-[#00ff88]/10 text-[#00ff88]",
                                    isCompleted && "border-[#00ff88] bg-[#00ff88] text-black",
                                    !isActive && !isCompleted && "border-slate-600 bg-[#0f172a] text-slate-500",
                                    isClickable && "cursor-pointer hover:scale-105",
                                    !isClickable && "cursor-default"
                                )}
                            >
                                {isCompleted ? (
                                    <Check className="h-5 w-5" />
                                ) : (
                                    step.icon
                                )}
                            </button>

                            {/* Step label */}
                            <div className="ml-3 flex flex-col">
                                <span className={cn(
                                    "text-xs font-medium transition-colors",
                                    isActive && "text-[#00ff88]",
                                    isCompleted && "text-white",
                                    !isActive && !isCompleted && "text-slate-500"
                                )}>
                                    Paso {stepNumber}
                                </span>
                                <span className={cn(
                                    "text-sm font-semibold transition-colors",
                                    isActive && "text-white",
                                    isCompleted && "text-white/80",
                                    !isActive && !isCompleted && "text-slate-500"
                                )}>
                                    {step.label}
                                </span>
                            </div>

                            {/* Connector line */}
                            {index < totalSteps - 1 && (
                                <div className="flex-1 mx-4 h-0.5 bg-slate-800 relative">
                                    <div 
                                        className={cn(
                                            "absolute inset-y-0 left-0 bg-[#00ff88] transition-all duration-500",
                                            isCompleted ? "w-full" : "w-0"
                                        )}
                                    />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Mobile: Compact horizontal */}
            <div className="sm:hidden">
                <div className="flex items-center justify-between mb-2">
                    {steps.map((step, index) => {
                        const stepNumber = index + 1
                        const isActive = stepNumber === currentStep
                        const isCompleted = stepNumber < currentStep

                        return (
                            <button
                                key={stepNumber}
                                onClick={() => onStepClick?.(stepNumber)}
                                disabled={!onStepClick || stepNumber > currentStep + 1}
                                className={cn(
                                    "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all",
                                    isActive && "border-[#00ff88] bg-[#00ff88]/10 text-[#00ff88]",
                                    isCompleted && "border-[#00ff88] bg-[#00ff88] text-black",
                                    !isActive && !isCompleted && "border-slate-700 bg-[#0f172a] text-slate-600"
                                )}
                            >
                                {isCompleted ? <Check className="h-4 w-4" /> : stepNumber}
                            </button>
                        )
                    })}
                </div>
                {/* Progress bar */}
                <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-[#00ff88] transition-all duration-500"
                        style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
                    />
                </div>
                <div className="text-center mt-2">
                    <span className="text-sm font-medium text-white">
                        {steps[currentStep - 1]?.label}
                    </span>
                </div>
            </div>
        </div>
    )
}
