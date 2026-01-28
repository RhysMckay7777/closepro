import { toast as sonnerToast } from 'sonner';

export const toast = sonnerToast;

export function toastError(message: string) {
  return sonnerToast.error(message);
}

export function toastSuccess(message: string) {
  return sonnerToast.success(message);
}

export function toastInfo(message: string) {
  return sonnerToast.info(message);
}
