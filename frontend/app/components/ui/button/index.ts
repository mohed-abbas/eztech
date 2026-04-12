import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Button } from "./Button.vue"

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-body-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary-400/30",
  {
    variants: {
      variant: {
        default:
          "bg-primary-600 text-white hover:bg-primary-700 active:scale-[.99]",
        destructive:
          "bg-error text-white hover:bg-error/90",
        outline:
          "border border-neutral-200 bg-white hover:bg-neutral-50 text-text-secondary",
        secondary:
          "bg-neutral-100 text-text-secondary hover:bg-neutral-200",
        ghost:
          "hover:bg-neutral-100 hover:text-text-primary",
        link: "text-primary-600 underline-offset-4 hover:underline",
        gradient:
          "btn-gradient-primary border border-white/10 text-white capitalize",
        glass:
          "btn-glass bg-white text-text-primary capitalize",
      },
      size: {
        "default": "h-10 rounded-xl px-6 py-2.5",
        "sm": "h-8 rounded-lg gap-1.5 px-3",
        "lg": "h-12 rounded-xl px-8",
        "icon": "size-9 rounded-lg",
        "icon-sm": "size-8 rounded-lg",
        "pill": "rounded-full px-6 py-3",
        "pill-sm": "rounded-full px-6 py-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)
export type ButtonVariants = VariantProps<typeof buttonVariants>
