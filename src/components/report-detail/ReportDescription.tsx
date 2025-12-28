import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { STATUS_OPTIONS } from '@/lib/constants'
import type { Report } from '@/lib/api'
import type { useReportEditor } from '@/hooks/useReportEditor'

// ============================================
// TYPES
// ============================================

interface ReportDescriptionProps {
    report: Report
    editor: ReturnType<typeof useReportEditor>
}

// ============================================
// COMPONENT
// ============================================

export function ReportDescription({ report, editor }: ReportDescriptionProps) {
    const { isEditing, editTitle, editDescription, editStatus, updating, setTitle, setDescription, setStatus } = editor

    return (
        <>
            {/* Edit form fields (title/status) - shown in header area when editing */}
            {isEditing && (
                <div className="space-y-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-foreground/80 mb-2">
                            Título
                        </label>
                        <Input
                            value={editTitle}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Título del reporte"
                            className="bg-dark-bg border-dark-border"
                            disabled={updating}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground/80 mb-2">
                            Estado
                        </label>
                        <Select
                            value={editStatus}
                            onChange={(e) => setStatus(e.target.value as Report['status'])}
                            className="bg-dark-bg border-dark-border"
                            disabled={updating}
                        >
                            {STATUS_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </Select>
                    </div>
                </div>
            )}

            {/* Description Card */}
            <Card className="card-glow bg-dark-card border-dark-border mb-6">
                <CardHeader>
                    <CardTitle>Descripción</CardTitle>
                </CardHeader>
                <CardContent>
                    {isEditing ? (
                        <div>
                            <label className="block text-sm font-medium text-foreground/80 mb-2">
                                Descripción
                            </label>
                            <Textarea
                                value={editDescription}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Descripción del reporte"
                                className="bg-dark-bg border-dark-border min-h-[150px]"
                                disabled={updating}
                            />
                        </div>
                    ) : (
                        <p className="text-foreground/80 leading-relaxed">
                            {report.description}
                        </p>
                    )}
                </CardContent>
            </Card>
        </>
    )
}
