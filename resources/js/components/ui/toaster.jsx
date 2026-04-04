import { useToast } from '@/hooks/useToast';
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from '@/components/ui/toast';

export function Toaster() {
    const { toasts } = useToast();

    return (
        <ToastProvider>
            {toasts.map(({ id, title, description, variant, ...props }) => (
                <Toast key={id} variant={variant} {...props}>
                    <div className="grid gap-1">
                        {title && <ToastTitle>{title}</ToastTitle>}
                        {description && <ToastDescription>{description}</ToastDescription>}
                    </div>
                    <ToastClose />
                </Toast>
            ))}
            <ToastViewport />
        </ToastProvider>
    );
}
