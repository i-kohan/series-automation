import { useCallback } from "react";
import { toast } from "sonner";

export function useNotifications() {
  const showSuccess = useCallback((message: string) => {
    toast.success(message);
  }, []);

  const showError = useCallback((message: string, error?: Error) => {
    toast.error(message, {
      description: error?.message,
    });
  }, []);

  const showInfo = useCallback((message: string, description?: string) => {
    toast.info(message, {
      description,
    });
  }, []);

  const showLoading = useCallback(
    <T>(
      message: string,
      promise: Promise<T>,
      options: {
        loading: string;
        success: string;
        error: string;
      }
    ) => {
      return toast.promise(promise, {
        loading: options.loading,
        success: options.success,
        error: options.error,
      });
    },
    []
  );

  return {
    showSuccess,
    showError,
    showInfo,
    showLoading,
  };
}
