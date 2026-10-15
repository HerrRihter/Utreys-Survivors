import { useEffect, useRef, type ReactNode } from 'react';

export function Dialog({
  children,
  titleId,
  onClose,
}: {
  children: ReactNode;
  titleId: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="detail-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
