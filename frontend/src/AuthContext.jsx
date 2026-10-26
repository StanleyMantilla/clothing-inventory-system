
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
  const [welcomeName, setWelcomeName] = useState("");

  // Log out
  const logout = useCallback(() => {
    sessionStorage.removeItem("clothstock_token");
    sessionStorage.removeItem("clothstock_user");

    setToken("");
    setUser(null);
    setWelcomeName("");
  }, []);

  // Log in
  const login = useCallback(async (email, password) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const text = await response.text();

    let data;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error("Server returned an invalid response.");
    }

    if (!response.ok) {
      throw new Error(data.message || "Login failed.");
    }

    if (!data.token || !data.user) {
      throw new Error("Login response is missing token or user.");
    }

    // Save the authenticated session
    sessionStorage.setItem("clothstock_token", data.token);
    sessionStorage.setItem(
      "clothstock_user",
      JSON.stringify(data.user)
    );

    setToken(data.token);
    setUser(data.user);

    // Get the actual logged-in user's name
    const name =
      data.user.name ||
      data.user.username ||
      data.user.fullName ||
      data.user.email ||
      email.split("@")[0] ||
      "User";

    // Trigger the welcome animation
    setWelcomeName(name);

    return data.user;
  }, []);

  // Automatically hide the welcome message after 2.2 seconds
  useEffect(() => {
    if (!welcomeName) return;

    const timer = setTimeout(() => {
      setWelcomeName("");
    }, 2200);

    return () => clearTimeout(timer);
  }, [welcomeName]);

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

      if (!data.user) {
        throw new Error("Session response is missing user.");
      }

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

  // Verify the session when the provider mounts
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
        welcomeName,
      }}
    >
      <>
        {children}

        {welcomeName && (
          <div
            className="login-welcome-overlay"
            role="status"
            aria-live="polite"
          >
            <div className="login-welcome-card">
              <div className="login-welcome-check">✓</div>

              <p className="login-welcome-label">
                LOGIN SUCCESSFUL
              </p>

              <h1>WELCOME, {welcomeName}!</h1>

              <p className="login-welcome-message">
                Let's make today productive.
              </p>
            </div>
          </div>
        )}
      </>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
