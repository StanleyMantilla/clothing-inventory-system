
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";

const API_URL = "http://localhost:5000";

const initialForm = {
  name: "",
  code: "",
  category: "",
  size: "",
  color: "",
  quantity: "",
  costPrice: "",
  sellingPrice: "",
};

function notifyDashboard() {
  window.dispatchEvent(new Event("clothstock:refresh-dashboard"));
}

function Products() {
  const { token } = useAuth();

  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  function showSuccessToast(text) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  }

  async function loadProducts(searchTerm = "") {
    if (!token) {
      setProducts([]);
      setLoading(false);
      return;
    }

    try {
      setError("");

      const trimmedSearch = searchTerm.trim();

      const endpoint = trimmedSearch
        ? `${API_URL}/api/products/search?q=${encodeURIComponent(trimmedSearch)}`
        : `${API_URL}/api/products`;

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Failed to load products.");
      }

      setProducts(
        Array.isArray(data) ? data : data.products ?? []
      );
    } catch (err) {
      setError(err.message || "Unable to connect to the backend.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) {
      setProducts([]);
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      loadProducts(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search, token]);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setMessage("");
    setError("");
  }

  function handleEdit(product) {
    setEditingId(product._id);

    setForm({
      name: product.name ?? "",
      code: product.code ?? "",
      category: product.category ?? "",
      size: product.size ?? "",
      color: product.color ?? "",
      quantity: String(product.quantity ?? ""),
      costPrice: String(product.costPrice ?? ""),
      sellingPrice: String(product.sellingPrice ?? ""),
    });

    setMessage("");
    setError("");

    document
      .getElementById("product-form")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (saving) return;

    setMessage("");
    setError("");
    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim(),
        category: form.category.trim(),
        size: form.size.trim(),
        color: form.color.trim(),
        quantity: Number(form.quantity),
        costPrice: Number(form.costPrice),
        sellingPrice: Number(form.sellingPrice),
      };

      const response = await fetch(
        editingId
          ? `${API_URL}/api/products/${editingId}`
          : `${API_URL}/api/products`,
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Failed to save product.");
      }

      const wasEditing = Boolean(editingId);

      setMessage("");
      if (wasEditing) {
        showSuccessToast("PRODUCT UPDATED SUCCESSFULLY!");
      } else {
        showSuccessToast("PRODUCT ADDED SUCCESSFULLY!");
      }

      setForm(initialForm);
      setEditingId(null);

      // Refresh this table and notify the dashboard.
      await loadProducts(search);
      notifyDashboard();
    } catch (err) {
      setError(err.message || "Unable to save product.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${product.name}" (${product.code})?`
    );

    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/api/products/${product._id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete product.");
      }

      if (editingId === product._id) {
        setForm(initialForm);
        setEditingId(null);
      }

      setMessage("");
      showSuccessToast("PRODUCT DELETED SUCCESSFULLY!");

      await loadProducts(search);
      notifyDashboard();
    } catch (err) {
      setError(err.message || "Unable to delete product.");
    }
  }

  const currency = (amount) =>
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(Number(amount) || 0);

  return (
    <section className="products-page">
      {toast && (
        <div className="products-success-toast" role="status" aria-live="polite">
          <span className="products-success-toast-icon" aria-hidden="true">✓</span>
          <span>{toast}</span>
        </div>
      )}

      <header className="products-heading">
        <div>
          <p className="products-eyebrow">
            INVENTORY MANAGEMENT
          </p>
          <h1>Products</h1>
          <p>Manage the clothing products in your inventory.</p>
        </div>

        <span className="products-total">
          {products.length} products
        </span>
      </header>

      <div className="products-panel" id="product-form">
        <div className="products-panel-heading">
          <h2>{editingId ? "Edit Product" : "Add New Product"}</h2>
          <p>
            {editingId
              ? "Update the details of this clothing item."
              : "Enter the details of your clothing item."}
          </p>
        </div>

        {message && (
          <div className="products-success" role="status">
            {message}
          </div>
        )}

        {error && (
          <div className="products-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="products-form-grid">
            <label>
              Product Name
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Product Code
              <input
                name="code"
                value={form.code}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Category
              <input
                name="category"
                value={form.category}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Size
              <select
                name="size"
                value={form.size}
                onChange={handleChange}
                required
              >
                <option value="">Select size</option>
                {["XS", "S", "M", "L", "XL", "XXL", "Free Size"].map(
                  (size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Color
              <input
                name="color"
                value={form.color}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Quantity
              <input
                name="quantity"
                type="number"
                min="0"
                step="1"
                value={form.quantity}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Cost Price (₱)
              <input
                name="costPrice"
                type="number"
                min="0"
                step="0.01"
                value={form.costPrice}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              Selling Price (₱)
              <input
                name="sellingPrice"
                type="number"
                min="0"
                step="0.01"
                value={form.sellingPrice}
                onChange={handleChange}
                required
              />
            </label>
          </div>

          <div className="products-form-actions">
            <button
              type="button"
              className="products-clear-button"
              onClick={resetForm}
            >
              {editingId ? "Cancel Edit" : "Clear Form"}
            </button>

            <button
              type="submit"
              className="products-submit-button"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : editingId
                  ? "Save Changes"
                  : "+ Add Product"}
            </button>
          </div>
        </form>
      </div>

      <div className="products-panel">
        <div className="products-panel-heading">
          <h2>Product Inventory</h2>
          <p>Search, edit, or delete saved products.</p>

          <input
            className="products-search"
            type="search"
            placeholder="Search by product name or code..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {loading ? (
          <p className="products-empty">Loading products...</p>
        ) : products.length === 0 ? (
          <p className="products-empty">
            No matching products found.
          </p>
        ) : (
          <div className="products-table-wrapper">
            <table className="products-table">
              <thead>
                <tr>
                  <th>PRODUCT</th>
                  <th>CODE</th>
                  <th>CATEGORY</th>
                  <th>SIZE</th>
                  <th>COLOR</th>
                  <th>QUANTITY</th>
                  <th>COST PRICE</th>
                  <th>SELLING PRICE</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {products.map((product) => (
                  <tr key={product._id}>
                    <td>{product.name}</td>
                    <td>{product.code}</td>
                    <td>{product.category}</td>
                    <td>{product.size}</td>
                    <td>{product.color}</td>
                    <td>{product.quantity}</td>
                    <td>{currency(product.costPrice)}</td>
                    <td>{currency(product.sellingPrice)}</td>
                    <td>
                      <div className="product-actions">
                        <button
                          type="button"
                          className="product-edit-button"
                          onClick={() => handleEdit(product)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="product-delete-button"
                          onClick={() => handleDelete(product)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export default Products;
