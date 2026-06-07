import { cn } from '@/lib/utils';

type FormActionsVariant = 'page' | 'overlay' | 'sheet';

interface FormActionsProps extends React.ComponentProps<'div'> {
  /**
   * Where the action row lives:
   * - `page` — a full-page form; on mobile the row pins above BottomNav as a
   *   full-bleed bar.
   * - `overlay` — inside a dialog; stacks full-width without pinning (the
   *   dialog is already compact).
   * - `sheet` — inside the Record sheet's scrollable body; pins to the sheet
   *   bottom on mobile, clearing the home-indicator safe area.
   */
  variant?: FormActionsVariant;
}

/* Mobile bar treatments per context; desktop is always a quiet inline row. */
const VARIANT_CLASSES: Record<FormActionsVariant, string> = {
  page: 'max-md:sticky max-md:bottom-[calc(4rem+env(safe-area-inset-bottom))] max-md:z-10 max-md:-mx-4 max-md:border-t max-md:border-hairline max-md:bg-background/95 max-md:px-4 max-md:py-3 max-md:backdrop-blur',
  overlay: '',
  sheet:
    'max-md:sticky max-md:bottom-0 max-md:z-10 max-md:mt-auto max-md:-mx-6 max-md:-mb-8 max-md:border-t max-md:border-hairline max-md:bg-background/95 max-md:px-6 max-md:pt-3 max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom))] max-md:backdrop-blur',
};

/**
 * Shared action row for forms (Save / Cancel / Delete / Record). One
 * vocabulary everywhere: on mobile the buttons stack full-width at
 * comfortable touch height with the primary on top (flex-col-reverse keeps
 * DOM order Cancel-then-primary for tabbing); at md+ they sit inline,
 * right-aligned.
 */
export function FormActions({
  variant = 'page',
  className,
  ...props
}: FormActionsProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 md:flex-row md:items-center md:justify-end md:gap-3',
        'max-md:[&>button]:h-11 max-md:[&>button]:w-full',
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
}
