import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type { AccountUser } from "../types"
import {
  getCurrentAccount,
  getStoredAccountUser,
  LEGACY_HISTORY_STORAGE_KEY,
  loginAccount,
  logoutAccount,
  registerAccount,
  subscribeAccountSession,
} from "../services/accountApi"

interface AuthContextValue {
  user: AccountUser | null
  initialized: boolean
  busy: boolean
  login: (phone: string, password: string) => Promise<AccountUser>
  register: (
    phone: string,
    password: string,
    displayName?: string,
  ) => Promise<AccountUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AccountUser | null>(getStoredAccountUser)
  const [initialized, setInitialized] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    localStorage.removeItem(LEGACY_HISTORY_STORAGE_KEY)

    const syncStoredSession = () => setUser(getStoredAccountUser())
    const unsubscribe = subscribeAccountSession(syncStoredSession)
    const storedUser = getStoredAccountUser()

    if (!storedUser) {
      setInitialized(true)
      return unsubscribe
    }

    let cancelled = false
    getCurrentAccount()
      .then((currentUser) => {
        if (!cancelled) setUser(currentUser)
      })
      .catch(() => {
        if (!cancelled) setUser(getStoredAccountUser())
      })
      .finally(() => {
        if (!cancelled) setInitialized(true)
      })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const login = useCallback(async (phone: string, password: string) => {
    setBusy(true)
    try {
      const currentUser = await loginAccount(phone, password)
      setUser(currentUser)
      return currentUser
    } finally {
      setBusy(false)
    }
  }, [])

  const register = useCallback(
    async (phone: string, password: string, displayName?: string) => {
      setBusy(true)
      try {
        const currentUser = await registerAccount(phone, password, displayName)
        setUser(currentUser)
        return currentUser
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const logout = useCallback(async () => {
    setBusy(true)
    try {
      await logoutAccount()
      setUser(null)
    } finally {
      setBusy(false)
    }
  }, [])

  const value = useMemo(
    () => ({ user, initialized, busy, login, register, logout }),
    [user, initialized, busy, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth must be used inside AuthProvider")
  return value
}
