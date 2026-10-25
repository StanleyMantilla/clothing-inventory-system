
import { useState } from "react";
import { useAuth } from "./AuthContext";
import AboutUs from "./AboutUs";
import "./Login.css";


function ShirtIcon({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M23 10 12 16 3 29l11 8 7-9v27h22V28l7 9 11-8-9-13-11-6c-2 6-5 9-9 9s-7-3-9-9Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M25 10c1 5 3 8 7 8s6-3 7-8"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InventoryIcon({ type }) {
  if (type === "products") {
    return (
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="m16 3 12 6.5v13L16 29 4 22.5v-13L16 3Z"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="m4 9.5 12 7 12-7M16 16.5V29"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (type === "stock") {
    return (
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <path
          d="M4 27h25M7 22l7-8 6 4 9-12"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M21 6h8v8"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8 27V22M15 27V18M22 27V15"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return <ShirtIcon />;
}

function Login() {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || "Unable to log in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-decoration login-decoration-one" />
      <div className="login-decoration login-decoration-two" />
      <div className="login-dots login-dots-top" />
      <div className="login-dots login-dots-bottom" />

      <section className="login-layout">
        
<div className="login-showcase">
  <div className="login-about-position">
    <AboutUs />
  </div>

  <div className="showcase-brand">

            <div className="showcase-logo">
              <ShirtIcon />
              <span className="logo-tag">•</span>
            </div>

            <div className="showcase-brand-copy">
              <h1>
                Cloth<span>Stock</span>
              </h1>
              <p>Clothing Inventory Management System</p>
            </div>
          </div>

          <div className="login-project-label">
            BSIT 3-C Event Driven Programming Project
          </div>

          <div className="showcase-welcome">
            <h2>
              Welcome <span>Back!</span>
            </h2>
            <p>
              Sign in to access your workspace
              <br className="desktop-break" /> and manage your inventory
              efficiently.
            </p>
          </div>

          <div className="showcase-features">
            <div className="showcase-feature">
              <div className="feature-icon">
                <InventoryIcon type="products" />
              </div>
              <span>Manage</span>
              <strong>Products</strong>
            </div>

            <div className="feature-divider" />

            <div className="showcase-feature">
              <div className="feature-icon">
                <InventoryIcon type="stock" />
              </div>
              <span>Track</span>
              <strong>Stock</strong>
            </div>

            <div className="feature-divider" />

            <div className="showcase-feature">
              <div className="feature-icon">
                <InventoryIcon type="sales" />
              </div>
              <span>Record</span>
              <strong>Sales</strong>
            </div>
          </div>

          <div className="showcase-slogan">
            <p>Better Inventory.</p>
            <p>Bigger Possibilities.</p>
            <span />
          </div>
        </div>

        <div className="login-card">
          <div className="login-card-logo">
            <ShirtIcon />
          </div>

          <h2 className="login-card-brand">
            Cloth<span>Stock</span>
          </h2>

          <p className="login-subtitle">
            Clothing Inventory Management System
          </p>

          <div className="login-accent-line" />

          <div className="login-heading">
            <h3>Sign in to your account</h3>
            <p>Enter your credentials to continue.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="email">Email Address</label>

              <div className="login-input-wrap">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect
                    x="3"
                    y="5"
                    width="18"
                    height="14"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="m4 7 8 6 8-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>

                <input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="password">Password</label>

              <div className="login-input-wrap">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect
                    x="5"
                    y="10"
                    width="14"
                    height="11"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M8 10V7a4 4 0 0 1 8 0v3"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="12" cy="15" r="1.5" fill="currentColor" />
                  <path
                    d="M12 16.5v1"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>

                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className="login-button"
              disabled={submitting}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M13 5h5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M3 12h12m-5-5 5 5-5 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="login-footer">
            <span className="login-footer-dot" />
            Secure access for authorized personnel only.
          </p>
        </div>
      </section>

      <p className="login-bottom-text">
        CLOTHSTOCK <span>•</span> INVENTORY MADE SIMPLE
      </p>
    </main>
  );
}

export default Login;
