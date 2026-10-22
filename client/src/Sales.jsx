import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";

const API_URL = "http://localhost:5000";

function Sales() {
  const { token } = useAuth();

  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedProduct = products.find(
    (product) => product._id === productId
  );

  const saleQuantity = Number(quantity);

  const totalAmount =
    selectedProduct &&
    Number.isInteger(saleQuantity) &&
    saleQuantity > 0
      ? Number(selectedProduct.sellingPrice) * saleQuantity
      : 0;

  const totalRevenue = sales.reduce(
    (total, sale) => total + (Number(sale.totalAmount) || 0),
    0
  );

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(Number(amount) || 0);

  // Make an authenticated API request.
  const fetchData = useCallback(
    async (path, options = {}) => {
      const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body
            ? { "Content-Type": "application/json" }
            : {}),
          ...options.headers,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || `Request failed with status ${response.status}`
        );
      }

      return data;
    },
    [token]
  );

  // Load products and sales independently.
  const loadData = useCallback(async () => {
    if (!token) {
      setProducts([]);
      setSales([]);
      setError("Your session has expired. Please log in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const results = await Promise.allSettled([
      fetchData("/api/products"),
      fetchData("/api/sales"),
    ]);

    const errors = [];

    // Handle product results.
    if (results[0].status === "fulfilled") {
      const result = results[0].value;

      setProducts(
        Array.isArray(result) ? result : result.products ?? []
      );
    } else {
      setProducts([]);
      errors.push(`Products: ${results[0].reason.message}`);
    }

    // Handle sales results.
    if (results[1].status === "fulfilled") {
      const result = results[1].value;

      setSales(
        Array.isArray(result) ? result : result.sales ?? []
      );
    } else {
      setSales([]);
      errors.push(`Sales history: ${results[1].reason.message}`);
    }

    if (errors.length > 0) {
      setError(errors.join(" "));
    }

    setLoading(false);
  }, [token, fetchData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    if (!productId) {
      setError("Please select a product.");
      return;
    }

    if (!Number.isSafeInteger(saleQuantity) || saleQuantity < 1) {
      setError("Quantity must be a positive whole number.");
      return;
    }

    if (!selectedProduct) {
      setError("The selected product could not be found.");
      return;
    }

    if (saleQuantity > Number(selectedProduct.quantity)) {
      setError(
        `Insufficient stock. Only ${selectedProduct.quantity} item(s) are available.`
      );
      return;
    }

    setSubmitting(true);

    try {
      await fetchData("/api/sales", {
        method: "POST",
        body: JSON.stringify({
          productId,
          quantity: saleQuantity,
        }),
      });

      setMessage("Sale recorded successfully!");

      setProductId("");
      setQuantity("1");

      // Refresh product quantities and sales history.
      await loadData();

      // Notify other sections that inventory has changed.
      window.dispatchEvent(
        new Event("clothstock:refresh-dashboard")
      );
    } catch (err) {
      setError(err.message || "Unable to record sale.");
    } finally {
      setSubmitting(false);
    }
  }

  function getProductName(sale) {
    if (sale.productId && typeof sale.productId === "object") {
      return sale.productId.name || "Unknown product";
    }

    return "Unknown product";
  }

  function getProductCode(sale) {
    if (sale.productId && typeof sale.productId === "object") {
      return sale.productId.code || "—";
    }

    return "—";
  }

  if (loading) {
    return (
      <section className="sales-section">
        <p>Loading sales data...</p>
      </section>
    );
  }

  return (
    <section className="sales-section">
      {message && (
        <div className="sales-message success-message">
          {message}
        </div>
      )}

      {error && (
        <div className="sales-message error-message">
          {error}
        </div>
      )}

      <div className="sales-summary">
        <div className="sales-summary-card">
          <span>Total Recorded Sales</span>
          <h3>{sales.length}</h3>
        </div>

        <div className="sales-summary-card">
          <span>Total Recorded Revenue</span>
          <h3>{formatCurrency(totalRevenue)}</h3>
        </div>
      </div>

      <div className="sales-form-card">
        <h3>Record a Sale</h3>

        <form onSubmit={handleSubmit}>
          <div className="sales-form-grid">
            <div className="form-group">
              <label htmlFor="sale-product">
                Select Product
              </label>

              <select
                id="sale-product"
                value={productId}
                onChange={(event) =>
                  setProductId(event.target.value)
                }
                required
              >
                <option value="">Choose a product</option>

                {products.map((product) => (
                  <option
                    key={product._id}
                    value={product._id}
                    disabled={Number(product.quantity) < 1}
                  >
                    {product.name} ({product.code}) — Stock:{" "}
                    {product.quantity}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="sale-quantity">
                Quantity
              </label>

              <input
                id="sale-quantity"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(event) =>
                  setQuantity(event.target.value)
                }
                required
              />
            </div>
          </div>

          {selectedProduct && (
            <div className="sale-preview">
              <p>
                <span>Available Stock</span>
                <strong>{selectedProduct.quantity}</strong>
              </p>

              <p>
                <span>Unit Price</span>
                <strong>
                  {formatCurrency(selectedProduct.sellingPrice)}
                </strong>
              </p>

              <p>
                <span>Total Amount</span>
                <strong>{formatCurrency(totalAmount)}</strong>
              </p>
            </div>
          )}

          <button
            className="primary-button"
            type="submit"
            disabled={submitting || !token || products.length === 0}
          >
            {submitting ? "Recording Sale..." : "Record Sale"}
          </button>
        </form>
      </div>

      <div className="sales-history-card">
        <h3>Sales History</h3>

        <div className="table-container">
          <table className="products-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Product Code</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total Amount</th>
                <th>Date Sold</th>
              </tr>
            </thead>

            <tbody>
              {sales.length > 0 ? (
                sales.map((sale) => (
                  <tr key={sale._id}>
                    <td>{getProductName(sale)}</td>
                    <td>{getProductCode(sale)}</td>
                    <td>{sale.quantity}</td>
                    <td>{formatCurrency(sale.unitPrice)}</td>
                    <td>{formatCurrency(sale.totalAmount)}</td>
                    <td>
                      {sale.soldAt
                        ? new Date(sale.soldAt).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="empty-state">
                    No sales recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default Sales;