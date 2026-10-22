
import { useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useAuth } from "./AuthContext";

const API_URL = "http://localhost:5000";

const QUICK_QUESTIONS = [
  "Which products have 5 or fewer items in stock?",
  "Which products are out of stock?",
  "Show my inventory insights.",
];

function AI() {
  const { token, user } = useAuth();
  const userRoleIsAdmin = user?.role === "admin";

  const [question, setQuestion] = useState(QUICK_QUESTIONS[0]);
  const [answer, setAnswer] = useState("");
  const [products, setProducts] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasAsked, setHasAsked] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportError, setReportError] = useState("");

  async function askQuestion(value = question) {
    const cleanQuestion = value.trim();

    if (!cleanQuestion || loading) return;

    if (!token) {
      setError("Your session token is unavailable. Please log in again.");
      return;
    }

    setQuestion(cleanQuestion);
    setLoading(true);
    setError("");
    setAnswer("");
    setProducts([]);
    setInsights(null);
    setHasAsked(false);

    try {
      const response = await fetch(`${API_URL}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: cleanQuestion }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to check inventory.");
      }

      setAnswer(data.answer || "No response was returned.");
      setProducts(Array.isArray(data.products) ? data.products : []);
      setInsights(data.insights || null);
      setHasAsked(true);
    } catch (err) {
      setError(
        err.message ||
          "Unable to connect to the server. Make sure your backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    askQuestion();
  }

  // Built-in PDF fonts are reliable, but use PHP instead of ₱
  // because the built-in Helvetica font may not support the peso symbol.
  function formatMoney(value) {
    const amount = Number(value || 0);

    return `PHP ${amount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function addReportHeader(doc, title, reportType) {
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(23, 107, 69);
    doc.rect(0, 0, pageWidth, 35, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("ClothStock", 14, 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(title, 14, 24);

    doc.setFontSize(9);
    doc.text(
      `Generated: ${new Date().toLocaleString("en-PH")}`,
      pageWidth - 14,
      15,
      { align: "right" }
    );

    doc.setTextColor(45, 55, 48);
    doc.text(
      `Report type: ${
        reportType === "sales" ? "Sales Report" : "Inventory Report"
      }`,
      14,
      44
    );
  }

  function addReportFooters(doc) {
    const pageCount = doc.internal.getNumberOfPages();

    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setDrawColor(220, 228, 222);
      doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 115, 105);

      doc.text("ClothStock Inventory System", 14, pageHeight - 9);
      doc.text(
        `Page ${page} of ${pageCount}`,
        pageWidth - 14,
        pageHeight - 9,
        { align: "right" }
      );
    }
  }

  function addSectionTitle(doc, title, y) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(23, 107, 69);
    doc.text(title, 14, y);
    doc.setTextColor(45, 55, 48);
  }

  function addSummaryCards(doc, items, startY) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const gap = 4;
    const cardWidth =
      (pageWidth - margin * 2 - gap * (items.length - 1)) /
      items.length;
    const cardHeight = 22;

    items.forEach((item, index) => {
      const x = margin + index * (cardWidth + gap);

      doc.setFillColor(242, 248, 244);
      doc.setDrawColor(218, 232, 222);
      doc.roundedRect(x, startY, cardWidth, cardHeight, 2, 2, "FD");

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(91, 111, 98);
      doc.text(String(item.label), x + 3, startY + 7);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(23, 107, 69);

      const value = doc.splitTextToSize(
        String(item.value),
        cardWidth - 6
      );

      doc.text(value[0] || "0", x + 3, startY + 16);
    });

    return startY + cardHeight + 10;
  }

  function addTable(doc, options) {
    autoTable(doc, {
      theme: "grid",
      margin: { left: 14, right: 14, bottom: 22 },
      styles: {
        font: "helvetica",
        fontStyle: "normal",
        fontSize: 8,
        cellPadding: 3,
        overflow: "linebreak",
        textColor: [45, 55, 48],
        lineColor: [225, 232, 227],
      },
      headStyles: {
        fillColor: [23, 107, 69],
        textColor: [255, 255, 255],
        font: "helvetica",
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [247, 250, 248],
      },
      ...options,
    });
  }

  function addTableSection(doc, title, head, body, startY) {
    let y = startY;

    if (y > 170) {
      doc.addPage();
      y = 20;
    }

    addSectionTitle(doc, title, y);

    addTable(doc, {
      startY: y + 5,
      head: [head],
      body: body.length ? body : [["No records found"]],
    });

    return (doc.lastAutoTable?.finalY || y + 15) + 12;
  }

  async function downloadInventoryPDF(report) {
    const doc = new jsPDF({ orientation: "landscape" });

    const summary = report.summary || {};
    const allProducts = Array.isArray(report.products)
      ? report.products
      : [];
    const lowStock = Array.isArray(report.lowStockProducts)
      ? report.lowStockProducts
      : [];
    const outOfStock = Array.isArray(report.outOfStockProducts)
      ? report.outOfStockProducts
      : [];

    addReportHeader(doc, "Inventory Report", "inventory");

    let y = addSummaryCards(
      doc,
      [
        {
          label: "Total Products",
          value: summary.totalProducts ?? allProducts.length,
        },
        {
          label: "Total Units",
          value:
            summary.totalUnits ??
            allProducts.reduce(
              (total, product) =>
                total + Number(product.quantity || 0),
              0
            ),
        },
        {
          label: "Low Stock",
          value: summary.lowStockCount ?? lowStock.length,
        },
        {
          label: "Out of Stock",
          value: summary.outOfStockCount ?? outOfStock.length,
        },
      ],
      53
    );

    y = addTableSection(
      doc,
      "Complete Inventory",
      [
        "Product Name",
        "Product Code",
        "Category",
        "Size",
        "Color",
        "Quantity",
        "Cost Price",
        "Selling Price",
      ],
      allProducts.length
        ? allProducts.map((product) => [
            product.name || "—",
            product.code || "—",
            product.category || "—",
            product.size || "—",
            product.color || "—",
            String(product.quantity ?? 0),
            formatMoney(product.costPrice),
            formatMoney(product.sellingPrice),
          ])
        : [["No products found"]],
      y
    );

    y = addTableSection(
      doc,
      "Low-Stock Products",
      ["Product Name", "Product Code", "Category", "Quantity"],
      lowStock.length
        ? lowStock.map((product) => [
            product.name || "—",
            product.code || "—",
            product.category || "—",
            String(product.quantity ?? 0),
          ])
        : [["No low-stock products", "—", "—", "—"]],
      y
    );

    y = addTableSection(
      doc,
      "Out-of-Stock Products",
      ["Product Name", "Product Code", "Category", "Quantity"],
      outOfStock.length
        ? outOfStock.map((product) => [
            product.name || "—",
            product.code || "—",
            product.category || "—",
            String(product.quantity ?? 0),
          ])
        : [["No out-of-stock products", "—", "—", "—"]],
      y
    );

    addTableSection(
      doc,
      "Inventory Valuation",
      ["Metric", "Value"],
      [
        [
          "Total Cost Value",
          formatMoney(
            summary.totalCostValue ??
              summary.inventoryCostValue ??
              allProducts.reduce(
                (total, product) =>
                  total +
                  Number(product.quantity || 0) *
                    Number(product.costPrice || 0),
                0
              )
          ),
        ],
        [
          "Total Selling Value",
          formatMoney(
            summary.totalSellingValue ??
              summary.inventorySellingValue ??
              allProducts.reduce(
                (total, product) =>
                  total +
                  Number(product.quantity || 0) *
                    Number(product.sellingPrice || 0),
                0
              )
          ),
        ],
      ],
      y
    );

    addReportFooters(doc);

    doc.save(
      `clothstock-inventory-report-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`
    );
  }

  async function downloadSalesPDF(report) {
    const doc = new jsPDF({ orientation: "landscape" });

    const summary = report.summary || {};
    const sales = Array.isArray(report.sales) ? report.sales : [];

    addReportHeader(doc, "Sales Report", "sales");

    const totalSales =
      summary.totalSales ??
      summary.totalRevenue ??
      summary.totalAmount ??
      sales.reduce(
        (total, sale) => total + Number(sale.totalAmount || 0),
        0
      );

    const totalQuantity =
      summary.totalQuantity ??
      summary.totalUnitsSold ??
      sales.reduce(
        (total, sale) => total + Number(sale.quantity || 0),
        0
      );

    const totalTransactions =
      summary.totalTransactions ??
      summary.totalSalesCount ??
      summary.salesCount ??
      sales.length;

    const y = addSummaryCards(
      doc,
      [
        { label: "Total Revenue", value: formatMoney(totalSales) },
        { label: "Units Sold", value: totalQuantity },
        { label: "Transactions", value: totalTransactions },
      ],
      53
    );

    const salesRows = sales.map((sale) => {
      const product =
        sale.productId && typeof sale.productId === "object"
          ? sale.productId
          : sale.product && typeof sale.product === "object"
            ? sale.product
            : {};

      const rawDate = sale.soldAt || sale.createdAt || sale.date;

      return [
        rawDate ? new Date(rawDate).toLocaleDateString("en-PH") : "—",
        product.name || sale.productName || "—",
        product.code || sale.productCode || "—",
        String(sale.quantity ?? 0),
        formatMoney(sale.unitPrice),
        formatMoney(sale.totalAmount),
      ];
    });

    addTableSection(
      doc,
      "Sales Transaction History",
      [
        "Date",
        "Product",
        "Product Code",
        "Quantity",
        "Unit Price",
        "Total Amount",
      ],
      salesRows.length
        ? salesRows
        : [["No sales records found", "—", "—", "—", "—", "—"]],
      y
    );

    addReportFooters(doc);

    doc.save(
      `clothstock-sales-report-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`
    );
  }

  async function generateReport(reportType) {
    if (!token) {
      setReportError("Your session token is unavailable. Please log in again.");
      return;
    }

    if (reportType === "sales" && !userRoleIsAdmin) {
      setReportError("Only administrators can download sales reports.");
      return;
    }

    setReportLoading(true);
    setReportError("");
    setReportMessage("");

    try {
      const response = await fetch(`${API_URL}/api/ai/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reportType }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to generate report.");
      }

      const report = data.report;

      if (!report || typeof report !== "object") {
        throw new Error("The server returned an invalid report.");
      }

      if (reportType === "inventory") {
        await downloadInventoryPDF(report);
      } else {
        await downloadSalesPDF(report);
      }

      setReportMessage(
        `${reportType === "sales" ? "Sales" : "Inventory"} PDF report downloaded successfully.`
      );
    } catch (err) {
      setReportError(err.message || "Unable to generate PDF report.");
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <div className="clothstock-ai">
      <header className="ai-header">
        <div>
          <p className="ai-eyebrow">SMART INVENTORY TOOLS</p>
          <h1>ClothStock AI</h1>
          <p className="ai-description">
            Check stock levels, find products that need attention,
            and generate inventory insights from your database.
          </p>
        </div>

        <div className="ai-status">
          <span className="ai-status-dot" />
          Free inventory assistant
        </div>
      </header>

      <section className="ai-panel">
        <h2>Ask your inventory assistant</h2>
        <p className="ai-muted">Choose a question or enter your own.</p>

        <div className="ai-quick-questions">
          {QUICK_QUESTIONS.map((item) => (
            <button
              type="button"
              key={item}
              className="ai-quick-button"
              disabled={loading}
              onClick={() => askQuestion(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="ai-form">
          <label htmlFor="ai-question">Your question</label>
          <textarea
            id="ai-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Example: Show my inventory insights."
            rows={3}
            maxLength={1000}
            required
          />

          <button type="submit" className="ai-submit" disabled={loading}>
            {loading ? "Analyzing inventory..." : "Ask ClothStock AI"}
          </button>
        </form>

        {error && <div className="ai-error" role="alert">{error}</div>}

        {loading && (
          <p className="ai-muted" aria-live="polite">
            Checking your latest inventory records...
          </p>
        )}

        {answer && !loading && (
          <div className="ai-answer" aria-live="polite">
            <h3>Inventory assistant response</h3>
            <p>{answer}</p>
            <span className="ai-data-note">
              Calculated from your inventory database
            </span>
          </div>
        )}
      </section>

      <section className="ai-panel">
        <h2>PDF Report Generator</h2>
        <p className="ai-muted">
          Download printable PDF reports generated from your current
          database records. No paid AI service is required.
        </p>

        <div className="ai-quick-questions">
          <button
            type="button"
            className="ai-submit"
            disabled={reportLoading}
            onClick={() => generateReport("inventory")}
          >
            {reportLoading ? "Generating PDF..." : "Download Inventory PDF"}
          </button>

          {userRoleIsAdmin && (
            <button
              type="button"
              className="ai-quick-button"
              disabled={reportLoading}
              onClick={() => generateReport("sales")}
            >
              {reportLoading
                ? "Generating PDF..."
                : "Download Sales PDF (Admin)"}
            </button>
          )}
        </div>

        {reportMessage && (
          <p className="ai-data-note" role="status">{reportMessage}</p>
        )}

        {reportError && (
          <div className="ai-error" role="alert">{reportError}</div>
        )}
      </section>

      {insights && !loading && (
        <section className="ai-insights">
          <div className="ai-section-heading">
            <div>
              <p className="ai-eyebrow">INVENTORY OVERVIEW</p>
              <h2>Smart Stock Insights</h2>
              <p className="ai-muted">
                Your current stock position and products requiring attention.
              </p>
            </div>
          </div>

          <div className="ai-stats-grid">
            <article className="ai-stat-card">
              <span>Total Products</span>
              <strong>{insights.totalProducts ?? 0}</strong>
              <small>Product records</small>
            </article>

            <article className="ai-stat-card">
              <span>Total Units</span>
              <strong>{Number(insights.totalUnits || 0).toLocaleString()}</strong>
              <small>Units in stock</small>
            </article>

            <article className="ai-stat-card ai-stat-warning">
              <span>Low Stock</span>
              <strong>{insights.lowStockCount ?? 0}</strong>
              <small>1–{insights.lowStockLimit ?? 5} units</small>
            </article>

            <article className="ai-stat-card ai-stat-danger">
              <span>Out of Stock</span>
              <strong>{insights.outOfStockCount ?? 0}</strong>
              <small>Zero or fewer units</small>
            </article>
          </div>

          <div className="ai-panel">
            <div className="ai-results-heading">
              <div>
                <h2>Restocking Priorities</h2>
                <p className="ai-muted">
                  Products are ordered from lowest quantity upward.
                </p>
              </div>
              <span className="ai-count">{products.length}</span>
            </div>

            {products.length > 0 ? (
              <div className="ai-table-wrapper">
                <table className="ai-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Code</th>
                      <th>Category</th>
                      <th>Size</th>
                      <th>Color</th>
                      <th>Stock</th>
                      <th>Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => {
                      const quantity = Number(product.quantity) || 0;
                      const outOfStock = quantity <= 0;

                      return (
                        <tr key={product._id || product.code}>
                          <td>{product.name || "Unnamed product"}</td>
                          <td>{product.code || "—"}</td>
                          <td>{product.category || "—"}</td>
                          <td>{product.size || "—"}</td>
                          <td>{product.color || "—"}</td>
                          <td>
                            <span className={
                              outOfStock
                                ? "ai-stock-badge ai-stock-empty"
                                : "ai-stock-badge ai-stock-low"
                            }>
                              {quantity}
                            </span>
                          </td>
                          <td>
                            <span className={
                              outOfStock
                                ? "ai-priority ai-priority-high"
                                : "ai-priority ai-priority-review"
                            }>
                              {outOfStock ? "Urgent review" : "Review"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="ai-empty">
                No low-stock products were found. Your stock is above
                the configured threshold.
              </p>
            )}
          </div>
        </section>
      )}

      {hasAsked && !loading && !insights && products.length === 0 && !error && (
        <section className="ai-panel ai-empty-panel">
          <h2>No matching products</h2>
          <p className="ai-muted">
            There are no products matching this inventory query, or
            you can ask another supported question.
          </p>
        </section>
      )}

      {products.length > 0 && !insights && !loading && (
        <section className="ai-panel">
          <div className="ai-results-heading">
            <div>
              <h2>Inventory Results</h2>
              <p className="ai-muted">
                {products.length} product record(s) returned
              </p>
            </div>
            <span className="ai-count">{products.length}</span>
          </div>

          <div className="ai-table-wrapper">
            <table className="ai-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Code</th>
                  <th>Category</th>
                  <th>Size</th>
                  <th>Color</th>
                  <th>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product._id || product.code}>
                    <td>{product.name || "Unnamed product"}</td>
                    <td>{product.code || "—"}</td>
                    <td>{product.category || "—"}</td>
                    <td>{product.size || "—"}</td>
                    <td>{product.color || "—"}</td>
                    <td>
                      <span className={
                        Number(product.quantity) <= 0
                          ? "ai-stock-badge ai-stock-empty"
                          : "ai-stock-badge ai-stock-low"
                      }>
                        {product.quantity ?? 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <style>{`
        .clothstock-ai {
          display: flex;
          flex-direction: column;
          gap: 22px;
          width: 100%;
          color: #24352c;
        }
        .ai-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }
        .ai-header h1 {
          margin: 4px 0 8px;
          font-size: clamp(26px, 3vw, 34px);
        }
        .ai-description {
          margin: 0;
          color: #64756b;
          line-height: 1.6;
        }
        .ai-eyebrow {
          margin: 0 0 7px;
          color: #176b45;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 1.3px;
        }
        .ai-status {
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1px solid #d9e8df;
          background: #f1f8f3;
          color: #176b45;
          padding: 10px 14px;
          border-radius: 24px;
          font-size: 13px;
          font-weight: 700;
        }
        .ai-status-dot {
          width: 8px;
          height: 8px;
          background: #26975d;
          border-radius: 50%;
        }
        .ai-panel {
          background: #fff;
          border: 1px solid #e4ebe6;
          border-radius: 16px;
          padding: 24px;
          min-width: 0;
          box-shadow: 0 4px 18px rgba(24, 65, 42, 0.04);
        }
        .ai-panel h2, .ai-section-heading h2 {
          margin: 0 0 8px;
          font-size: 19px;
        }
        .ai-muted {
          color: #718077;
          font-size: 14px;
          line-height: 1.5;
        }
        .ai-quick-questions {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          margin: 18px 0;
        }
        .ai-quick-button {
          background: #f3f8f4;
          border: 1px solid #dce9df;
          color: #176b45;
          border-radius: 9px;
          padding: 10px 12px;
          cursor: pointer;
          text-align: left;
        }
        .ai-quick-button:hover { background: #e7f3ea; }
        .ai-form { display: flex; flex-direction: column; gap: 10px; }
        .ai-form label { font-weight: 700; font-size: 14px; }
        .ai-form textarea {
          width: 100%;
          box-sizing: border-box;
          resize: vertical;
          border: 1px solid #d8e2db;
          border-radius: 10px;
          padding: 13px;
          font: inherit;
          outline-color: #176b45;
        }
        .ai-submit {
          align-self: flex-start;
          border: none;
          border-radius: 9px;
          background: #176b45;
          color: white;
          padding: 12px 18px;
          font-weight: 700;
          cursor: pointer;
        }
        .ai-submit:hover { background: #104c33; }
        .ai-submit:disabled, .ai-quick-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .ai-answer {
          margin-top: 22px;
          padding: 18px;
          background: #f1f8f3;
          border: 1px solid #d8e9dd;
          border-radius: 12px;
        }
        .ai-answer h3 { margin: 0 0 8px; font-size: 16px; }
        .ai-answer p { line-height: 1.6; margin: 0 0 12px; }
        .ai-data-note { font-size: 12px; color: #587462; }
        .ai-error {
          margin-top: 16px;
          background: #fff2f0;
          color: #a52b21;
          border: 1px solid #f0d1cd;
          border-radius: 10px;
          padding: 12px;
        }
        .ai-insights { display: flex; flex-direction: column; gap: 18px; }
        .ai-section-heading .ai-muted { margin: 0; }
        .ai-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }
        .ai-stat-card {
          display: flex;
          flex-direction: column;
          gap: 9px;
          background: #fff;
          border: 1px solid #e4ebe6;
          border-radius: 14px;
          padding: 18px;
          min-width: 0;
        }
        .ai-stat-card span { color: #64756b; font-size: 13px; }
        .ai-stat-card strong {
          font-size: clamp(23px, 3vw, 30px);
          overflow-wrap: anywhere;
        }
        .ai-stat-card small { color: #718077; font-size: 12px; }
        .ai-stat-warning { background: #fffaf0; border-color: #f1dfb7; }
        .ai-stat-warning strong { color: #8a5900; }
        .ai-stat-danger { background: #fff5f4; border-color: #f0d1cd; }
        .ai-stat-danger strong { color: #a52b21; }
        .ai-results-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }
        .ai-results-heading h2 { margin-bottom: 4px; }
        .ai-results-heading p { margin: 0; }
        .ai-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #e8f4eb;
          color: #176b45;
          font-weight: 800;
        }
        .ai-table-wrapper { width: 100%; overflow-x: auto; }
        .ai-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 14px;
        }
        .ai-table th, .ai-table td {
          padding: 13px 12px;
          border-bottom: 1px solid #edf1ee;
          white-space: nowrap;
        }
        .ai-table th {
          background: #f6f8f6;
          color: #506258;
          font-weight: 700;
        }
        .ai-stock-badge, .ai-priority {
          display: inline-block;
          text-align: center;
          padding: 5px 8px;
          border-radius: 7px;
          font-weight: 800;
          font-size: 12px;
        }
        .ai-stock-low { background: #fff2d9; color: #8a5900; }
        .ai-stock-empty { background: #ffe7e5; color: #a52b21; }
        .ai-priority-high { background: #ffe7e5; color: #a52b21; }
        .ai-priority-review { background: #fff2d9; color: #8a5900; }
        .ai-empty { color: #718077; line-height: 1.6; margin-bottom: 0; }
        @media (max-width: 900px) {
          .ai-stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 600px) {
          .ai-panel { padding: 16px; }
          .ai-submit { width: 100%; }
          .ai-stats-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
          .ai-stat-card { padding: 13px; }
        }
      `}</style>
    </div>
  );
}

export default AI;
