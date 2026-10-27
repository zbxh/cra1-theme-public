import { createContext, useContext } from 'react'
import { notify } from '../shared'
const ToastContext = createContext(notify)
export function useToast() { return useContext(ToastContext) }
/** React supplies context; the common component renders notifications. */
export function ToastProvider({ children }) {
  return <ToastContext.Provider value={notify}>{children}</ToastContext.Provider>
}
