import { useEffect, useState } from "react";

function Sales() {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedProduct = products.find(
    (product) => product._id === productId
  );

  const totalAmount =
    selectedProduct && Number(quantity) > 0
      ? selectedProduct.sellingPrice * Number(quantity)
      : 0;

  const totalRevenue = sales.reduce(
    (total, sale) => total + Number(sale.totalAmount || 0),
    0
  );

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [productsResponse, salesResponse] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/sales"),
      ]);

      const productsData = await productsResponse.json();
      const salesData = await salesResponse.json();

      if (!productsResponse.ok) {
        throw new Error(
          productsData.message || "Failed to load products."
        );
      }

      if (!salesResponse.ok) {
        throw new Error(
          salesData.message || "Failed to load sales."
        );
      }

      const productsList = Array.isArray(productsData)
        ? productsData
        : productsData.products || [];

      const salesList = Array.isArray(salesData)
        ? salesData
        : salesData.sales || [];

      setProducts(productsList);
      setSales(salesList);
    } catch (err) {
      setError(err.message || "Unable to load sales data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    const saleQuantity = Number(quantity);

    if (!productId) {
      setError("Please select a product.");
      return;
    }

    if (
      !Number.isInteger(saleQuantity) ||
      saleQuantity < 1
    ) {
      setError("Quantity must be a positive whole number.");
      return;
    }

    if (!selectedProduct) {
      setError("Selected product could not be found.");
      return;
    }

    if (saleQuantity > selectedProduct.quantity) {
      setError(
        `Insufficient stock. Only ${selectedProduct.quantity} item(s) are available.`
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId,
          quantity: saleQuantity,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to record sale.");
      }

      setMessage("Sale recorded successfully!");

      setProductId("");
      setQuantity(1);

      await loadData();
    } catch (err) {
      setError(err.message || "Unable to record sale.");
    } finally {
      setSubmitting(false);
    }
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(Number(amount) || 0);
  }

  function getProductName(sale) {
    if (sale.productId && typeof sale.productId === "object") {
      return sale.productId.name || "Unknown product";
    }

    return "Product";
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
      <div className="section-heading">
        <div>
          <h2>Sales Management</h2>
          <p>Record clothing sales and monitor sales history.</p>
        </div>
      </div>

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
              <label htmlFor="sale-product">Select Product</label>

              <select
                id="sale-product"
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                required
              >
                <option value="">Choose a product</option>

                {products.map((product) => (
                  <option
                    key={product._id}
                    value={product._id}
                    disabled={product.quantity < 1}
                  >
                    {product.name} ({product.code}) — Stock:{" "}
                    {product.quantity}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="sale-quantity">Quantity</label>

              <input
                id="sale-quantity"
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
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
            disabled={submitting}
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