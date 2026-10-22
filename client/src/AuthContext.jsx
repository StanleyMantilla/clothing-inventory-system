import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const AuthContext = createContext(null);

const API_URL = "http://localhost:5000";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(
    () => sessionStorage.getItem("clothstock_token") || ""
  );

  const [user, setUser] = useState(() => {
    try {
      const savedUser = sessionStorage.getItem("clothstock_user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [checkingAuth, setCheckingAuth] = useState(true);

  // Log in
  const login = useCallback(async (email, password) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed.");
    }

    sessionStorage.setItem("clothstock_token", data.token);
    sessionStorage.setItem("clothstock_user", JSON.stringify(data.user));

    setToken(data.token);
    setUser(data.user);

    return data.user;
  }, []);

  // Log out
  const logout = useCallback(() => {
    sessionStorage.removeItem("clothstock_token");
    sessionStorage.removeItem("clothstock_user");

    setToken("");
    setUser(null);
  }, []);

  // Verify the current login session
  const verifySession = useCallback(async () => {
    const savedToken = sessionStorage.getItem("clothstock_token");

    if (!savedToken) {
      setToken("");
      setUser(null);
      setCheckingAuth(false);
      return;
    }

    setCheckingAuth(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${savedToken}`,
        },
      });

      if (!response.ok) {
        logout();
        return;
      }

      const data = await response.json();

      setToken(savedToken);
      setUser(data.user);

      sessionStorage.setItem(
        "clothstock_user",
        JSON.stringify(data.user)
      );
    } catch (error) {
      console.error("Session verification failed:", error);
      logout();
    } finally {
      setCheckingAuth(false);
    }
  }, [logout]);

  // Verify the session once when the provider mounts.
  useEffect(() => {
    verifySession();
  }, [verifySession]);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        checkingAuth,
        login,
        logout,
        verifySession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}