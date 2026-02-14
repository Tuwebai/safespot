import { useNavigate } from 'react-router-dom'
import { Z_INDEX } from '@/config/z-index'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useConfirm } from '@/components/ui/useConfirm'
import { useReportWizard } from './useReportWizard'
import { WizardStepIndicator } from './WizardStepIndicator'
import { Step1BasicInfo } from './Step1BasicInfo'
import { Step2Description } from './Step2Description'
import { Step3LocationDate } from './Step3LocationDate'
import { Step4ReviewSubmit } from './Step4ReviewSubmit'

const steps = [
    { label: 'Básico', icon: <span className="text-xs font-bold">1</span> },
    { label: 'Detalles', icon: <span className="text-xs font-bold">2</span> },
    { label: 'Ubicación', icon: <span className="text-xs font-bold">3</span> },
    { label: 'Publicar', icon: <span className="text-xs font-bold">4</span> },
]

export function ReportWizard() {
    const navigate = useNavigate()
    const { confirm } = useConfirm()
    const {
        currentStep,
        totalSteps,
        form,
        imageFiles,
        imagePreviews,
        isSubmitting,
        isCompressing,
        compressionProgress,
        nextStep,
        prevStep,
        goToStep,
        handleLocationChange,
        handleDateChange,
        handleImageUpload,
        handleRemoveImage,
        submitReport,
        clearDraft,
        getValues,
    } = useReportWizard()

    const handleCancel = async () => {
        const confirmed = await confirm({
            title: '¿Salir sin guardar?',
            description: 'Se perderá el borrador del reporte.',
            variant: 'default' // 🔒 FIX: 'warning' no es válido, usar 'default' o 'danger'
        })
        if (confirmed) {
            clearDraft()
            navigate('/reportes')
        }
    }

    const renderStep = () => {
        switch (currentStep) {
            case 1:
                return <Step1BasicInfo form={form} />
            case 2:
                return <Step2Description form={form} />
            case 3:
                return (
                    <Step3LocationDate
                        form={form}
                        onLocationChange={handleLocationChange}
                        onDateChange={handleDateChange}
                    />
                )
            case 4:
                return (
                    <Step4ReviewSubmit
                        formData={getValues()}
                        imageFiles={imageFiles}
                        imagePreviews={imagePreviews}
                        isSubmitting={isSubmitting}
                        isCompressing={isCompressing}
                        compressionProgress={compressionProgress}
                        onImageUpload={handleImageUpload}
                        onRemoveImage={handleRemoveImage}
                        onSubmit={submitReport}
                    />
                )
            default:
                return null
        }
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="sticky top-0 bg-background/90 border-b border-border" style={{ zIndex: Z_INDEX.HEADER, backdropFilter: 'blur(12px)' }}>
                <div className="max-w-2xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={handleCancel}
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                        >
                            <X className="h-5 w-5 text-muted-foreground" />
                        </button>
                        <h1 className="text-lg font-bold text-foreground">Nuevo Reporte</h1>
                        <div className="w-9" /> {/* Spacer for centering */}
                    </div>
                    
                    <WizardStepIndicator
                        currentStep={currentStep}
                        totalSteps={totalSteps}
                        steps={steps}
                        onStepClick={goToStep}
                    />
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-2xl mx-auto px-4 py-6">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        <Card className="bg-card border-border">
                            <CardContent className="p-6">
                                {renderStep()}
                            </CardContent>
                        </Card>
                    </motion.div>
                </AnimatePresence>

                {/* Navigation Buttons */}
                {currentStep < 4 && (
                    <div className="flex gap-3 mt-6">
                        {currentStep > 1 ? (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={prevStep}
                                className="flex-1"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Atrás
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCancel}
                                className="flex-1"
                            >
                                Cancelar
                            </Button>
                        )}
                        
                        <Button
                            type="button"
                            variant="neon"
                            onClick={nextStep}
                            disabled={isCompressing}
                            className="flex-1"
                        >
                            {isCompressing ? (
                                'Procesando...'
                            ) : (
                                <>
                                    Continuar
                                    <ArrowRight className="h-4 w-4 ml-2" />
                                </>
                            )}
                        </Button>
                    </div>
                )}

                {/* Draft indicator */}
                <div className="text-center mt-4">
                    <span className="text-xs text-muted-foreground">
                        💾 Borrador guardado automáticamente
                    </span>
                </div>
            </main>
        </div>
    )
}
