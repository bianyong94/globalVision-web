// src/spatial-navigation.d.ts
declare module "@noriginmedia/react-spatial-navigation" {
  import * as React from "react"

  export interface FocusableComponentProps {
    focusKey?: string
    onEnterPress?: (props?: any, details?: any) => void
    onArrowPress?: (direction: string, props: any, details: any) => boolean
    onFocus?: (layout: any, props: any, details: any) => void
    onBlur?: (layout: any, props: any, details: any) => void
    focusable?: boolean
    className?: string
  }

  export interface UseFocusableConfig {
    focusable?: boolean
    saveLastFocusedChild?: boolean
    trackChildren?: boolean
    autoRestoreFocus?: boolean
    isFocusBoundary?: boolean
    focusKey?: string
    preferredChildFocusKey?: string
    onEnterPress?: (props?: any, details?: any) => void
    onArrowPress?: (direction: string, props: any, details: any) => boolean
    onFocus?: (layout: any, props: any, details: any) => void
    onBlur?: (layout: any, props: any, details: any) => void
  }

  export interface UseFocusableResult {
    ref: React.RefObject<any>
    focusSelf: (focusDetails?: any) => void
    focused: boolean
    hasFocusedChild: boolean
    focusKey: string
    setFocus: (focusKey: string) => void
    navigateByDirection: (direction: string, focusDetails: any) => void
    pause: () => void
    resume: () => void
    updateAllLayouts: () => void
    getCurrentFocusKey: () => string
  }

  export function useFocusable(config?: UseFocusableConfig): UseFocusableResult

  export function initNavigation(config?: any): void

  export const FocusContext: React.Context<string>
}
