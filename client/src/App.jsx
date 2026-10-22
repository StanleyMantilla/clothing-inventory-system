
import { useCallback, useEffect, useState } from "react";
import Dashboard from "./Dashboard";
import Sales from "./Sales";
import Products from "./Products";
import Users from "./Users";
import Login from "./Login";
import AI from "./AI";
import { useAuth } from "./AuthContext";
import "./App.css";

const API_URL = "http://localhost:5000";

function App() {
  const { token, user, logout, checkingAuth } = useAuth();

  const isAdmin = user?.role === "admin";

  // Admin starts on Dashboard; staff starts on Products.
  const [activeSection, setActiveSection] = useState(
    isAdmin ? "dashboard" : "products"
  );

  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [inventory, setInventory] = useState(null);
  const [lowStock, setLowStock] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load dashboard and report data using the logged-in user's token.
  const loadDashboard = useCallback(async () => {
    if (!token || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
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
        throw new Error(data.message || `Failed to load ${path}`);
      }

      return data;
    }

    try {
      // Both roles can access products.
      const productsResult = await fetchData("/api/products");

      const productsData = Array.isArray(productsResult)
        ? productsResult
        : productsResult.products || [];

      setProducts(productsData);

      // Sales dashboard data is restricted to administrators.
      let salesData = [];

      if (isAdmin) {
        try {
          const salesResult = await fetchData("/api/sales");

          salesData = Array.isArray(salesResult)
            ? salesResult
            : salesResult.sales || [];
        } catch (salesError) {
          console.error("Could not load dashboard sales:", salesError);
        }
      }

      setSales(salesData);

      const totalStock = productsData.reduce(
        (total, product) =>
          total + (Number(product.quantity) || 0),
        0
      );

      const localLowStock = productsData.filter(
        (product) => Number(product.quantity) <= 5
      );

      if (isAdmin) {
        const [inventoryResult, lowStockResult] = await Promise.all([
          fetchData("/api/reports/inventory"),
          fetchData("/api/products/low-stock"),
        ]);

        setInventory(inventoryResult.report || inventoryResult);

        setLowStock(
          Array.isArray(lowStockResult)
            ? lowStockResult
            : lowStockResult.products || []
        );
      } else {
        // Staff only sees inventory values calculated from products.
        setInventory({
          totalProducts: productsData.length,
          totalStock,
          lowStockProducts: localLowStock.length,
          inventoryCostValue: 0,
          inventorySellingValue: 0,
        });

        setLowStock(localLowStock);
      }
    } catch (err) {
      console.error("Dashboard loading error:", err);

      setError(
        err.message ||
          "Could not load dashboard data. Check your connection."
      );
    } finally {
      setLoading(false);
    }
  }, [token, user, isAdmin]);

  // Load dashboard data after authentication finishes.
  useEffect(() => {
    if (checkingAuth) return;

    if (!token || !user) {
      setLoading(false);
      return;
    }

    loadDashboard();
  }, [checkingAuth, token, user, loadDashboard]);

  // Refresh dashboard data when products or sales change.
  useEffect(() => {
    function handleDashboardRefresh() {
      loadDashboard();
    }

    window.addEventListener(
      "clothstock:refresh-dashboard",
      handleDashboardRefresh
    );

    return () => {
      window.removeEventListener(
        "clothstock:refresh-dashboard",
        handleDashboardRefresh
      );
    };
  }, [loadDashboard]);

  // Prevent staff from entering administrator-only sections.
  useEffect(() => {
    if (
      !isAdmin &&
      ["dashboard", "reports", "users"].includes(activeSection)
    ) {
      setActiveSection("products");
    }
  }, [isAdmin, activeSection]);

  const navigateTo = (section) => {
    if (
      !isAdmin &&
      ["dashboard", "reports", "users"].includes(section)
    ) {
      setActiveSection("products");
      return;
    }

    setActiveSection(section);
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
    <div className="app">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">C</div>

          <div>
            <h2>ClothStock</h2>
            <p>Inventory System</p>
          </div>
        </div>

        <p className="menu-label">MAIN MENU</p>

        {/* Dashboard: administrator only */}
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

        {/* Products: both roles */}
        <button
          type="button"
          className={`nav-link ${
            activeSection === "products" ? "active" : ""
          }`}
          onClick={() => navigateTo("products")}
        >
          Products
        </button>

        {/* Sales: both roles, subject to backend permissions */}
        <button
          type="button"
          className={`nav-link ${
            activeSection === "sales" ? "active" : ""
          }`}
          onClick={() => navigateTo("sales")}
        >
          Sales
        </button>

        {/* ClothStock AI: both roles */}
        <button
          type="button"
          className={`nav-link ${
            activeSection === "ai" ? "active" : ""
          }`}
          onClick={() => navigateTo("ai")}
        >
          ✨ ClothStock AI
        </button>

        {/* Reports: administrator only */}
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

        {/* User Management: administrator only */}
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

        {/* Logged-in user */}
        <div className="user-panel">
          <div className="user-avatar">
            {(user.name || "U").charAt(0).toUpperCase()}
          </div>

          <div className="user-details">
            <strong>{user.name || "User"}</strong>

            <span>{isAdmin ? "Administrator" : "Staff"}</span>
          </div>

          <button
            type="button"
            className="logout-button"
            onClick={logout}
          >
            Logout
          </button>
        </div>

        {/* Backend status */}
        <div className="sidebar-footer">
          <span className="status-dot"></span>
          Backend connection
          <strong>Local API</strong>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        {/* DASHBOARD */}
        {activeSection === "dashboard" && isAdmin && (
          <section className="page-section">
            <header className="topbar">
              <div>
                <p className="breadcrumb">Workspace / Dashboard</p>

                <h1>Inventory Dashboard</h1>

                <p className="subtitle">
                  Welcome back! Here&apos;s your clothing store overview.
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

        {/* PRODUCTS */}
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

        {/* SALES */}
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

        {/* CLOTHSTOCK AI */}
        {activeSection === "ai" && (
          <section className="page-section">
            <header className="topbar">
              <div>
                <p className="breadcrumb">Workspace / ClothStock AI</p>

                <h1>ClothStock AI</h1>

                <p className="subtitle">
                  Ask inventory questions and identify products that
                  need restocking.
                </p>
              </div>
            </header>

            <AI />
          </section>
        )}

        {/* REPORTS */}
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

        {/* USER MANAGEMENT */}
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
    </div>
  );
}

export default App;
