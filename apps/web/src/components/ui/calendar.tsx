'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker, getDefaultClassNames } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Date picker built on react-day-picker, styled to the app's tokens. Supports
 * `mode="range"` for the Custom range option in DateRangeSelect. Class names
 * merge over react-day-picker's defaults so unspecified slots keep working.
 */
export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps): React.JSX.Element {
  const defaults = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: cn(defaults.months, 'flex flex-col gap-4 sm:flex-row sm:gap-6'),
        month: cn(defaults.month, 'flex flex-col gap-4'),
        month_caption: cn(defaults.month_caption, 'flex h-8 items-center justify-center px-8'),
        caption_label: cn(defaults.caption_label, 'text-sm font-medium'),
        nav: cn(defaults.nav, 'absolute inset-x-0 top-0 flex items-center justify-between px-1'),
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100'
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'h-7 w-7 bg-transparent p-0 opacity-60 hover:opacity-100'
        ),
        month_grid: cn(defaults.month_grid, 'w-full border-collapse space-y-1'),
        weekdays: cn(defaults.weekdays, 'flex'),
        weekday: cn(
          defaults.weekday,
          'w-9 rounded-md text-[0.8rem] font-normal text-muted-foreground'
        ),
        week: cn(defaults.week, 'mt-2 flex w-full'),
        day: cn(
          defaults.day,
          'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
          // Range slot backgrounds sit on the cell so selected runs read as one bar.
          '[&:has(.rdp-range_middle)]:bg-accent',
          '[&:has(.rdp-range_start)]:rounded-l-md [&:has(.rdp-range_end)]:rounded-r-md',
          '[&:has(>.rdp-range_start)]:bg-accent [&:has(>.rdp-range_end)]:bg-accent'
        ),
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-9 p-0 font-normal aria-selected:opacity-100'
        ),
        range_start: cn(
          defaults.range_start,
          'rdp-range_start rounded-l-md bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
        ),
        range_end: cn(
          defaults.range_end,
          'rdp-range_end rounded-r-md bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
        ),
        range_middle: cn(
          defaults.range_middle,
          'rdp-range_middle bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground'
        ),
        selected: cn(
          defaults.selected,
          'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground'
        ),
        today: cn(defaults.today, 'bg-accent text-accent-foreground rounded-md'),
        outside: cn(
          defaults.outside,
          'text-muted-foreground/50 aria-selected:text-muted-foreground'
        ),
        disabled: cn(defaults.disabled, 'text-muted-foreground/40 opacity-50'),
        hidden: cn(defaults.hidden, 'invisible'),
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, ...chevronProps }) => {
          const Icon = orientation === 'left' ? ChevronLeft : ChevronRight;
          return <Icon className={cn('h-4 w-4', chevronClassName)} {...chevronProps} />;
        },
      }}
      {...props}
    />
  );
}
