import Sales from "./Sales";
import Products from "./Products";
import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000";

function App() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        setError("");

        const responses = await Promise.all([
          fetch(`${API_URL}/api/products`),
          fetch(`${API_URL}/api/reports/inventory`),
          fetch(`${API_URL}/api/products/low-stock`),
          fetch(`${API_URL}/api/sales`),
        ]);

        if (responses.some((response) => !response.ok)) {
          throw new Error("Unable to load dashboard data.");
        }

        const [productsData, inventoryData, lowStockData, salesData] =
          await Promise.all(responses.map((response) => response.json()));

        setProducts(
          Array.isArray(productsData)
            ? productsData
            : productsData.products ?? []
        );

        setInventory(inventoryData.report ?? inventoryData);

        setLowStock(
          Array.isArray(lowStockData)
            ? lowStockData
            : lowStockData.products ?? []
        );

        setSales(
          Array.isArray(salesData)
            ? salesData
            : salesData.sales ?? []
        );
      } catch (err) {
        setError(
          "Could not connect to the backend. Make sure your Express server is running on port 5000."
        );
        console.error("Dashboard loading error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(Number(amount) || 0);

  const formatDate = (date) => {
    if (!date) return "—";

    const parsedDate = new Date(date);

    return Number.isNaN(parsedDate.getTime())
      ? "—"
      : parsedDate.toLocaleDateString("en-PH");
  };

  if (loading) {
    return <div className="loading-screen">Loading your inventory...</div>;
  }

  const totalProducts = inventory?.totalProducts ?? products.length;
  const totalStock = inventory?.totalStock ?? 0;
  const lowStockCount =
    inventory?.lowStockProducts ?? lowStock.length;
  const costValue = inventory?.inventoryCostValue ?? 0;
  const sellingValue = inventory?.inventorySellingValue ?? 0;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">C</div>
          <div>
            <h2>ClothStock</h2>
            <p>Inventory System</p>
          </div>
        </div>

        <p className="menu-label">MAIN MENU</p>

        <button
  type="button"
  className={`nav-link ${activeSection === "dashboard" ? "active" : ""}`}
  onClick={() => setActiveSection("dashboard")}
>
  Dashboard
</button>

<button
  type="button"
  className={`nav-link ${activeSection === "products" ? "active" : ""}`}
  onClick={() => setActiveSection("products")}
>
  Products
</button>

<button
  type="button"
  className={`nav-link ${activeSection === "sales" ? "active" : ""}`}
  onClick={() => setActiveSection("sales")}
>
  Sales
</button>

<button
  type="button"
  className={`nav-link ${activeSection === "reports" ? "active" : ""}`}
  onClick={() => setActiveSection("reports")}
>
  Reports
</button>

        <div className="sidebar-footer">
          <span className="status-dot"></span>
          Backend connection
          <strong>Local API</strong>
        </div>
      </aside>

      <main className="main-content">
        {activeSection === "dashboard" && (
          <>
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

        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-heading">
              <span>Total Products</span>
              <div className="stat-icon purple">▦</div>
            </div>
            <h2>{totalProducts}</h2>
            <p>Products in your inventory</p>
          </article>

          <article className="stat-card">
            <div className="stat-heading">
              <span>Total Stock</span>
              <div className="stat-icon blue">▤</div>
            </div>
            <h2>{totalStock.toLocaleString()}</h2>
            <p>Units currently available</p>
          </article>

          <article className="stat-card">
            <div className="stat-heading">
              <span>Low-Stock Products</span>
              <div className="stat-icon orange">!</div>
            </div>
            <h2>{lowStockCount}</h2>
            <p>Products needing attention</p>
          </article>

          <article className="stat-card">
            <div className="stat-heading">
              <span>Inventory Cost Value</span>
              <div className="stat-icon green">₱</div>
            </div>
            <h2>{formatCurrency(costValue)}</h2>
            <p>Estimated cost of current stock</p>
          </article>
        </section>

        <section className="report-banner" id="inventory">
          <div>
            <p className="report-label">INVENTORY VALUATION</p>
            <h2>{formatCurrency(sellingValue)}</h2>
            <p>Potential selling value of your current inventory</p>
          </div>

          <div className="report-symbol">₱</div>
        </section>

        <section className="content-grid">
          <article className="panel" id="products">
            <div className="panel-header">
              <div>
                <h2>Recent Products</h2>
                <p>Your latest inventory records</p>
              </div>

              <span className="count-badge">{products.length} products</span>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>PRODUCT</th>
                    <th>CODE</th>
                    <th>STOCK</th>
                    <th>PRICE</th>
                  </tr>
                </thead>

                <tbody>
                  {products.slice(0, 6).map((product) => (
                    <tr key={product._id}>
                      <td>
                        <strong>{product.name}</strong>
                        <small>
                          {product.category} · {product.size}
                        </small>
                      </td>

                      <td>{product.code}</td>

                      <td>
                        <span
                          className={`stock-badge ${
                            Number(product.quantity) <= 5 ? "low" : "normal"
                          }`}
                        >
                          {product.quantity}
                        </span>
                      </td>

                      <td>{formatCurrency(product.sellingPrice)}</td>
                    </tr>
                  ))}

                  {products.length === 0 && (
                    <tr>
                      <td colSpan="4" className="empty-state">
                        No products found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="panel">
            <div className="panel-header">
              <div>
                <h2>Low-Stock Alerts</h2>
                <p>Products with 5 or fewer units</p>
              </div>

              <span className="alert-badge">{lowStock.length}</span>
            </div>

            <div className="alert-list">
              {lowStock.slice(0, 6).map((product) => (
                <div className="alert-item" key={product._id}>
                  <div className="alert-product-icon">!</div>

                  <div className="alert-product-info">
                    <strong>{product.name}</strong>
                    <small>Code: {product.code}</small>
                  </div>

                  <span className="alert-quantity">
                    {product.quantity} left
                  </span>
                </div>
              ))}

              {lowStock.length === 0 && (
                <div className="empty-state">
                  <span className="success-icon">✓</span>
                  <p>No low-stock products right now.</p>
                </div>
              )}
            </div>
          </article>
        </section>

        <section className="panel sales-panel" id="sales">
          <div className="panel-header">
            <div>
              <h2>Recent Sales</h2>
              <p>Latest recorded transactions</p>
            </div>

            <span className="count-badge">{sales.length} transactions</span>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>PRODUCT</th>
                  <th>QUANTITY</th>
                  <th>UNIT PRICE</th>
                  <th>TOTAL</th>
                  <th>DATE</th>
                </tr>
              </thead>

              <tbody>
                {sales.slice(0, 5).map((sale) => (
                  <tr key={sale._id}>
                    <td>
                      <strong>
                        {typeof sale.productId === "object"
                          ? sale.productId?.name ?? "Unknown product"
                          : "Product"}
                      </strong>
                      <small>
                        {typeof sale.productId === "object"
                          ? sale.productId?.code ?? ""
                          : ""}
                      </small>
                    </td>

                    <td>{sale.quantity}</td>

                    <td>{formatCurrency(sale.unitPrice)}</td>

                    <td>
                      <strong>{formatCurrency(sale.totalAmount)}</strong>
                    </td>

                    <td>{formatDate(sale.soldAt)}</td>
                  </tr>
                ))}

                {sales.length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty-state">
                      No sales have been recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="footer">
          <span>ClothStock Inventory Management</span>
          <span>React + Express + MongoDB</span>
        </footer>
          </>
        )}

      {activeSection === "products" && (
  <section className="page-section">
    <header className="topbar">
      <div>
        <p className="breadcrumb">Workspace / Products</p>
        <h1>Product Management</h1>
        <p className="subtitle">
          Add, update, search, and manage your clothing inventory.
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
          Record sales and review your transaction history.
        </p>
      </div>
    </header>

    <Sales />
  </section>
)}

{activeSection === "reports" && (
  <section className="page-section">
    <header className="topbar">
      <div>
        <p className="breadcrumb">Workspace / Reports</p>
        <h1>Inventory Reports</h1>
        <p className="subtitle">
          Review your inventory valuation and stock levels.
        </p>
      </div>
    </header>

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
        <p>Estimated value if current stock sells</p>
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
              <tr key={product._id}>
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
  </section>
)}

      </main>
    </div>
  );
}

export default App;