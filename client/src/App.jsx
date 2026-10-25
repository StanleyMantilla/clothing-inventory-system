
import { useCallback, useEffect, useRef, useState } from "react";
import Dashboard from "./Dashboard";
import Sales from "./Sales";
import Products from "./Products";
import Users from "./Users";
import Login from "./Login";
import AI from "./AI";
import { useAuth } from "./AuthContext";
import "./App.css";

const API_URL = "http://localhost:5000";
const REFRESH_EVENT = "clothstock:refresh-dashboard";

function App() {
  const { token, user, logout, checkingAuth } = useAuth();
  const isAdmin = user?.role === "admin";

  const [activeSection, setActiveSection] = useState("dashboard");

const [sidebarOpen, setSidebarOpen] = useState(
  () => window.innerWidth > 900
);
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [inventory, setInventory] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const requestIdRef = useRef(0);
  const refreshTimerRef = useRef(null);
  const hasLoadedRef = useRef(false);

  // Keep the correct starting page for each role.
  useEffect(() => {
    setActiveSection(isAdmin ? "dashboard" : "products");
  }, [token, user?._id, user?.id, isAdmin]);

  const loadDashboard = useCallback(
    async ({ silent = false } = {}) => {
      if (!token || !user) {
        setLoading(false);
        return;
      }

      const requestId = ++requestIdRef.current;
      const isCurrentRequest = () =>
        requestId === requestIdRef.current;

      if (!silent && !hasLoadedRef.current) {
        setLoading(true);
      }

      setError("");

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      async function fetchData(path) {
        const response = await fetch(`${API_URL}${path}`, {
          headers,
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.message || `Failed to load ${path}`
          );
        }

        return data;
      }

      const getArray = (result, key) =>
        Array.isArray(result) ? result : result?.[key] || [];

      try {
        // Products are available to both administrator and staff.
        const requests = [fetchData("/api/products")];

        // These endpoints are administrator-only.
        if (isAdmin) {
          requests.push(
            fetchData("/api/sales"),
            fetchData("/api/reports/inventory"),
            fetchData("/api/products/low-stock")
          );
        }

        const results = await Promise.all(requests);

        if (!isCurrentRequest()) return;

        const productsData = getArray(results[0], "products");

        let salesData = [];
        let inventoryData;
        let lowStockData;

        const totalStock = productsData.reduce(
          (total, product) =>
            total + (Number(product.quantity) || 0),
          0
        );

        const localLowStock = productsData.filter(
          (product) => Number(product.quantity) <= 5
        );

        if (isAdmin) {
          salesData = getArray(results[1], "sales");

          const inventoryResult = results[2];
          inventoryData =
            inventoryResult?.report || inventoryResult;

          lowStockData = getArray(results[3], "products");
        } else {
          // Do not call administrator-only report or sales endpoints.
          inventoryData = {
            totalProducts: productsData.length,
            totalStock,
            lowStockProducts: localLowStock.length,
            inventoryCostValue: 0,
            inventorySellingValue: 0,
          };

          lowStockData = localLowStock;
        }

        setProducts(productsData);
        setSales(salesData);
        setInventory(inventoryData);
        setLowStock(lowStockData);

        hasLoadedRef.current = true;
        setError("");
      } catch (err) {
        if (!isCurrentRequest()) return;

        console.error("Dashboard loading error:", err);

        setError(
          err.message ||
            "Could not load data. Please check your backend."
        );
      } finally {
        if (isCurrentRequest()) {
          setLoading(false);
        }
      }
    },
    [token, user, isAdmin]
  );

  // Reset loading state when the account or session changes.
  useEffect(() => {
    requestIdRef.current += 1;
    hasLoadedRef.current = false;
    setLoading(true);
    setError("");
  }, [token, user?._id, user?.id, user?.role]);

  // Load data after authentication is ready.
  useEffect(() => {
    if (checkingAuth) return;

    if (!token || !user) {
      setLoading(false);
      return;
    }

    loadDashboard();
  }, [checkingAuth, token, user, loadDashboard]);

  // Refresh data when Products or Sales requests a dashboard refresh.
  useEffect(() => {
    if (checkingAuth || !token || !user) return;

    function handleDashboardRefresh() {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        loadDashboard({ silent: true });
      }, 150);
    }

    window.addEventListener(REFRESH_EVENT, handleDashboardRefresh);

    return () => {
      window.removeEventListener(
        REFRESH_EVENT,
        handleDashboardRefresh
      );

      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [checkingAuth, token, user, loadDashboard]);

  const navigateTo = (section) => {
    // ClothStock AI is a floating assistant, not a full-page route.
    if (section === "ai") {
      window.dispatchEvent(new Event("clothstock:open-ai"));
    } else {
      const adminOnlySections = ["dashboard", "reports", "users"];
      if (!isAdmin && adminOnlySections.includes(section)) {
        setActiveSection("products");
      } else {
        setActiveSection(section);
      }
    }

    // Close the navigation drawer after selecting a page.
    if (window.innerWidth <= 900) {
      setSidebarOpen(false);
    }
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(Number(amount) || 0);

  if (checkingAuth) {
    return (
      <div className="loading-screen">
        Verifying your session...
      </div>
    );
  }

  if (!token || !user) {
    return <Login />;
  }

  const totalProducts =
    inventory?.totalProducts ?? products.length;

  const totalStock =
    inventory?.totalStock ??
    products.reduce(
      (total, product) =>
        total + (Number(product.quantity) || 0),
      0
    );

  const lowStockCount =
    inventory?.lowStockProducts ?? lowStock.length;

  const costValue = inventory?.inventoryCostValue ?? 0;
  const sellingValue = inventory?.inventorySellingValue ?? 0;

  return (
  <div
    className={`app ${
      sidebarOpen ? "sidebar-is-open" : "sidebar-is-closed"
    }`}
  >
    <button
      type="button"
      className={`sidebar-toggle ${
        sidebarOpen ? "is-open" : ""
      }`}
      onClick={() => setSidebarOpen((open) => !open)}
      aria-label={sidebarOpen ? "Close navigation menu" : "Open navigation menu"}
      aria-expanded={sidebarOpen}
      aria-controls="clothstock-sidebar"
    >
      <span></span>
      <span></span>
      <span></span>
    </button>

    {sidebarOpen && (
      <button
        type="button"
        className="sidebar-overlay"
        aria-label="Close navigation menu"
        onClick={() => setSidebarOpen(false)}
      />
    )}

    
    <aside
      id="clothstock-sidebar"
      className={`sidebar ${
        sidebarOpen ? "sidebar-open" : "sidebar-closed"
      }`}
    >

        <div className="brand">
          <div className="brand-icon">C</div>
          <div>
            <h2>ClothStock</h2>
            <p>Inventory System</p>
          </div>
        </div>

        <p className="menu-label">MAIN MENU</p>

        {isAdmin && (
          <button
            type="button"
            className={`nav-link ${
              activeSection === "dashboard" ? "active" : ""
            }`}
            onClick={() => navigateTo("dashboard")}
          >
            Dashboard
          </button>
        )}

        <button
          type="button"
          className={`nav-link ${
            activeSection === "products" ? "active" : ""
          }`}
          onClick={() => navigateTo("products")}
        >
          Products
        </button>

        <button
          type="button"
          className={`nav-link ${
            activeSection === "sales" ? "active" : ""
          }`}
          onClick={() => navigateTo("sales")}
        >
          Sales
        </button>

        <button
          type="button"
          className={`nav-link ${
            activeSection === "ai" ? "active" : ""
          }`}
          onClick={() => navigateTo("ai")}
        >
          ✨ ClothStock AI
        </button>

        
        {!isAdmin && (
          <button
            type="button"
            className="nav-link staff-bottom-logout"
            onClick={logout}
            aria-label="Logout"
          >
            <span aria-hidden="true">↪</span>
            <span>Logout</span>
          </button>
        )}


        {isAdmin && (
          <button
            type="button"
            className={`nav-link ${
              activeSection === "reports" ? "active" : ""
            }`}
            onClick={() => navigateTo("reports")}
          >
            Reports
          </button>
        )}

        {isAdmin && (
          <button
            type="button"
            className={`nav-link ${
              activeSection === "users" ? "active" : ""
            }`}
            onClick={() => navigateTo("users")}
          >
            User Management
          </button>
        )}


        <div className="sidebar-footer">
          <span className="status-dot"></span>
          Backend connection
          <strong>Local API</strong>
        </div>
      </aside>

      
      <main className="main-content">
        {activeSection === "dashboard" && isAdmin && (
          <section className="page-section">
            <header className="topbar">
              <div>
                <p className="breadcrumb">Workspace / Dashboard</p>
                <h1>Inventory Dashboard</h1>
                <p className="subtitle">
                  Welcome back! Here's your clothing store overview.
                </p>
              </div>

              <div className="date-badge">
                <span>●</span> Inventory Overview
              </div>
            </header>

            {error && <div className="error-banner">{error}</div>}

            {loading ? (
              <div className="loading-screen">
                Updating dashboard data...
              </div>
            ) : (
              <Dashboard
                products={products}
                sales={sales}
                inventory={inventory}
                lowStock={lowStock}
              />
            )}
          </section>
        )}

        {activeSection === "products" && (
          <section className="page-section">
            <header className="topbar">
              <div>
                <p className="breadcrumb">Workspace / Products</p>
                <h1>Product Management</h1>
                <p className="subtitle">
                  Add, edit, delete, and manage clothing products.
                </p>
              </div>
            </header>
            <Products />
          </section>
        )}

        {activeSection === "sales" && (
          <section className="page-section">
            <header className="topbar">
              <div>
                <p className="breadcrumb">Workspace / Sales</p>
                <h1>Sales Management</h1>
                <p className="subtitle">
                  Record sales and review transaction history.
                </p>
              </div>
            </header>
            <Sales />
          </section>
        )}

        {activeSection === "reports" && isAdmin && (
          <section className="page-section">
            <header className="topbar">
              <div>
                <p className="breadcrumb">Workspace / Reports</p>
                <h1>Inventory Reports</h1>
                <p className="subtitle">
                  Review inventory valuation and stock levels.
                </p>
              </div>
            </header>

            {error && <div className="error-banner">{error}</div>}

            {loading ? (
              <div className="loading-screen">Updating reports...</div>
            ) : (
              <>
                <section className="stats-grid">
                  <article className="stat-card">
                    <div className="stat-heading">
                      <span>Total Products</span>
                    </div>
                    <h2>{totalProducts}</h2>
                    <p>Products in your inventory</p>
                  </article>

                  <article className="stat-card">
                    <div className="stat-heading">
                      <span>Total Stock</span>
                    </div>
                    <h2>{totalStock.toLocaleString()}</h2>
                    <p>Units currently available</p>
                  </article>

                  <article className="stat-card">
                    <div className="stat-heading">
                      <span>Low-Stock Products</span>
                    </div>
                    <h2>{lowStockCount}</h2>
                    <p>Products needing attention</p>
                  </article>

                  <article className="stat-card">
                    <div className="stat-heading">
                      <span>Inventory Cost Value</span>
                    </div>
                    <h2>{formatCurrency(costValue)}</h2>
                    <p>Estimated cost of current stock</p>
                  </article>

                  <article className="stat-card">
                    <div className="stat-heading">
                      <span>Potential Selling Value</span>
                    </div>
                    <h2>{formatCurrency(sellingValue)}</h2>
                    <p>Estimated value of current inventory</p>
                  </article>
                </section>

                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2>Low-Stock Products</h2>
                      <p>Clothing items with limited stock</p>
                    </div>
                    <span className="alert-badge">{lowStock.length}</span>
                  </div>

                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>PRODUCT</th>
                          <th>CODE</th>
                          <th>CATEGORY</th>
                          <th>QUANTITY</th>
                        </tr>
                      </thead>

                      <tbody>
                        {lowStock.map((product) => (
                          <tr key={product._id || product.code}>
                            <td>{product.name}</td>
                            <td>{product.code}</td>
                            <td>{product.category}</td>
                            <td>
                              <span className="stock-badge low">
                                {product.quantity}
                              </span>
                            </td>
                          </tr>
                        ))}

                        {lowStock.length === 0 && (
                          <tr>
                            <td colSpan="4" className="empty-state">
                              No low-stock products found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </section>
        )}

        {activeSection === "users" && isAdmin && (
          <section className="page-section">
            <header className="topbar">
              <div>
                <p className="breadcrumb">
                  Workspace / User Management
                </p>
                <h1>User Management</h1>
                <p className="subtitle">
                  Manage administrator and staff accounts.
                </p>
              </div>
            </header>
            <Users />
          </section>
        )}
      </main>

      {/* Mount once so the floating assistant stays available on every page. */}
      <AI />
    </div>
  );
}

export default App;
