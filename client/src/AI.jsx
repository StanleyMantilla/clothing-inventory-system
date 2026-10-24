import { useCallback, useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useAuth } from "./AuthContext";

const API_URL = "http://localhost:5000";
const LOW_STOCK_LIMIT = 5;

const QUICK_QUESTIONS = [
  "Which products have 5 or fewer items in stock?",
  "Which products are out of stock?",
  "Show my inventory insights.",
];

function getErrorMessage(data, fallback) {
  return data?.message || data?.error || fallback;
}

function formatMoney(value) {
  return `PHP ${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeMessage(message, index) {
  return {
    ...message,
    id: message._id || `${message.createdAt || "message"}-${index}`,
    role: message.role === "user" ? "user" : "assistant",
    content: String(message.content || ""),
    results: message.results || null,
  };
}

function AI() {
  const requestInProgressRef = useRef(false);

  const { token, user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [products, setProducts] = useState([]);
  const [insights, setInsights] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasAsked, setHasAsked] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);

  const [reportLoading, setReportLoading] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [reportError, setReportError] = useState("");

  const authHeaders = useCallback(
    (includeJson = false) => ({
      ...(includeJson ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${token}`,
    }),
    [token]
  );

  const requestJson = useCallback(
    async (url, options = {}) => {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...authHeaders(Boolean(options.body)),
          ...(options.headers || {}),
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            response.status === 401
              ? "Your session has expired. Please log in again."
              : "The request could not be completed."
          )
        );
      }

      return data;
    },
    [authHeaders]
  );

  const loadConversations = useCallback(async () => {
    if (!token) {
      setConversations([]);
      return;
    }

    setHistoryLoading(true);
    setHistoryError("");

    try {
      const data = await requestJson(`${API_URL}/api/ai/conversations`);
      setConversations(
        Array.isArray(data.conversations) ? data.conversations : []
      );
    } catch (err) {
      setHistoryError(err.message || "Unable to load conversations.");
    } finally {
      setHistoryLoading(false);
    }
  }, [token, requestJson]);

  const loadInsights = useCallback(async () => {
    if (!token) {
      setInsights(null);
      return;
    }

    try {
      const data = await requestJson(`${API_URL}/api/ai/insights`);

      setInsights(data.insights || null);
    } catch (err) {
      console.error("Unable to load inventory insights:", err.message);
    }
  }, [token, requestJson]);

  useEffect(() => {
    if (!token) {
      setConversations([]);
      setChatMessages([]);
      setActiveConversationId(null);
      setInsights(null);
      return;
    }

    loadConversations();
    loadInsights();
  }, [token, loadConversations, loadInsights]);

  function clearCurrentChat() {
    if (loading) return;

    setActiveConversationId(null);
    setChatMessages([]);
    setQuestion("");
    setAnswer("");
    setProducts([]);
    setHasAsked(false);
    setError("");
    setHistoryError("");
    setSidebarOpen(false);
  }

  async function openConversation(id) {
    if (!token || !id || loading) return;

    setHistoryError("");
    setError("");

    try {
      const data = await requestJson(
        `${API_URL}/api/ai/conversations/${id}`
      );

      const conversation = data.conversation;

      if (!conversation?._id) {
        throw new Error("The server did not return this conversation.");
      }

      const messages = Array.isArray(conversation.messages)
        ? conversation.messages.map(normalizeMessage)
        : [];

      setActiveConversationId(conversation._id);
      setChatMessages(messages);
      setQuestion("");
      setAnswer("");
      setProducts([]);
      setHasAsked(messages.length > 0);
      setInsights(null);
      setSidebarOpen(false);

      // Restore the latest saved structured results, if available.
      const latestAssistant = [...messages]
        .reverse()
        .find((message) => message.role === "assistant" && message.results);

      if (latestAssistant?.results) {
        setAnswer(latestAssistant.content);
        setProducts(
          Array.isArray(latestAssistant.results.products)
            ? latestAssistant.results.products
            : []
        );
        setInsights(latestAssistant.results.insights || null);
      } else {
        // The live overview can still be shown even if older messages
        // were saved without structured results.
        await loadInsights();
      }
    } catch (err) {
      setHistoryError(err.message || "Unable to open conversation.");
    }
  }

  async function deleteConversation(id) {
    if (!token || !id || loading) return;
    if (!window.confirm("Permanently delete this conversation?")) return;

    setHistoryError("");

    try {
      await requestJson(`${API_URL}/api/ai/conversations/${id}`, {
        method: "DELETE",
      });

      if (activeConversationId === id) {
        setActiveConversationId(null);
        setChatMessages([]);
        setAnswer("");
        setProducts([]);
        setInsights(null);
        setHasAsked(false);
      }

      await loadConversations();
    } catch (err) {
      setHistoryError(err.message || "Unable to delete conversation.");
    }
  }

  async function askQuestion(value = question) {
  const cleanQuestion = String(value || "").trim();

  // Block duplicate submissions immediately, before React re-renders.
  if (!cleanQuestion || requestInProgressRef.current) return;

  if (!token) {
    setError("Your session is unavailable. Please log in again.");
    return;
  }

  requestInProgressRef.current = true;
  setLoading(true);

    setQuestion(cleanQuestion);
    setLoading(true);
    setError("");
    setAnswer("");
    setProducts([]);
    setHasAsked(false);

    const userMessage = {
      role: "user",
      content: cleanQuestion,
      createdAt: new Date().toISOString(),
    };

    setChatMessages((previous) => [...previous, userMessage]);

    try {
      const data = await requestJson(`${API_URL}/api/ai/chat`, {
        method: "POST",
        body: JSON.stringify({
          question: cleanQuestion,
          conversationId: activeConversationId,
        }),
      });

      const responseText = data.answer || "No response was returned.";
      const responseProducts = Array.isArray(data.products)
        ? data.products
        : [];
      const responseInsights = data.insights || null;

      setAnswer(responseText);
      setProducts(responseProducts);
      setInsights(responseInsights);
      setHasAsked(true);

      if (data.conversationId) {
        setActiveConversationId(data.conversationId);
      }

      setChatMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: responseText,
          createdAt: new Date().toISOString(),
          results: {
            products: responseProducts,
            insights: responseInsights,
            intent: data.intent || null,
          },
        },
      ]);

      setQuestion("");
      await Promise.all([loadConversations(), loadInsights()]);
    } catch (err) {
      // Remove the temporary question from the UI if the request failed.
      setChatMessages((previous) =>
        previous.filter((message) => message !== userMessage)
      );

      setError(
        err.message ||
          "Unable to connect. Make sure the backend is running."
      );
      } finally {
    requestInProgressRef.current = false;
    setLoading(false);
  }
}

  function handleSubmit(event) {
    event.preventDefault();

    if (loading || !question.trim()) return;

    askQuestion(question);
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
      `Report type: ${reportType === "sales" ? "Sales Report" : "Inventory Report"}`,
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
      doc.text(`Page ${page} of ${pageCount}`, pageWidth - 14, pageHeight - 9, {
        align: "right",
      });
    }
  }

  function addTable(doc, options) {
    autoTable(doc, {
      theme: "grid",
      margin: { left: 14, right: 14, bottom: 22 },
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: 3,
        overflow: "linebreak",
        textColor: [45, 55, 48],
        lineColor: [225, 232, 227],
      },
      headStyles: {
        fillColor: [23, 107, 69],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [247, 250, 248] },
      ...options,
    });
  }

  function addTableSection(doc, title, head, body, startY) {
    let y = startY;

    if (y > 170) {
      doc.addPage();
      y = 20;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(23, 107, 69);
    doc.text(title, 14, y);

    addTable(doc, {
      startY: y + 5,
      head: [head],
      body: body.length ? body : [["No records found"]],
    });

    return (doc.lastAutoTable?.finalY || y + 15) + 12;
  }

  function addSummaryCards(doc, items, startY) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const gap = 4;
    const cardWidth =
      (pageWidth - margin * 2 - gap * (items.length - 1)) / items.length;
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

      const value = doc.splitTextToSize(String(item.value), cardWidth - 6);
      doc.text(value[0] || "0", x + 3, startY + 16);
    });

    return startY + cardHeight + 10;
  }

  async function downloadInventoryPDF(report) {
    const doc = new jsPDF({ orientation: "landscape" });
    const summary = report.summary || {};
    const allProducts = Array.isArray(report.products) ? report.products : [];
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
        { label: "Total Products", value: summary.totalProducts ?? allProducts.length },
        {
          label: "Total Units",
          value:
            summary.totalUnits ??
            allProducts.reduce((sum, product) => sum + Number(product.quantity || 0), 0),
        },
        { label: "Low Stock", value: summary.lowStockCount ?? lowStock.length },
        { label: "Out of Stock", value: summary.outOfStockCount ?? outOfStock.length },
      ],
      53
    );

    y = addTableSection(
      doc,
      "Complete Inventory",
      ["Product Name", "Code", "Category", "Size", "Color", "Quantity", "Cost Price", "Selling Price"],
      allProducts.map((product) => [
        product.name || "—",
        product.code || "—",
        product.category || "—",
        product.size || "—",
        product.color || "—",
        String(product.quantity ?? 0),
        formatMoney(product.costPrice),
        formatMoney(product.sellingPrice),
      ]),
      y
    );

    y = addTableSection(
      doc,
      "Low-Stock Products",
      ["Product Name", "Code", "Category", "Quantity"],
      lowStock.map((product) => [
        product.name || "—",
        product.code || "—",
        product.category || "—",
        String(product.quantity ?? 0),
      ]),
      y
    );

    y = addTableSection(
      doc,
      "Out-of-Stock Products",
      ["Product Name", "Code", "Category", "Quantity"],
      outOfStock.map((product) => [
        product.name || "—",
        product.code || "—",
        product.category || "—",
        String(product.quantity ?? 0),
      ]),
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
              allProducts.reduce(
                (sum, product) =>
                  sum + Number(product.quantity || 0) * Number(product.costPrice || 0),
                0
              )
          ),
        ],
        [
          "Total Selling Value",
          formatMoney(
            summary.totalSellingValue ??
              allProducts.reduce(
                (sum, product) =>
                  sum + Number(product.quantity || 0) * Number(product.sellingPrice || 0),
                0
              )
          ),
        ],
      ],
      y
    );

    addReportFooters(doc);
    doc.save(`clothstock-inventory-report-${new Date().toISOString().slice(0, 10)}.pdf`);
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
      sales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);

    const totalQuantity =
      summary.totalQuantity ??
      summary.totalUnitsSold ??
      sales.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);

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

    const rows = sales.map((sale) => {
      const product =
        sale.productId && typeof sale.productId === "object"
          ? sale.productId
          : sale.product && typeof sale.product === "object"
            ? sale.product
            : {};

      const date = sale.soldAt || sale.createdAt || sale.date;

      return [
        date ? new Date(date).toLocaleDateString("en-PH") : "—",
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
      ["Date", "Product", "Product Code", "Quantity", "Unit Price", "Total Amount"],
      rows,
      y
    );

    addReportFooters(doc);
    doc.save(`clothstock-sales-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  async function generateReport(reportType) {
    if (!token) {
      setReportError("Your session is unavailable. Please log in again.");
      return;
    }

    if (reportType === "sales" && !isAdmin) {
      setReportError("Only administrators can download sales reports.");
      return;
    }

    setReportLoading(true);
    setReportError("");
    setReportMessage("");

    try {
      const data = await requestJson(`${API_URL}/api/ai/report`, {
        method: "POST",
        body: JSON.stringify({ reportType }),
      });

      if (!data.report || typeof data.report !== "object") {
        throw new Error("The server returned an invalid report.");
      }

      if (reportType === "inventory") {
        await downloadInventoryPDF(data.report);
      } else {
        await downloadSalesPDF(data.report);
      }

      setReportMessage(
        `${reportType === "sales" ? "Sales" : "Inventory"} PDF downloaded successfully.`
      );
    } catch (err) {
      setReportError(err.message || "Unable to generate PDF report.");
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <div className="cs-ai">
      <aside className={`cs-sidebar ${sidebarOpen ? "cs-sidebar-open" : ""}`}>
        <div className="cs-brand">
          <div className="cs-brand-icon">C</div>
          <div>
            <strong>ClothStock</strong>
            <span>AI WORKSPACE</span>
          </div>
          <button
            type="button"
            className="cs-mobile-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            ×
          </button>
        </div>

        <button
          type="button"
          className="cs-new-chat"
          disabled={loading}
          onClick={clearCurrentChat}
        >
          <span>＋</span> New conversation
        </button>

        <div className="cs-history-heading">
          <span>YOUR CONVERSATIONS</span>
          <span>{conversations.length}</span>
        </div>

        <div className="cs-history">
          {historyLoading && <p className="cs-sidebar-note">Loading conversations...</p>}

          {!historyLoading && !historyError && conversations.length === 0 && (
            <p className="cs-sidebar-note">
              Your saved conversations will appear here after your first question.
            </p>
          )}

          {conversations.map((conversation) => (
            <div
              key={conversation._id}
              className={`cs-history-item ${
                activeConversationId === conversation._id ? "cs-history-active" : ""
              }`}
            >
              <button
                type="button"
                className="cs-history-open"
                disabled={loading}
                title={conversation.title || "Conversation"}
                onClick={() => openConversation(conversation._id)}
              >
                <span className="cs-history-symbol">▤</span>
                <span className="cs-history-title">
                  {conversation.title || "New conversation"}
                </span>
              </button>
              <button
                type="button"
                className="cs-delete-chat"
                disabled={loading}
                aria-label={`Delete ${conversation.title || "conversation"}`}
                title="Delete conversation"
                onClick={() => deleteConversation(conversation._id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {historyError && (
          <div className="cs-sidebar-error" role="alert">
            {historyError}
            <button type="button" onClick={loadConversations}>Retry</button>
          </div>
        )}

        <div className="cs-sidebar-footer">
          <div className="cs-avatar">
            {(user?.name || user?.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="cs-user-info">
            <strong>{user?.name || user?.email || "ClothStock user"}</strong>
            <span>{isAdmin ? "Administrator" : "Staff account"}</span>
          </div>
          <span className="cs-secure-dot" title="Authenticated session" />
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="cs-sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="cs-main">
        <header className="cs-topbar">
          <button
            type="button"
            className="cs-menu-button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open conversations"
          >
            ☰
          </button>
          <div className="cs-topbar-title">
            <span className="cs-online-dot" />
            <span>Inventory Assistant</span>
            <span className="cs-beta">WORKSPACE</span>
          </div>
          <div className="cs-topbar-actions">
            <button
              type="button"
              className="cs-tools-menu-button"
              onClick={() => setToolsMenuOpen((open) => !open)}
              aria-expanded={toolsMenuOpen}
              aria-controls="cs-tools-menu"
              title="Open inventory tools"
            >
              <span className="cs-tools-menu-icon">☰</span> Tools
            </button>
            <button
              type="button"
              className="cs-topbar-new"
            disabled={loading}
            onClick={clearCurrentChat}
            >
              ＋ New chat
            </button>
          </div>
        </header>

        <div className="cs-ai-toolbar">
          <button
            type="button"
            className="cs-left-new-chat"
            disabled={loading}
            onClick={clearCurrentChat}
          >
            <span className="cs-left-new-chat-icon">＋</span>
            <span>New Chat</span>
          </button>
          <div className="cs-ai-breadcrumb">
            <span>Workspace</span><span className="cs-breadcrumb-slash">/</span><strong>ClothStock AI</strong>
          </div>
        </div>

<section className="cs-hero-banner">
  <div className="cs-hero-copy">
    <span className="cs-hero-badge">✦ AI ASSISTANT</span>
    <h2>
      Hello, I’m <span>ClothStock AI</span> ✦
    </h2>
    <p>
      Your intelligent inventory assistant. Get useful insights,
      make better decisions, and keep your stock running smoothly.
    </p>
    <div className="cs-hero-tags">
      <span>▣ Inventory Insights</span>
      <span>▥ Sales Analysis</span>
      <span>♧ Stock Alerts</span>
      <span>✧ Smart Recommendations</span>
    </div>
  </div>
  <div className="cs-hero-art" aria-hidden="true">
    <div className="cs-hero-orbit">✦</div>
    <div className="cs-hero-robot">
      <div className="cs-robot-antenna" />
      <div className="cs-robot-head">
        <div className="cs-robot-eye" />
        <div className="cs-robot-eye" />
        <div className="cs-robot-smile">⌣</div>
      </div>
      <div className="cs-robot-body">
        <span>C</span>
      </div>
    </div>
    <div className="cs-hero-speech">
      Smarter inventory.
      <br />
      Better business.
    </div>
  </div>
</section>


        <div className="cs-workspace">
          <section className="cs-chat-column">
            <div className="cs-chat-scroll">
              {chatMessages.length === 0 && !loading ? (
                <div className="cs-welcome">
                  <div className="cs-welcome-icon">✦</div>
                  <p className="cs-eyebrow">YOUR INVENTORY, SIMPLIFIED</p>
                  <h1>What would you like to know?</h1>
                  <p className="cs-welcome-text">
                    Ask questions about your clothing inventory and get useful
                    answers based on your database.
                  </p>
                  <div className="cs-suggestions">
                    {QUICK_QUESTIONS.map((item, index) => (
                      <button
                        key={item}
                        type="button"
                        className="cs-suggestion"
                        disabled={loading || !token}
                        onClick={() => askQuestion(item)}
                      >
                        <span className="cs-suggestion-icon">
                          {["◉", "!", "↗"][index]}
                        </span>
                        <span>{item}</span>
                        <span className="cs-suggestion-arrow">↗</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="cs-messages">
                  {chatMessages.map((message, index) => (
                    <div
                      key={message.id || `${message.createdAt || "message"}-${index}`}
                      className={`cs-message ${
                        message.role === "user" ? "cs-message-user" : "cs-message-assistant"
                      }`}
                    >
                      <div className="cs-message-avatar">
                        {message.role === "user" ? "U" : "✦"}
                      </div>
                      <div className="cs-message-body">
                        <span className="cs-message-role">
                          {message.role === "user" ? "You" : "ClothStock AI"}
                        </span>
                        <p>{message.content}</p>
                      </div>
                    </div>
                  ))}

                  {loading && (
                    <div className="cs-message cs-message-assistant">
                      <div className="cs-message-avatar">✦</div>
                      <div className="cs-message-body">
                        <span className="cs-message-role">ClothStock AI</span>
                        <p className="cs-thinking">Checking your inventory records...</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="cs-error" role="alert">
                  <strong>Unable to complete your request</strong>
                  <p>{error}</p>
                </div>
              )}

              {answer && !loading && (
                <section className="cs-result-panel">
                  <div className="cs-result-heading">
                    <div>
                      <span className="cs-eyebrow">LATEST RESPONSE DATA</span>
                      <h3>Inventory results</h3>
                    </div>
                    <span className="cs-result-badge">Database</span>
                  </div>

                  {insights && <InsightStats insights={insights} />}

                  {products.length > 0 && <ProductTable products={products} />}

                  {products.length === 0 && !insights && hasAsked && (
                    <p className="cs-no-results">
                      No product records were returned for this question.
                    </p>
                  )}

                  <p className="cs-data-note">
                    Results reflect the response returned by your inventory backend.
                  </p>
                </section>
              )}
            </div>

            <div className="cs-composer-area">
              <form className="cs-composer" onSubmit={handleSubmit}>
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Ask about stock levels, products, or inventory insights..."
                  rows={2}
                  maxLength={1000}
                  disabled={loading || !token}
                  aria-label="Ask ClothStock AI a question"
                />
                <div className="cs-composer-bottom">
                  <span>Answers use your ClothStock database</span>
                  <button
                    type="submit"
                    className="cs-send"
                    disabled={loading || !token || !question.trim()}
                  >
                    {loading ? "Checking..." : "Send question"} <span>↑</span>
                  </button>
                </div>
              </form>
              <p className="cs-disclaimer">
                Verify important stock decisions against your inventory records.
              </p>
            </div>
          </section>

          <aside id="cs-tools-menu" className={`cs-insights-column ${toolsMenuOpen ? "cs-tools-menu-open" : ""}`} aria-hidden={!toolsMenuOpen}>
            <div className="cs-tools-menu-header">
              <div><strong>Inventory tools</strong><span>Insights, activity & reports</span></div>
              <button type="button" onClick={() => setToolsMenuOpen(false)} aria-label="Close tools menu">×</button>
            </div>
            <section className="cs-side-card">
              <div className="cs-side-card-heading">
                <div className="cs-side-icon">✧</div>
                <div>
                  <h3>Inventory overview</h3>
                  <p>Latest inventory insights</p>
                </div>
              </div>

              {insights ? (
                <InsightStats insights={insights} />
              ) : (
                <p className="cs-side-empty">
                  Inventory insights will appear here when the server returns them.
                </p>
              )}
            </section>

            <section className="cs-side-card">
              <div className="cs-side-card-heading">
                <div className="cs-side-icon cs-side-icon-soft">↗</div>
                <div>
                  <h3>Quick questions</h3>
                  <p>Start with a common task</p>
                </div>
              </div>
              <div className="cs-quick-list">
                {QUICK_QUESTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    disabled={loading || !token}
                    onClick={() => askQuestion(item)}
                  >
                    <span>{item}</span><span>→</span>
                  </button>
                ))}
              </div>
            </section>

            
<section className="cs-side-card cs-activity-card">
  <div className="cs-side-card-heading">
    <div className="cs-side-icon">◷</div>
    <div>
      <h3>Recent Activity</h3>
      <p>Your recent AI conversations</p>
    </div>
  </div>

  <div className="cs-activity-list">
    {conversations.slice(0, 4).map((conversation, index) => (
      <button
        type="button"
        className="cs-activity-item"
        key={conversation._id}
        disabled={loading}
        onClick={() => openConversation(conversation._id)}
      >
        <span className={`cs-activity-icon cs-activity-${index}`}>
          {["✦", "▤", "↗", "◉"][index]}
        </span>
        <span className="cs-activity-copy">
          <strong>{conversation.title || "AI conversation"}</strong>
          <small>Open saved conversation</small>
        </span>
        <span className="cs-activity-arrow">→</span>
      </button>
    ))}

    {conversations.length === 0 && (
      <p className="cs-side-empty">
        Your recent conversations will appear here.
      </p>
    )}
  </div>
</section>


            <section className="cs-side-card cs-report-card">
              <div className="cs-side-card-heading">
                <div className="cs-side-icon cs-side-icon-soft">▤</div>
                <div>
                  <h3>Export reports</h3>
                  <p>Download printable PDFs</p>
                </div>
              </div>

              <button
                type="button"
                className="cs-report-button"
                onClick={() => generateReport("inventory")}
                disabled={reportLoading || !token}
              >
                <span>Inventory report</span><span>{reportLoading ? "…" : "↓"}</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  className="cs-report-button"
                  onClick={() => generateReport("sales")}
                  disabled={reportLoading || !token}
                >
                  <span>Sales report</span><span>{reportLoading ? "…" : "↓"}</span>
                </button>
              )}

              {reportMessage && <p className="cs-report-success" role="status">{reportMessage}</p>}
              {reportError && <p className="cs-report-error" role="alert">{reportError}</p>}

              <p className="cs-report-note">
                {isAdmin
                  ? "Inventory and sales reports are available to administrators."
                  : "Inventory reports are available to your account."}
              </p>
            </section>

            <div className="cs-security-note">
              <span>✓</span>
              <p><strong>Secure workspace</strong><br />Requests use your authenticated session.</p>
            </div>
          </aside>
        </div>
      </main>

      <style>{`
        .cs-ai {
          --cs-green:#176b45; --cs-dark:#104c33; --cs-text:#26372d;
          --cs-muted:#7a887f; --cs-border:#e4ebe6;
          display:flex; min-height:760px; height:calc(100vh - 110px);
          max-height:1050px; overflow:hidden; border:1px solid var(--cs-border);
          border-radius:18px; background:#f7f9f7; color:var(--cs-text);
          font-family:Inter,system-ui,-apple-system,sans-serif;
        }
        .cs-ai * {box-sizing:border-box}
        .cs-sidebar {width:255px;flex:0 0 255px;display:flex;flex-direction:column;padding:22px 14px 14px;background:#fff;border-right:1px solid var(--cs-border);min-height:0}
        .cs-brand {display:flex;align-items:center;gap:10px;padding:0 6px 25px}
        .cs-brand-icon {display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:var(--cs-green);color:white;font-size:21px;font-weight:800}
        .cs-brand strong,.cs-brand span {display:block}
        .cs-brand strong {font-size:15px}
        .cs-brand span {margin-top:3px;color:var(--cs-muted);font-size:9px;letter-spacing:1.4px;font-weight:800}
        .cs-mobile-close {display:none}
        .cs-new-chat,.cs-topbar-new,.cs-report-button {cursor:pointer}
        .cs-new-chat {width:100%;display:flex;align-items:center;gap:9px;padding:12px;border:1px solid #d8e7dc;border-radius:10px;background:#f0f7f2;color:var(--cs-green);font:inherit;font-size:12px;font-weight:750}
        .cs-new-chat span {font-size:19px}
        .cs-history-heading {display:flex;justify-content:space-between;gap:6px;margin:27px 5px 12px;color:var(--cs-muted);font-size:9px;letter-spacing:.7px;font-weight:800}
        .cs-history-heading span:last-child {background:#f0f3f1;padding:2px 6px;border-radius:5px}
        .cs-history {display:flex;flex-direction:column;gap:5px;overflow-y:auto;min-height:0;flex:1}
        .cs-history-item {display:flex;align-items:center;gap:2px;border-radius:8px}
        .cs-history-item:hover,.cs-history-active {background:#edf5ef}
        .cs-history-open {flex:1;min-width:0;display:flex;align-items:center;gap:8px;padding:10px 7px;border:0;background:transparent;text-align:left;color:#4f6055;font:inherit;font-size:11px;cursor:pointer}
        .cs-history-title {overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
        .cs-history-symbol {flex-shrink:0}
        .cs-delete-chat {width:27px;height:27px;margin-right:4px;border:0;border-radius:6px;background:transparent;color:#89968d;font-size:17px;cursor:pointer;opacity:0}
        .cs-history-item:hover .cs-delete-chat,.cs-delete-chat:focus-visible {opacity:1}
        .cs-sidebar-note,.cs-side-empty {color:var(--cs-muted);font-size:11px;line-height:1.7}
        .cs-sidebar-error {padding:10px;color:#a52b21;font-size:11px;line-height:1.5;overflow-wrap:anywhere}
        .cs-sidebar-error button {display:block;margin-top:5px;border:0;background:none;color:var(--cs-green);cursor:pointer}
        .cs-sidebar-footer {display:flex;align-items:center;gap:9px;padding:14px 3px 2px;margin-top:12px;border-top:1px solid var(--cs-border)}
        .cs-avatar {display:grid;place-items:center;flex-shrink:0;width:34px;height:34px;border-radius:50%;background:#dceee1;color:var(--cs-green);font-weight:800}
        .cs-user-info {flex:1;min-width:0}
        .cs-user-info strong,.cs-user-info span {display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .cs-user-info strong {font-size:11px}
        .cs-user-info span {margin-top:4px;color:var(--cs-muted);font-size:10px}
        .cs-secure-dot,.cs-online-dot {width:7px;height:7px;border-radius:50%;background:#29a565;flex-shrink:0}
        .cs-main {display:flex;flex:1;flex-direction:column;min-width:0;min-height:0}
        .cs-topbar {height:62px;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 22px;border-bottom:1px solid var(--cs-border);background:#fff}
        .cs-topbar-title {display:flex;align-items:center;gap:9px;font-size:12px;font-weight:750}
        .cs-beta {border-radius:5px;background:#edf5ef;color:var(--cs-green);padding:4px 6px;font-size:8px;letter-spacing:.5px}
        .cs-topbar-new {border:1px solid var(--cs-border);border-radius:8px;background:#fff;padding:8px 11px;color:#405449;font:inherit;font-size:11px;font-weight:650}
        .cs-menu-button {display:none}
        .cs-workspace {display:flex;flex:1;min-height:0}
        .cs-chat-column {display:flex;flex:1;flex-direction:column;min-width:0;min-height:0}
        .cs-chat-scroll {flex:1;overflow-y:auto;min-height:0;padding:30px clamp(18px,3vw,42px)}
        .cs-welcome {max-width:660px;margin:4vh auto 30px}
        .cs-welcome-icon {display:grid;place-items:center;width:54px;height:54px;margin-bottom:23px;border:1px solid #d6e9dc;border-radius:17px;background:#eaf5ed;color:var(--cs-green);font-size:29px}
        .cs-eyebrow {color:var(--cs-green);font-size:9px;letter-spacing:1.3px;font-weight:850}
        .cs-welcome h1 {margin:10px 0;font-size:clamp(24px,3vw,34px);letter-spacing:-1px;line-height:1.2}
        .cs-welcome-text {max-width:500px;color:var(--cs-muted);font-size:13px;line-height:1.8}
        .cs-suggestions {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:28px}
        .cs-suggestion {display:flex;align-items:center;gap:10px;min-height:70px;padding:13px;border:1px solid #e0e9e3;border-radius:11px;background:#fff;color:#405348;text-align:left;font:inherit;font-size:11px;line-height:1.5;cursor:pointer}
        .cs-suggestion:hover {border-color:#9fc9ac}
        .cs-suggestion-icon {display:grid;place-items:center;width:28px;height:28px;flex-shrink:0;border-radius:8px;background:#eef6f0;color:var(--cs-green);font-size:16px}
        .cs-suggestion-arrow {margin-left:auto;color:#93a298}
        .cs-messages {max-width:750px;margin:0 auto;display:flex;flex-direction:column;gap:23px}
        .cs-message {display:flex;align-items:flex-start;gap:11px}
        .cs-message-avatar {display:grid;place-items:center;flex-shrink:0;width:29px;height:29px;border-radius:9px;background:#e8f3eb;color:var(--cs-green);font-size:14px;font-weight:800}
        .cs-message-user .cs-message-avatar {background:#e8ece9;color:#46564c}
        .cs-message-body {min-width:0;flex:1}
        .cs-message-role {display:block;margin:3px 0 7px;color:#43564a;font-size:11px;font-weight:800}
        .cs-message-body p {margin:0;color:#435449;font-size:13px;line-height:1.8;overflow-wrap:anywhere;white-space:pre-wrap}
        .cs-thinking {color:var(--cs-muted)!important}
        .cs-error {max-width:750px;margin:18px auto 0;padding:13px;border:1px solid #f0d1cd;border-radius:10px;background:#fff3f1;color:#a52b21;font-size:12px;line-height:1.6}
        .cs-error p {margin:4px 0 0}
        .cs-result-panel {max-width:750px;margin:25px auto 10px;padding:17px;border:1px solid var(--cs-border);border-radius:13px;background:#fff}
        .cs-result-heading,.cs-side-card-heading {display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:15px}
        .cs-result-heading h3 {margin:5px 0 0;font-size:15px}
        .cs-result-badge {padding:5px 8px;border-radius:6px;background:#eef6f0;color:var(--cs-green);font-size:9px;font-weight:750}
        .cs-mini-stats {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:17px}
        .cs-mini-stats>div,.cs-overview-stat {display:flex;flex-direction:column;gap:8px;padding:11px;border:1px solid #e7ede8;border-radius:9px;background:#fbfcfb}
        .cs-mini-stats span,.cs-overview-stat span {color:var(--cs-muted);font-size:10px}
        .cs-mini-stats strong {font-size:21px}
        .cs-table-wrap {overflow-x:auto;width:100%}
        .cs-table {width:100%;border-collapse:collapse;text-align:left;font-size:11px}
        .cs-table th,.cs-table td {padding:10px 9px;border-bottom:1px solid #edf1ee;white-space:nowrap}
        .cs-table th {background:#f5f8f5;color:#627268;font-size:10px}
        .cs-stock {display:inline-block;padding:4px 7px;border-radius:5px;font-size:10px;font-weight:800}
        .cs-stock-normal {background:#e5f5e9;color:#176b45}
        .cs-stock-low {background:#fff2d9;color:#8a5900}
        .cs-stock-empty {background:#ffe7e5;color:#a52b21}
        .cs-data-note,.cs-no-results {color:var(--cs-muted);font-size:10px;line-height:1.6}
        .cs-composer-area {flex-shrink:0;padding:10px clamp(15px,3vw,36px) 15px;background:linear-gradient(to top,#f7f9f7 85%,rgba(247,249,247,0))}
        .cs-composer {max-width:750px;margin:0 auto;padding:12px 13px 10px;border:1px solid #dce6df;border-radius:13px;background:#fff;box-shadow:0 5px 20px #18412a0a}
        .cs-composer:focus-within {border-color:#9bc9aa;box-shadow:0 0 0 3px #176b450f}
        .cs-composer textarea {display:block;width:100%;resize:vertical;min-height:48px;max-height:150px;border:0;outline:none;background:transparent;color:var(--cs-text);font:inherit;font-size:12px;line-height:1.6}
        .cs-composer textarea::placeholder {color:#9aa69e}
        .cs-composer-bottom {display:flex;justify-content:space-between;align-items:center;gap:10px;padding-top:9px;border-top:1px solid #f0f3f0}
        .cs-composer-bottom>span {color:#8a978e;font-size:9px}
        .cs-send {display:flex;align-items:center;gap:8px;border:0;border-radius:8px;padding:9px 12px;background:var(--cs-green);color:#fff;font:inherit;font-size:10px;font-weight:750;cursor:pointer}
        .cs-send:hover {background:var(--cs-dark)}
        .cs-send:disabled,.cs-report-button:disabled,.cs-new-chat:disabled,.cs-topbar-new:disabled {opacity:.5;cursor:not-allowed}
        .cs-send span {font-size:15px}
        .cs-disclaimer {margin:9px 0 0;text-align:center;color:#99a49c;font-size:9px}
        .cs-insights-column {width:265px;flex:0 0 265px;display:flex;flex-direction:column;gap:13px;overflow-y:auto;padding:18px 13px;border-left:1px solid var(--cs-border);background:#f9fbf9}
        .cs-side-card {padding:15px;border:1px solid var(--cs-border);border-radius:12px;background:#fff}
        .cs-side-card-heading {justify-content:flex-start}
        .cs-side-icon {display:grid;place-items:center;width:34px;height:34px;flex-shrink:0;border-radius:10px;background:#e8f4eb;color:var(--cs-green);font-size:19px}
        .cs-side-icon-soft {background:#f1f5f2}
        .cs-side-card-heading h3 {margin:0 0 4px;font-size:12px}
        .cs-side-card-heading p {margin:0;color:var(--cs-muted);font-size:10px}
        .cs-overview-stats {display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .cs-overview-stat {gap:7px}
        .cs-overview-stat strong {font-size:22px}
        .cs-warning-stat {background:#fffaf0;border-color:#f1e5c8}
        .cs-warning-stat strong {color:#8a5900}
        .cs-danger-stat {background:#fff5f4;border-color:#f1d9d6}
        .cs-danger-stat strong {color:#a52b21}
        .cs-quick-list {display:flex;flex-direction:column;gap:4px}
        .cs-quick-list button {display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 0;border:0;border-bottom:1px solid #eff2ef;background:transparent;color:#506156;text-align:left;font:inherit;font-size:10px;line-height:1.5;cursor:pointer}
        .cs-quick-list button:last-child {border-bottom:0}
        .cs-quick-list button span:last-child {flex-shrink:0;color:var(--cs-green)}
        .cs-quick-list button:disabled {opacity:.5;cursor:not-allowed}
        .cs-report-button {width:100%;display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px;padding:11px;border:1px solid #e4ebe6;border-radius:8px;background:#fff;color:#405348;font:inherit;font-size:10px}
        .cs-report-button:hover {border-color:#a8cfb4;background:#f7fbf8}
        .cs-report-button span:last-child {color:var(--cs-green);font-size:15px;font-weight:800}
        .cs-report-note,.cs-report-success,.cs-report-error {font-size:10px;line-height:1.6;overflow-wrap:anywhere}
        .cs-report-note {color:var(--cs-muted)}
        .cs-report-success {color:var(--cs-green)}
        .cs-report-error {color:#a52b21}
        .cs-security-note {display:flex;align-items:flex-start;gap:9px;padding:12px 5px;color:#68796e}
        .cs-security-note>span {display:grid;place-items:center;width:22px;height:22px;flex-shrink:0;border-radius:50%;background:#e2f1e6;color:var(--cs-green);font-size:12px;font-weight:800}
        .cs-security-note p {margin:0;font-size:10px;line-height:1.8}
        .cs-security-note strong {color:#435449}
        .cs-sidebar-overlay {display:none}
        @media(max-width:1150px) {
          .cs-insights-column {width:225px;flex-basis:225px;padding:13px 10px}
          .cs-sidebar {width:220px;flex-basis:220px}
          .cs-mini-stats strong {font-size:18px}
        }
        @media(max-width:850px) {
          .cs-ai {height:auto;min-height:780px;max-height:none;overflow:visible}
          .cs-sidebar {position:absolute;z-index:20;top:0;bottom:0;left:0;width:275px;max-width:85vw;transform:translateX(-105%);transition:transform .2s ease;box-shadow:none}
          .cs-sidebar-open {transform:translateX(0);box-shadow:10px 0 40px #172c1b20}
          .cs-mobile-close {display:block;margin-left:auto;border:0;background:transparent;font-size:22px;color:var(--cs-muted);cursor:pointer}
          .cs-sidebar-overlay {display:block;position:fixed;z-index:19;inset:0;border:0;background:#14251a55}
          .cs-main {min-height:780px}
          .cs-menu-button {display:block;border:0;background:transparent;color:var(--cs-text);font-size:19px;cursor:pointer}
          .cs-insights-column {width:220px;flex-basis:220px}
          .cs-topbar {padding:0 13px}
          .cs-topbar-title {gap:6px}
        }
        @media(max-width:650px) {
          .cs-ai {display:block;min-height:0;border-radius:12px}
          .cs-main {min-height:850px}
          .cs-topbar {height:56px}
          .cs-topbar-title {font-size:11px}
          .cs-beta {display:none}
          .cs-topbar-new {font-size:10px;padding:8px}
          .cs-workspace {display:flex;flex-direction:column}
          .cs-chat-column {min-height:570px}
          .cs-chat-scroll {padding:24px 15px}
          .cs-welcome {margin-top:25px}
          .cs-welcome h1 {font-size:27px}
          .cs-suggestions {grid-template-columns:1fr;margin-top:20px}
          .cs-suggestion {min-height:57px}
          .cs-insights-column {width:100%;flex-basis:auto;overflow:visible;border-top:1px solid var(--cs-border);border-left:0;padding:14px}
          .cs-mini-stats {grid-template-columns:1fr 1fr}
          .cs-composer-area {padding:10px 12px 14px}
          .cs-composer-bottom>span {max-width:48%;line-height:1.5}
          .cs-result-panel {padding:12px}
        }

        /* Reference-inspired ClothStock AI redesign overrides */
        .cs-ai {
          width: 100%;
          height: auto;
          min-height: 0;
          max-height: none;
          overflow: visible;
          border: 0;
          border-radius: 0;
          background: #f4f8f7;
          color: #073d32;
          box-shadow: none;
        }
        /* The application already provides the main navigation and page header. */
        .cs-ai > .cs-sidebar,
        .cs-ai > .cs-sidebar-overlay,
        .cs-ai .cs-topbar {
          display: none !important;
        }
        .cs-ai .cs-main {
          display: block;
          min-width: 0;
          min-height: 0;
        }
        .cs-ai .cs-ai-toolbar {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 16px;
          margin: 0 0 16px;
        }
        .cs-ai .cs-ai-breadcrumb {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 9px;
          color: #71877c;
          font-size: 12px;
        }
        .cs-ai .cs-ai-breadcrumb strong { color: #124b38; font-weight: 800; }
        .cs-ai .cs-breadcrumb-slash { color: #a2b4a9; }
        .cs-ai .cs-left-new-chat {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          min-height: 42px;
          padding: 7px 17px 7px 8px;
          border: 1px solid #07835a;
          border-radius: 12px;
          background: linear-gradient(135deg, #078b60, #056344);
          color: #fff;
          font: inherit;
          font-size: 12px;
          font-weight: 800;
          box-shadow: 0 6px 15px rgba(5, 110, 72, .16);
          cursor: pointer;
          transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease;
        }
        .cs-ai .cs-left-new-chat:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 9px 19px rgba(5, 110, 72, .22);
        }
        .cs-ai .cs-left-new-chat:disabled { opacity: .55; cursor: not-allowed; }
        .cs-ai .cs-left-new-chat-icon {
          display: grid;
          place-items: center;
          width: 27px;
          height: 27px;
          border-radius: 8px;
          background: rgba(255,255,255,.18);
          font-size: 21px;
          line-height: 1;
        }
        .cs-ai .cs-hero-banner {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          min-height: 225px;
          margin: 0 0 16px;
          padding: 28px clamp(22px, 3vw, 38px);
          overflow: hidden;
          border-radius: 16px;
          color: #fff;
          background:
            radial-gradient(ellipse at 78% 20%, rgba(51, 167, 111, .42), transparent 36%),
            linear-gradient(115deg, #003b30 0%, #005943 56%, #08764e 100%);
          box-shadow: 0 8px 24px rgba(5, 70, 49, .12);
        }
        .cs-ai .cs-hero-banner::before,
        .cs-ai .cs-hero-banner::after {
          position: absolute;
          content: "";
          pointer-events: none;
          border-radius: 50%;
          border: 1px solid rgba(205, 255, 225, .13);
        }
        .cs-ai .cs-hero-banner::before {
          width: 310px; height: 310px; right: 80px; top: -175px;
        }
        .cs-ai .cs-hero-banner::after {
          width: 230px; height: 230px; right: 125px; bottom: -175px;
        }
        .cs-ai .cs-hero-copy { position: relative; z-index: 2; max-width: 690px; }
        .cs-ai .cs-hero-badge {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 7px 12px; border: 1px solid rgba(255,255,255,.16);
          border-radius: 999px; background: rgba(8, 151, 103, .55);
          color: #e8fff2; font-size: 10px; font-weight: 800; letter-spacing: .8px;
        }
        .cs-ai .cs-hero-copy h2 {
          margin: 14px 0 9px; color: #fff;
          font-size: clamp(25px, 3vw, 35px); line-height: 1.18; letter-spacing: -.8px;
        }
        .cs-ai .cs-hero-copy h2 span { color: #8ee8bf; }
        .cs-ai .cs-hero-copy p {
          max-width: 570px; margin: 0; color: #e0f4e9;
          font-size: 13px; line-height: 1.75;
        }
        .cs-ai .cs-hero-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 17px; }
        .cs-ai .cs-hero-tags span {
          padding: 8px 11px; border: 1px solid rgba(226,255,237,.15);
          border-radius: 999px; background: rgba(255,255,255,.09);
          color: #f2fff6; font-size: 10px; font-weight: 650;
        }
        .cs-ai .cs-hero-art {
          position: relative; z-index: 1; flex: 0 0 210px;
          height: 175px; display: grid; place-items: center;
        }
        .cs-ai .cs-hero-orbit {
          position: absolute; top: 0; left: 45%; display: grid; place-items: center;
          width: 34px; height: 34px; border-radius: 50%;
          background: #9df0c6; color: #08764e; font-size: 21px;
          box-shadow: 0 0 28px rgba(139,255,193,.3);
        }
        .cs-ai .cs-hero-robot { position: relative; width: 145px; height: 160px; margin-top: 25px; }
        .cs-ai .cs-robot-antenna {
          position: absolute; top: -17px; left: 70px; width: 4px; height: 24px;
          border-radius: 5px; background: #baf5d5;
        }
        .cs-ai .cs-robot-antenna::before {
          content: ""; position: absolute; top: -8px; left: -5px; width: 14px; height: 14px;
          border-radius: 50%; background: #baf5d5; box-shadow: 0 0 16px #a4ffd0;
        }
        .cs-ai .cs-robot-head {
          position: absolute; top: 6px; left: 12px; width: 120px; height: 91px;
          border: 5px solid #d5f5e5; border-radius: 34px;
          background: linear-gradient(145deg, #f8fffb, #a9d9c2);
          box-shadow: 0 12px 22px rgba(0,0,0,.2), inset 0 -4px 8px #7cb89b;
        }
        .cs-ai .cs-robot-head::before {
          content: ""; position: absolute; inset: 9px; border-radius: 25px;
          background: linear-gradient(145deg, #064a3c, #002e27);
        }
        .cs-ai .cs-robot-eye {
          position: absolute; z-index: 1; top: 35px; left: 29px;
          width: 10px; height: 13px; border-radius: 50%; background: #6bf0b1;
          box-shadow: 0 0 10px rgba(107,240,177,.5);
        }
        .cs-ai .cs-robot-eye:nth-child(2) { left: 72px; }
        .cs-ai .cs-robot-smile {
          position: absolute; z-index: 1; top: 42px; left: 47px;
          color: #6bf0b1; font-size: 26px; font-weight: 800; line-height: 1;
        }
        .cs-ai .cs-robot-body {
          position: absolute; left: 38px; bottom: 0; width: 70px; height: 57px;
          display: grid; place-items: center; border: 4px solid #d5f5e5;
          border-radius: 23px 23px 12px 12px; background: #f5fff9;
          box-shadow: 0 9px 18px rgba(0,0,0,.18);
        }
        .cs-ai .cs-robot-body span {
          display: grid; place-items: center; width: 31px; height: 31px;
          border-radius: 50%; background: #07845a; color: white; font-size: 21px; font-weight: 900;
        }
        .cs-ai .cs-hero-speech {
          position: absolute; right: -5px; top: 24px; padding: 11px 13px;
          border-radius: 16px 16px 4px 16px; background: #d9ffe9;
          color: #064a38; font-size: 10px; line-height: 1.55; font-weight: 750;
          box-shadow: 0 5px 18px rgba(0,0,0,.12);
        }
        .cs-ai .cs-workspace {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 280px;
          align-items: start;
          gap: 16px;
          min-height: 0;
          overflow: visible;
        }
        .cs-ai .cs-chat-column {
          min-width: 0; min-height: 610px; overflow: hidden;
          border: 1px solid #dfece6; border-radius: 16px;
          background: #fff; box-shadow: 0 5px 18px rgba(18,77,52,.05);
        }
        .cs-ai .cs-chat-scroll { padding: 22px; }
        .cs-ai .cs-welcome { max-width: none; margin: 0 auto 20px; }
        .cs-ai .cs-welcome-icon {
          float: left; width: 45px; height: 45px; margin: 0 12px 10px 0;
          border-radius: 50%; background: #e3f6ec; border: 0; color: #08764e;
        }
        .cs-ai .cs-welcome .cs-eyebrow { display: none; }
        .cs-ai .cs-welcome h1 { margin: 3px 0 5px; font-size: 20px; letter-spacing: -.3px; color: #064a3c; }
        .cs-ai .cs-welcome-text { margin: 0 0 20px; max-width: none; font-size: 12px; }
        .cs-ai .cs-suggestions { clear: both; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; margin-top: 18px; }
        .cs-ai .cs-suggestion {
          min-height: 78px; align-items: flex-start; padding: 12px;
          border-color: #dcefe5; border-radius: 12px; background: #f0faf5;
          color: #164b3b; font-size: 10px;
        }
        .cs-ai .cs-suggestion:hover { background: #e5f7ed; border-color: #9bd7b7; transform: translateY(-1px); }
        .cs-ai .cs-suggestion-icon { border-radius: 50%; background: #d9f2e5; }
        .cs-ai .cs-suggestion-arrow { display: none; }
        .cs-ai .cs-messages { max-width: none; }
        .cs-ai .cs-message-user { justify-content: flex-end; }
        .cs-ai .cs-message-user .cs-message-body {
          flex: 0 1 auto; max-width: 80%; padding: 12px 15px;
          border: 1px solid #d4f0e0; border-radius: 14px 14px 3px 14px; background: #e8f8ef;
        }
        .cs-ai .cs-message-user .cs-message-role { color: #08764e; }
        .cs-ai .cs-message-assistant .cs-message-body {
          padding: 13px 15px; border: 1px solid #e0eae4;
          border-radius: 4px 14px 14px 14px; background: #f8fbf9;
        }
        .cs-ai .cs-composer-area { padding: 12px 20px 16px; background: #fff; border-top: 1px solid #edf3ef; }
        .cs-ai .cs-composer { max-width: none; border-radius: 999px; padding: 11px 14px; }
        .cs-ai .cs-composer textarea { min-height: 32px; resize: vertical; }
        .cs-ai .cs-send { border-radius: 999px; padding: 10px 16px; }
        .cs-ai .cs-insights-column {
          width: auto; flex: initial; overflow: visible; padding: 0;
          border: 0; background: transparent; gap: 13px;
        }
        .cs-ai .cs-side-card {
          padding: 16px; border-color: #dcece4; border-radius: 14px;
          box-shadow: 0 5px 18px rgba(18,77,52,.045);
        }
        .cs-ai .cs-side-card-heading h3 { font-size: 13px; color: #064a3c; }
        .cs-ai .cs-overview-stats { grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; }
        .cs-ai .cs-overview-stat { min-width: 0; padding: 11px; background: #f9fcfa; }
        .cs-ai .cs-overview-stat strong { font-size: 22px; color: #064a3c; }
        .cs-ai .cs-overview-stat span { line-height: 1.4; }
        .cs-ai .cs-activity-item {
          width: 100%; display: flex; align-items: center; gap: 9px;
          padding: 10px 0; border: 0; border-bottom: 1px solid #edf2ee;
          background: transparent; text-align: left; cursor: pointer;
        }
        .cs-ai .cs-activity-item:last-child { border-bottom: 0; }
        .cs-ai .cs-activity-icon {
          display: grid; place-items: center; flex: 0 0 34px; height: 34px;
          border-radius: 50%; background: #dcf6e8; color: #08764e;
        }
        .cs-ai .cs-activity-1 { background: #e3f0ff; color: #2676d2; }
        .cs-ai .cs-activity-2 { background: #f0e5ff; color: #8151c7; }
        .cs-ai .cs-activity-3 { background: #ffe9e7; color: #d63d36; }
        .cs-ai .cs-activity-copy { min-width: 0; flex: 1; }
        .cs-ai .cs-activity-copy strong,.cs-ai .cs-activity-copy small { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .cs-ai .cs-activity-copy strong { color: #174b3a; font-size: 10px; }
        .cs-ai .cs-activity-copy small { margin-top: 4px; color: #71867a; font-size: 9px; }
        .cs-ai .cs-activity-arrow { color: #08764e; }
        .cs-ai .cs-report-card { background: linear-gradient(135deg, #064a3c, #00734f); color: #fff; }
        .cs-ai .cs-report-card .cs-side-card-heading h3,
        .cs-ai .cs-report-card .cs-side-card-heading p { color: #fff; }
        .cs-ai .cs-report-card .cs-side-icon { background: rgba(255,255,255,.15); color: #c7ffe0; }
        .cs-ai .cs-report-card .cs-report-button { background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.2); color: #fff; }
        .cs-ai .cs-report-card .cs-report-button span:last-child { color: #b8f7d2; }
        .cs-ai .cs-report-card .cs-report-note { color: #d5eee2; }
        .cs-ai .cs-report-card .cs-report-success { color: #b8f7d2; }
        .cs-ai .cs-report-card .cs-report-error { color: #ffd2cf; }
        .cs-ai .cs-security-note { padding: 8px 3px; }
        .cs-ai .cs-result-panel { max-width: none; }
        @media (max-width: 1050px) {
          .cs-ai .cs-workspace { grid-template-columns: minmax(0, 1fr) 245px; gap: 12px; }
          .cs-ai .cs-hero-art { flex-basis: 170px; transform: scale(.9); }
          .cs-ai .cs-suggestions { grid-template-columns: 1fr; }
        }
        @media (max-width: 760px) {
          .cs-ai .cs-hero-banner { min-height: 0; padding: 24px 20px; }
          .cs-ai .cs-hero-art { display: none; }
          .cs-ai .cs-workspace { grid-template-columns: minmax(0,1fr); }
          .cs-ai .cs-chat-column { min-height: 520px; }
          .cs-ai .cs-insights-column { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); }
          .cs-ai .cs-security-note { grid-column: 1 / -1; }
          .cs-ai .cs-chat-scroll { padding: 16px; }
          .cs-ai .cs-composer-area { padding: 10px; }
        }
        @media (max-width: 480px) {
          .cs-ai .cs-ai-toolbar { align-items: flex-start; }
          .cs-ai .cs-ai-breadcrumb { font-size: 10px; padding-top: 8px; }
          .cs-ai .cs-left-new-chat { min-height: 38px; padding-right: 10px; font-size: 10px; }
          .cs-ai .cs-left-new-chat-icon { width: 24px; height: 24px; }
          .cs-ai .cs-insights-column { grid-template-columns: 1fr; }
          .cs-ai .cs-hero-tags span { font-size: 9px; }
          .cs-ai .cs-hero-copy h2 { font-size: 24px; }
        }

        /* Organized three-panel ClothStock AI layout */
        .cs-ai {
          width: 100%;
          height: calc(100vh - 110px);
          min-height: 0;
          max-height: 1050px;
          overflow: hidden;
        }
        .cs-ai > .cs-sidebar {
          flex: 0 0 245px;
          width: 245px;
          min-width: 210px;
          min-height: 0;
          overflow-y: auto;
        }
        .cs-ai > .cs-main {
          flex: 1 1 auto;
          min-width: 0;
          min-height: 0;
          height: 100%;
          overflow: hidden;
        }
        .cs-ai .cs-workspace {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 255px;
          align-items: stretch;
          gap: 14px;
          flex: 1 1 auto;
          height: 0;
          min-height: 0;
          overflow: hidden;
          padding: 0 18px 18px;
        }
        .cs-ai .cs-chat-column {
          display: flex;
          flex-direction: column;
          flex: initial;
          width: 100%;
          height: 100%;
          min-width: 0;
          min-height: 0;
          overflow: hidden;
        }
        .cs-ai .cs-chat-scroll {
          flex: 1 1 auto;
          height: 0;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          overscroll-behavior: contain;
        }
        .cs-ai .cs-insights-column {
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 0;
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 0 2px 8px 0;
        }
        .cs-ai .cs-composer-area {
          flex: 0 0 auto;
          padding: 12px 18px 14px;
        }
        .cs-ai .cs-composer {
          width: 100%;
          max-width: 680px;
          margin: 0 auto;
          border-radius: 16px;
        }
        .cs-ai .cs-composer textarea {
          width: 100%;
          min-height: 38px;
          max-height: 100px;
          resize: vertical;
        }
        .cs-ai .cs-activity-card,
        .cs-ai .cs-report-card {
          flex-shrink: 0;
        }
        @media (max-width: 1100px) {
          .cs-ai .cs-workspace {
            grid-template-columns: minmax(0, 1fr) 225px;
            gap: 10px;
            padding: 0 12px 12px;
          }
          .cs-ai > .cs-sidebar {
            flex-basis: 215px;
            width: 215px;
          }
        }
        @media (max-width: 850px) {
          .cs-ai {
            height: calc(100dvh - 90px);
            max-height: none;
          }
          .cs-ai .cs-workspace {
            grid-template-columns: minmax(0, 1fr);
            overflow-y: auto;
            height: 0;
          }
          .cs-ai .cs-chat-column {
            height: 60vh;
            min-height: 400px;
          }
          .cs-ai .cs-insights-column {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            height: auto;
            overflow: visible;
          }
          .cs-ai .cs-report-card { grid-column: 1 / -1; }
        }
        @media (max-width: 600px) {
          .cs-ai > .cs-sidebar {
            position: absolute;
            z-index: 30;
            top: 0;
            bottom: 0;
            left: 0;
            width: 275px;
            max-width: 85vw;
          }
          .cs-ai .cs-insights-column { grid-template-columns: minmax(0, 1fr); }
          .cs-ai .cs-composer-area { padding: 10px; }
          .cs-ai .cs-composer { max-width: 100%; }
        }

        /* Tools burger menu: keep insights and reports out of the chat until requested */
        .cs-ai .cs-topbar-actions {display:flex;align-items:center;gap:8px;flex-shrink:0}
        .cs-ai .cs-tools-menu-button {display:inline-flex;align-items:center;gap:8px;border:1px solid #dce8df;border-radius:10px;background:#f5faf6;color:#176b45;padding:9px 12px;font:inherit;font-size:12px;font-weight:750;cursor:pointer}
        .cs-ai .cs-tools-menu-icon {font-size:17px;line-height:1}
        .cs-ai .cs-workspace {position:relative !important;grid-template-columns:minmax(0,1fr) !important}
        .cs-ai .cs-insights-column {display:none !important}
        .cs-ai .cs-insights-column.cs-tools-menu-open {display:flex !important;position:absolute !important;z-index:30 !important;top:8px !important;right:8px !important;bottom:8px !important;width:min(330px,calc(100% - 16px)) !important;max-width:calc(100% - 16px) !important;height:auto !important;max-height:none !important;overflow-y:auto !important;box-shadow:0 16px 45px rgba(14,45,29,.22) !important;border:1px solid #dce8df !important;border-radius:16px !important;background:#fff !important;padding:14px !important}
        .cs-ai .cs-tools-menu-header {display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 2px 12px;border-bottom:1px solid #e4ebe6;margin-bottom:4px}
        .cs-ai .cs-tools-menu-header strong,.cs-ai .cs-tools-menu-header span {display:block}
        .cs-ai .cs-tools-menu-header strong {font-size:14px;color:#174c33}
        .cs-ai .cs-tools-menu-header span {font-size:11px;color:#7a887f;margin-top:3px}
        .cs-ai .cs-tools-menu-header button {width:30px;height:30px;border:0;border-radius:8px;background:#f0f5f1;color:#315743;font-size:22px;cursor:pointer}
        @media (max-width:600px) {
          .cs-ai .cs-topbar {gap:8px;padding-left:10px;padding-right:10px}
          .cs-ai .cs-topbar-title {min-width:0;flex:1}
          .cs-ai .cs-beta {display:none}
          .cs-ai .cs-tools-menu-button {padding:8px 9px;font-size:11px}
          .cs-ai .cs-topbar-new {font-size:10px;padding:8px}
        }


        /* Visibility fix: keep the Tools burger visible in the top bar */
        .cs-ai .cs-topbar {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 10px !important;
          min-width: 0 !important;
          overflow: visible !important;
          position: relative !important;
          z-index: 20 !important;
        }
        .cs-ai .cs-topbar-title {
          flex: 1 1 auto !important;
          min-width: 0 !important;
        }
        .cs-ai .cs-topbar-actions {
          display: flex !important;
          align-items: center !important;
          justify-content: flex-end !important;
          gap: 8px !important;
          flex: 0 0 auto !important;
          min-width: max-content !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        .cs-ai button.cs-tools-menu-button {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 8px !important;
          flex: 0 0 auto !important;
          position: relative !important;
          z-index: 35 !important;
          visibility: visible !important;
          opacity: 1 !important;
          width: auto !important;
          min-width: 76px !important;
          height: 38px !important;
          padding: 8px 12px !important;
          color: #176b45 !important;
          background: #f5faf6 !important;
          border: 1px solid #dce8df !important;
          border-radius: 10px !important;
          cursor: pointer !important;
        }
        .cs-ai .cs-tools-menu-icon {
          display: inline-block !important;
          font-size: 19px !important;
          line-height: 1 !important;
        }
        .cs-ai .cs-workspace { overflow: visible !important; }
        .cs-ai .cs-chat-column { min-width: 0 !important; }
        .cs-ai .cs-insights-column.cs-tools-menu-open {
          position: fixed !important;
          z-index: 9999 !important;
          top: 105px !important;
          right: 22px !important;
          bottom: 22px !important;
          display: flex !important;
          flex-direction: column !important;
          width: min(350px, calc(100vw - 32px)) !important;
          height: auto !important;
          min-height: 420px !important;
          max-height: calc(100vh - 127px) !important;
          overflow-x: hidden !important;
          overflow-y: auto !important;
          box-sizing: border-box !important;
          background: #ffffff !important;
          box-shadow: 0 18px 55px rgba(14,45,29,.25) !important;
          border: 1px solid #dce8df !important;
          border-radius: 16px !important;
        }
        @media (max-height: 600px) {
          .cs-ai .cs-insights-column.cs-tools-menu-open {
            top: 70px !important;
            bottom: 10px !important;
            min-height: 0 !important;
            max-height: calc(100vh - 80px) !important;
          }
        }
        @media (max-width: 600px) {
          .cs-ai .cs-insights-column.cs-tools-menu-open {
            top: 112px !important;
            right: 10px !important;
            bottom: 10px !important;
            width: calc(100vw - 20px) !important;
            max-height: calc(100vh - 122px) !important;
          }
          .cs-ai .cs-topbar { flex-wrap: wrap !important; }
          .cs-ai .cs-topbar-title { order: 1 !important; }
          .cs-ai .cs-topbar-actions { order: 2 !important; width: 100% !important; }
          .cs-ai button.cs-tools-menu-button { min-width: 76px !important; }
        }


        /* Final layout fix: keep chat messages and composer visible below the hero */
        .cs-ai {
          display: flex !important;
          flex-direction: row !important;
          height: calc(100vh - 90px) !important;
          min-height: 620px !important;
          max-height: none !important;
        }
        .cs-ai > .cs-main {
          display: flex !important;
          flex-direction: column !important;
          flex: 1 1 0 !important;
          min-height: 0 !important;
          height: 100% !important;
          overflow: hidden !important;
        }
        .cs-ai .cs-hero-banner {
          flex: 0 0 auto !important;
        }
        .cs-ai .cs-workspace {
          display: flex !important;
          flex: 1 1 0 !important;
          height: auto !important;
          min-height: 0 !important;
          overflow: hidden !important;
          padding-bottom: 12px !important;
        }
        .cs-ai .cs-chat-column {
          display: flex !important;
          flex: 1 1 0 !important;
          flex-direction: column !important;
          height: 100% !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }
        .cs-ai .cs-chat-scroll {
          display: block !important;
          flex: 1 1 0 !important;
          height: auto !important;
          min-height: 0 !important;
          overflow-y: auto !important;
          visibility: visible !important;
        }
        .cs-ai .cs-composer-area {
          display: block !important;
          position: relative !important;
          flex: 0 0 auto !important;
          width: 100% !important;
          min-height: 105px !important;
          visibility: visible !important;
          opacity: 1 !important;
          z-index: 5 !important;
          background: #fff !important;
        }
        .cs-ai .cs-composer,
        .cs-ai .cs-composer textarea,
        .cs-ai .cs-composer-bottom,
        .cs-ai .cs-send {
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
        }
        .cs-ai .cs-composer textarea { min-height: 44px !important; }
        .cs-ai .cs-insights-column.cs-tools-menu-open {
          position: fixed !important;
          top: 100px !important;
          right: 20px !important;
          bottom: 20px !important;
          height: auto !important;
          max-height: calc(100vh - 120px) !important;
          overflow-y: auto !important;
          z-index: 9999 !important;
        }
        @media (max-width: 850px) {
          .cs-ai { height: calc(100dvh - 70px) !important; min-height: 620px !important; }
          .cs-ai .cs-hero-banner { min-height: 150px !important; }
          .cs-ai .cs-workspace { display: flex !important; flex: 1 1 0 !important; overflow: hidden !important; }
          .cs-ai .cs-chat-column { height: 100% !important; min-height: 0 !important; }
        }
        @media (max-width: 600px) {
          .cs-ai { min-height: 600px !important; }
          .cs-ai .cs-hero-banner { min-height: 130px !important; padding: 18px !important; }
          .cs-ai .cs-hero-art { display: none !important; }
          .cs-ai .cs-composer-area { min-height: 100px !important; padding: 10px !important; }
        }


        /* Compact hero and balanced chat layout */
        .cs-ai > .cs-main { min-width: 0 !important; width: 0 !important; }
        .cs-ai .cs-topbar { flex: 0 0 auto !important; }
        .cs-ai .cs-hero-banner {
          min-height: 0 !important;
          padding: 14px 24px !important;
          margin: 0 18px 10px !important;
          border-radius: 16px !important;
          gap: 12px !important;
        }
        .cs-ai .cs-hero-copy { max-width: 760px !important; }
        .cs-ai .cs-hero-badge { font-size: 10px !important; margin-bottom: 4px !important; }
        .cs-ai .cs-hero-copy h2 { font-size: clamp(20px, 2vw, 27px) !important; line-height: 1.2 !important; margin: 3px 0 6px !important; }
        .cs-ai .cs-hero-copy p { font-size: 12px !important; line-height: 1.45 !important; margin: 0 0 8px !important; max-width: 620px !important; }
        .cs-ai .cs-hero-tags { gap: 6px !important; flex-wrap: wrap !important; }
        .cs-ai .cs-hero-tags span { font-size: 10px !important; padding: 5px 8px !important; }
        .cs-ai .cs-hero-art { transform: scale(.72) !important; transform-origin: center right !important; margin: -20px 0 !important; }
        .cs-ai .cs-workspace {
          display: flex !important;
          flex: 1 1 0 !important;
          width: 100% !important;
          min-width: 0 !important;
          min-height: 0 !important;
          height: 0 !important;
          padding: 0 18px 12px !important;
          overflow: hidden !important;
          gap: 0 !important;
        }
        .cs-ai .cs-chat-column {
          flex: 1 1 0 !important;
          width: 100% !important;
          max-width: 1100px !important;
          min-width: 0 !important;
          margin: 0 auto !important;
          height: 100% !important;
          min-height: 0 !important;
          overflow: hidden !important;
          border-radius: 16px !important;
        }
        .cs-ai .cs-chat-scroll {
          flex: 1 1 0 !important;
          width: 100% !important;
          min-width: 0 !important;
          min-height: 0 !important;
          height: 0 !important;
          overflow-y: scroll !important;
          overflow-x: hidden !important;
          scrollbar-gutter: stable !important;
          overscroll-behavior: contain !important;
          padding: 14px 20px !important;
        }
        .cs-ai .cs-messages, .cs-ai .cs-welcome { width: 100% !important; max-width: 780px !important; margin-left: auto !important; margin-right: auto !important; }
        .cs-ai .cs-composer-area { flex: 0 0 auto !important; width: 100% !important; padding: 10px 16px 12px !important; }
        .cs-ai .cs-composer { width: 100% !important; max-width: 780px !important; margin: 0 auto !important; }
        .cs-ai .cs-composer textarea { max-height: 96px !important; }
        .cs-ai .cs-insights-column.cs-tools-menu-open { width: min(360px, calc(100vw - 32px)) !important; }
        @media (max-width: 850px) {
          .cs-ai .cs-hero-banner { margin: 0 10px 8px !important; padding: 12px 15px !important; }
          .cs-ai .cs-hero-copy h2 { font-size: 21px !important; }
          .cs-ai .cs-hero-art { display: none !important; }
          .cs-ai .cs-workspace { padding: 0 10px 10px !important; }
          .cs-ai .cs-chat-column { max-width: none !important; }
          .cs-ai .cs-chat-scroll { padding: 12px !important; }
        }

      `}</style>
    </div>
  );
}

function InsightStats({ insights }) {
  return (
    <div className="cs-overview-stats">
      <div className="cs-overview-stat">
        <span>Total products</span>
        <strong>{insights?.totalProducts ?? 0}</strong>
      </div>
      <div className="cs-overview-stat">
        <span>Total units</span>
        <strong>{Number(insights?.totalUnits || 0).toLocaleString("en-PH")}</strong>
      </div>
      <div className="cs-overview-stat cs-warning-stat">
        <span>Low stock (1–{insights?.lowStockLimit ?? LOW_STOCK_LIMIT})</span>
        <strong>{insights?.lowStockCount ?? 0}</strong>
      </div>
      <div className="cs-overview-stat cs-danger-stat">
        <span>Out of stock</span>
        <strong>{insights?.outOfStockCount ?? 0}</strong>
      </div>
    </div>
  );
}

function ProductTable({ products }) {
  return (
    <div className="cs-table-wrap">
      <table className="cs-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Code</th>
            <th>Category</th>
            <th>Size</th>
            <th>Color</th>
            <th>Stock</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => {
            const quantity = Number(product.quantity ?? 0);
            const stockClass =
              quantity <= 0
                ? "cs-stock-empty"
                : quantity <= LOW_STOCK_LIMIT
                  ? "cs-stock-low"
                  : "cs-stock-normal";

            return (
              <tr key={product._id || product.code || index}>
                <td>{product.name || "Unnamed product"}</td>
                <td>{product.code || "—"}</td>
                <td>{product.category || "—"}</td>
                <td>{product.size || "—"}</td>
                <td>{product.color || "—"}</td>
                <td>
                  <span className={`cs-stock ${stockClass}`}>{quantity}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default AI;
