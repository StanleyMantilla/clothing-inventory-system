
import { useCallback, useEffect, useRef, useState } from "react";
import Dashboard from "./Dashboard";
import Sales from "./Sales";
import Products from "./Products";
import Users from "./Users";
import Login from "./Login";
import { useAuth } from "./AuthContext";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import "./App.css";

const API_URL = "http://localhost:5000";
const REFRESH_EVENT = "clothstock:refresh-dashboard";

const AI_API_URL = "http://localhost:5000";
const LOW_STOCK_LIMIT = 5;

const QUICK_QUESTIONS = [
  "Which products have 5 or fewer items in stock?",
  "Which products are out of stock?",
  "Show my inventory insights.",
  "What are our top-selling products?",
  "How many products do we have?",
  "How much is our inventory worth?",
];

function ClothStockAIAvatar() {
  return (
    <span className="cs-ai-profile-picture" role="img" aria-label="ClothStock AI futuristic robot avatar">
      <svg viewBox="0 0 96 96" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="clothbot-shell" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#eafff5" />
            <stop offset="48%" stopColor="#a9f5d1" />
            <stop offset="100%" stopColor="#4bc58b" />
          </linearGradient>
          <linearGradient id="clothbot-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#123f35" />
            <stop offset="100%" stopColor="#061e22" />
          </linearGradient>
          <linearGradient id="clothbot-glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#183e4a" />
            <stop offset="100%" stopColor="#071c28" />
          </linearGradient>
          <linearGradient id="clothbot-eye" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d9fff4" />
            <stop offset="100%" stopColor="#3cf6b0" />
          </linearGradient>
          <filter id="clothbot-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.3" result="blur" />
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <circle cx="48" cy="48" r="47" fill="#052f26" />
        <circle cx="48" cy="48" r="43.5" fill="url(#clothbot-bg)" stroke="#31df98" strokeWidth="1.5" />
        <circle cx="48" cy="48" r="38" fill="none" stroke="#53efb0" strokeWidth=".8" strokeDasharray="3 5" opacity=".5" />
        {/* antenna */}
        <path d="M48 17v9" stroke="#c6ffe5" strokeWidth="4" strokeLinecap="round" />
        <circle cx="48" cy="14" r="5.5" fill="#54ffba" stroke="#e5fff4" strokeWidth="1.8" filter="url(#clothbot-glow)" />
        {/* side audio/utility modules */}
        <rect x="12" y="39" width="12" height="24" rx="5" fill="#54c990" stroke="#d9ffec" strokeWidth="1.5" />
        <rect x="72" y="39" width="12" height="24" rx="5" fill="#54c990" stroke="#d9ffec" strokeWidth="1.5" />
        <path d="M15 45h6M15 50h6M75 45h6M75 50h6" stroke="#07533e" strokeWidth="1.8" strokeLinecap="round" />
        {/* robot head */}
        <path d="M27 28Q27 24 33 24h30q6 0 6 6v35q0 8-9 8H36q-9 0-9-8z" fill="url(#clothbot-shell)" stroke="#e5fff4" strokeWidth="1.5" />
        <path d="M33 24h30q6 0 6 6v5H27v-5q0-6 6-6" fill="#f3fff9" opacity=".55" />
        {/* glossy face display */}
        <rect x="30" y="36" width="36" height="25" rx="9" fill="url(#clothbot-glass)" stroke="#1c7557" strokeWidth="1.2" />
        <g filter="url(#clothbot-glow)">
          <rect x="36" y="43" width="7" height="9" rx="3.5" fill="url(#clothbot-eye)" />
          <rect x="53" y="43" width="7" height="9" rx="3.5" fill="url(#clothbot-eye)" />
        </g>
        <path d="M41 56q7 5 14 0" fill="none" stroke="#80ffd0" strokeWidth="2" strokeLinecap="round" />
        {/* chest badge */}
        <path d="M40 68h16l-2 7H42z" fill="#08764e" />
        <path d="M45 69h6v3h-6z" fill="#9dffda" />
        {/* tiny sparkles */}
        <path d="M77 20l1.8 4.2L83 26l-4.2 1.8L77 32l-1.8-4.2L71 26l4.2-1.8z" fill="#c5ffe6" />
        <circle cx="19" cy="24" r="1.8" fill="#7bffc8" />
        <circle cx="78" cy="70" r="1.5" fill="#7bffc8" />
      </svg>
    </span>
  );
}
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
  const [chatExpanded, setChatExpanded] = useState(false);
  const [aiHintVisible, setAiHintVisible] = useState(true);

  // Rotate the launcher hint: show for 5 seconds, hide for 5 seconds.
  useEffect(() => {
    let visible = true;
    setAiHintVisible(true);
    const timer = window.setInterval(() => {
      visible = !visible;
      setAiHintVisible(visible);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  // Release keyboard focus before hiding the chat panel. This prevents the
  // closed panel's textarea from retaining focus and blocking page controls.
  const closeChat = useCallback(() => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && activeElement.closest(".cs-ai-float-panel")) {
      activeElement.blur();
    }
    setChatExpanded(false);
  }, []);

  // Let the sidebar open this floating assistant without mounting a second copy.
  useEffect(() => {
    const openAssistant = () => setChatExpanded((open) => !open);
    window.addEventListener("clothstock:open-ai", openAssistant);
    return () => window.removeEventListener("clothstock:open-ai", openAssistant);
  }, []);

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
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== "undefined" && window.innerWidth > 650);
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
      const data = await requestJson(`${AI_API_URL}/api/ai/conversations`);
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
      const data = await requestJson(`${AI_API_URL}/api/ai/insights`);

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
        `${AI_API_URL}/api/ai/conversations/${id}`
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
      await requestJson(`${AI_API_URL}/api/ai/conversations/${id}`, {
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
  const typingStartedAt = Date.now();
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
      const data = await requestJson(`${AI_API_URL}/api/ai/chat`, {
        method: "POST",
        body: JSON.stringify({
          question: cleanQuestion,
          conversationId: activeConversationId,
        }),
      });

      // Keep the typing indicator visible for about 2.5 seconds minimum,
      // so quick API responses still feel natural.
      const typingElapsed = Date.now() - typingStartedAt;
      const typingRemaining = Math.max(0, 2500 - typingElapsed);
      if (typingRemaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, typingRemaining));
      }

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
      const data = await requestJson(`${AI_API_URL}/api/ai/report`, {
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
    <div className="cs-ai-float-shell">
      
        <button type="button" className="cs-ai-float-launcher" aria-label="Chat with ClothStock AI" onClick={() => (chatExpanded ? closeChat() : setChatExpanded(true))}>
          <span className={`cs-ai-launcher-label ${aiHintVisible && !chatExpanded ? "is-hint-visible" : "is-hint-hidden"}`} aria-hidden="true">Chat with <strong>ClothStock AI</strong><i>Ask about your inventory</i></span>
          <span className="cs-ai-launcher-orbit" aria-hidden="true" />
          <ClothStockAIAvatar />
          <span className="cs-ai-float-online" aria-hidden="true" />
        </button>
      
      <section
        className={`cs-ai-float-panel ${chatExpanded ? "is-expanded" : "is-collapsed"}`}
        aria-hidden={!chatExpanded}
        inert={!chatExpanded}
        aria-modal={chatExpanded ? "true" : undefined}
        role={chatExpanded ? "dialog" : undefined}
        aria-label={chatExpanded ? "ClothStock AI assistant" : undefined}
      >
        <header className="cs-ai-float-windowbar">
          <div className="cs-ai-float-windowbrand"><ClothStockAIAvatar /><span><strong>ClothStock AI</strong><small>Inventory Assistant</small></span></div>
          <div className="cs-ai-float-windowcontrols">
            <button type="button" aria-label="Minimize chat" title="Minimize" onClick={closeChat}>−</button>
            <button type="button" aria-label="Close chat" title="Close" onClick={closeChat}>×</button>
          </div>
        </header>
        <div className="cs-ai-float-content">
    <style>{`
      /* Desktop: keep conversation history visible beside the chat. */
      .cs-ai-float-panel .cs-float-history {
        position: relative !important;
        inset: auto !important;
        flex: 0 0 235px !important;
        width: 235px !important;
        max-width: 235px !important;
        min-width: 0 !important;
        z-index: 2 !important;
        display: flex !important;
        visibility: visible !important;
        pointer-events: auto !important;
        transform: none !important;
        box-shadow: inset -1px 0 #e1e9e3 !important;
        overflow: hidden !important;
      }
      .cs-ai-float-panel .cs-sidebar-overlay { display: none !important; }
      .cs-ai-float-panel .cs-main { min-width: 0 !important; }
      .cs-ai-float-panel .cs-menu-button { display: none !important; }
      .cs-ai-float-panel .cs-sidebar .cs-mobile-close { display: none !important; }
      @media (max-width: 650px) {
        .cs-ai-float-panel .cs-float-history {
          position: absolute !important;
          top: 0 !important; bottom: 0 !important; left: 0 !important;
          width: 275px !important; max-width: 85vw !important;
          flex: none !important; z-index: 10020 !important;
          transform: ${sidebarOpen ? "translateX(0)" : "translateX(-110%)"} !important;
          visibility: ${sidebarOpen ? "visible" : "hidden"} !important;
          pointer-events: ${sidebarOpen ? "auto" : "none"} !important;
          transition: transform .25s ease, visibility .25s ease !important;
          box-shadow: ${sidebarOpen ? "10px 0 40px rgba(23,55,35,.18)" : "none"} !important;
        }
        .cs-ai-float-panel .cs-sidebar-overlay { display: ${sidebarOpen ? "block" : "none"} !important; }
        .cs-ai-float-panel .cs-menu-button { display: grid !important; }
        .cs-ai-float-panel .cs-sidebar .cs-mobile-close { display: block !important; }
      }
    `}</style>
    <div className={`cs-ai ${sidebarOpen ? "cs-history-visible" : "cs-history-hidden"}`} style={{ position: "relative", isolation: "isolate" }}>
      <aside
        id="clothstock-chat-history"
        className={`cs-sidebar cs-float-history ${sidebarOpen ? "cs-sidebar-open" : ""}`}
      >
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
          aria-label="Close chat history"
          onClick={() => setSidebarOpen(false)}
          style={{
            display: "block",
            position: "fixed",
            inset: 0,
            zIndex: 10010,
            width: "100vw",
            height: "100vh",
            border: 0,
            background: "rgba(20, 37, 26, .38)",
            cursor: "pointer",
          }}
        />
      )}

      <main className="cs-main">
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
        <header className="cs-topbar">
          <button
            type="button"
            className="cs-menu-button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setSidebarOpen((open) => !open);
            }}
            aria-expanded={sidebarOpen}
            aria-controls="clothstock-chat-history"
            aria-label={sidebarOpen ? "Close conversations" : "Open conversations"}
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
                      <div className={`cs-message-avatar ${message.role === "user" ? "cs-user-avatar" : "cs-assistant-avatar"}`}>
                        {message.role === "user" ? "U" : <ClothStockAIAvatar />}
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
                      <div className="cs-message-avatar cs-assistant-avatar"><ClothStockAIAvatar /></div>
                      <div className="cs-message-body">
                        <span className="cs-message-role">ClothStock AI</span>
                        <div className="cs-typing-indicator" role="status" aria-label="ClothStock AI is typing">
                          <span className="cs-thinking-label">ClothStock AI is typing</span>
                          <span className="cs-typing-dots" aria-hidden="true">
                            <i />
                            <i />
                            <i />
                          </span>
                        </div>
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
                    {loading ? "Checking..." : "Send"} <span>↑</span>
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
          display:flex; min-height:760px; height:calc(100vh + 10px);
          max-height:1050px; overflow:hidden; border:1px solid var(--cs-border);
          border-radius:18px; background:#f7f9f7; color:var(--cs-text);
          font-family:Inter,system-ui,-apple-system,sans-serif;
          margin-top:-120px;
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
        .cs-welcome{animation:cs-chat-content-in .42s cubic-bezier(.2,.8,.2,1) both}
        .cs-message{animation:cs-chat-content-in .32s cubic-bezier(.2,.8,.2,1) both}
        .cs-message:nth-child(2){animation-delay:.035s}.cs-message:nth-child(3){animation-delay:.07s}.cs-message:nth-child(4){animation-delay:.105s}
        @keyframes cs-chat-content-in{from{opacity:0;transform:translate3d(0,10px,0)}to{opacity:1;transform:translate3d(0,0,0)}}
        @media(prefers-reduced-motion:reduce){.cs-ai-float-panel,.cs-welcome,.cs-message{animation:none!important;transition:none!important;transform:none!important}}
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
        /* Keep the AI chat history and its own topbar available. */
        .cs-ai > .cs-sidebar { display: flex !important; }
        .cs-ai > .cs-sidebar-overlay { display: block !important; }
        .cs-ai .cs-topbar { display: flex !important; }
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
          min-height: 118px !important;
          margin: 8px 18px 10px 82px !important;
          padding: 12px 22px !important;
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


        /* Final layout tuning: banner directly under the top header; roomy, readable chat */
        .cs-ai > .cs-main { display: flex !important; flex-direction: column !important; min-height: 0 !important; }
        .cs-ai .cs-hero-banner { order: 1 !important; flex: 0 0 auto !important; margin: 8px 18px 10px !important; padding: 12px 22px !important; min-height: 0 !important; }
        .cs-ai .cs-ai-toolbar { order: 2 !important; flex: 0 0 auto !important; }
        .cs-ai .cs-workspace { order: 3 !important; flex: 1 1 0 !important; min-height: 0 !important; height: 0 !important; }
        .cs-ai .cs-hero-copy h2 { font-size: clamp(21px, 2vw, 28px) !important; margin: 2px 0 5px !important; }
        .cs-ai .cs-hero-copy p { font-size: 13px !important; line-height: 1.5 !important; }
        .cs-ai .cs-hero-tags span { font-size: 11px !important; }
        .cs-ai .cs-chat-scroll { overflow-y: auto !important; min-height: 0 !important; height: 0 !important; padding: 18px 24px !important; }
        .cs-ai .cs-messages, .cs-ai .cs-welcome { max-width: 900px !important; }
        .cs-ai .cs-message { font-size: 15px !important; line-height: 1.75 !important; }
        .cs-ai .cs-message p, .cs-ai .cs-message-content { line-height: 1.75 !important; overflow-wrap: anywhere !important; }
        .cs-ai .cs-composer { max-width: 900px !important; }
        .cs-ai .cs-composer textarea { font-size: 15px !important; line-height: 1.55 !important; }
        @media (max-width: 850px) {
          .cs-ai .cs-hero-banner { margin: 6px 10px 8px !important; padding: 11px 14px !important; }
          .cs-ai .cs-chat-scroll { padding: 12px !important; }
          .cs-ai .cs-message { font-size: 14px !important; }
        }

      

        /* FINAL OVERRIDE: compact top welcome banner + usable chat viewport */
        .cs-ai {
          display: flex !important;
          flex-direction: row !important;
          width: 100% !important;
          height: calc(100dvh - 110px) !important;
          min-height: 620px !important;
          max-height: none !important;
          overflow: hidden !important;
        }
        .cs-ai > .cs-main {
          display: flex !important;
          flex: 1 1 0 !important;
          flex-direction: column !important;
          width: auto !important;
          min-width: 0 !important;
          height: 100% !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }
        .cs-ai .cs-ai-toolbar {
          flex: 0 0 auto !important;
          margin: 8px 18px 10px !important;
        }
        .cs-ai .cs-hero-banner {
          flex: 0 0 auto !important;
          min-height: 0 !important;
          margin: 0 18px 12px !important;
          padding: 13px 22px !important;
          gap: 12px !important;
        }
        .cs-ai .cs-hero-copy h2 {
          margin: 4px 0 5px !important;
          font-size: clamp(20px, 2vw, 27px) !important;
          line-height: 1.2 !important;
        }
        .cs-ai .cs-hero-copy p {
          margin: 0 0 7px !important;
          font-size: 12px !important;
          line-height: 1.45 !important;
        }
        .cs-ai .cs-hero-tags { margin-top: 8px !important; gap: 6px !important; }
        .cs-ai .cs-hero-tags span { padding: 5px 8px !important; font-size: 9px !important; }
        .cs-ai .cs-hero-art { transform: scale(.68) !important; transform-origin: center right !important; }
        .cs-ai .cs-workspace {
          display: flex !important;
          flex: 1 1 0 !important;
          width: auto !important;
          height: auto !important;
          min-width: 0 !important;
          min-height: 0 !important;
          padding: 0 18px 14px !important;
          overflow: hidden !important;
        }
        .cs-ai .cs-chat-column {
          display: flex !important;
          flex: 1 1 0 !important;
          flex-direction: column !important;
          width: 100% !important;
          max-width: none !important;
          height: 100% !important;
          min-width: 0 !important;
          min-height: 0 !important;
          margin: 0 !important;
          overflow: hidden !important;
        }
        .cs-ai .cs-chat-scroll {
          display: block !important;
          flex: 1 1 0 !important;
          height: auto !important;
          min-height: 0 !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          overscroll-behavior: contain !important;
          scrollbar-gutter: stable !important;
          padding: 20px clamp(18px, 3vw, 34px) !important;
        }
        .cs-ai .cs-messages,
        .cs-ai .cs-error,
        .cs-ai .cs-result-panel {
          width: 100% !important;
          max-width: 980px !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
        .cs-ai .cs-message-body p { font-size: 14px !important; line-height: 1.85 !important; }
        .cs-ai .cs-message-role { font-size: 12px !important; }
        .cs-ai .cs-composer-area {
          display: block !important;
          flex: 0 0 auto !important;
          width: 100% !important;
          min-height: 0 !important;
          padding: 10px 18px 12px !important;
          border-top: 1px solid #edf3ef !important;
          background: #fff !important;
        }
        .cs-ai .cs-composer { width: 100% !important; max-width: 980px !important; margin: 0 auto !important; }
        .cs-ai .cs-composer textarea { min-height: 44px !important; max-height: 100px !important; }
        .cs-ai .cs-insights-column.cs-tools-menu-open { z-index: 9999 !important; }
        @media (max-width: 850px) {
          .cs-ai { height: calc(100dvh - 80px) !important; min-height: 600px !important; }
          .cs-ai .cs-ai-toolbar { margin: 8px 10px !important; }
          .cs-ai .cs-hero-banner { margin: 0 10px 9px !important; padding: 12px 15px !important; }
          .cs-ai .cs-hero-art { display: none !important; }
          .cs-ai .cs-workspace { padding: 0 10px 10px !important; }
          .cs-ai .cs-chat-scroll { padding: 14px !important; }
        }
        @media (max-width: 600px) {
          .cs-ai { min-height: 580px !important; }
          .cs-ai .cs-hero-copy h2 { font-size: 21px !important; }
          .cs-ai .cs-hero-copy p { font-size: 11px !important; }
          .cs-ai .cs-hero-tags span { font-size: 8px !important; }
          .cs-ai .cs-composer-area { padding: 9px !important; }
        }



        /* FINAL FIX: compact top welcome banner + full-height readable chat */
        .cs-ai {
          display: flex !important;
          flex-direction: row !important;
          width: 100% !important;
          height: calc(100dvh - 100px) !important;
          min-height: 620px !important;
          max-height: none !important;
          overflow: hidden !important;
        }
        .cs-ai > .cs-main {
          display: flex !important;
          flex: 1 1 0 !important;
          flex-direction: column !important;
          width: 0 !important;
          min-width: 0 !important;
          height: 100% !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }
        .cs-ai .cs-ai-toolbar {
          flex: 0 0 auto !important;
          min-height: 44px !important;
          margin: 0 18px 8px !important;
        }
        .cs-ai .cs-hero-banner {
          order: 1 !important;
          flex: 0 0 auto !important;
          min-height: 0 !important;
          margin: 0 18px 10px !important;
          padding: 12px 22px !important;
          gap: 12px !important;
        }
        .cs-ai .cs-hero-copy h2 {
          margin: 3px 0 5px !important;
          font-size: clamp(20px, 2vw, 26px) !important;
          line-height: 1.18 !important;
        }
        .cs-ai .cs-hero-copy p {
          margin: 0 0 6px !important;
          font-size: 12px !important;
          line-height: 1.45 !important;
        }
        .cs-ai .cs-hero-tags { margin-top: 8px !important; gap: 6px !important; }
        .cs-ai .cs-hero-tags span { padding: 4px 8px !important; font-size: 9px !important; }
        .cs-ai .cs-hero-art {
          flex-basis: 145px !important;
          height: 120px !important;
          transform: scale(.68) !important;
          transform-origin: center right !important;
          margin: -12px 0 !important;
        }
        .cs-ai .cs-workspace {
          display: flex !important;
          flex: 1 1 0 !important;
          width: 100% !important;
          height: 0 !important;
          min-height: 0 !important;
          padding: 0 18px 14px !important;
          overflow: hidden !important;
          gap: 0 !important;
        }
        .cs-ai .cs-chat-column {
          display: flex !important;
          flex: 1 1 0 !important;
          flex-direction: column !important;
          width: 100% !important;
          height: 100% !important;
          min-width: 0 !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }
        .cs-ai .cs-chat-scroll {
          display: block !important;
          flex: 1 1 0 !important;
          height: 0 !important;
          min-height: 0 !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          scrollbar-gutter: stable !important;
          padding: 22px clamp(20px, 4vw, 48px) !important;
        }
        .cs-ai .cs-messages,
        .cs-ai .cs-error,
        .cs-ai .cs-result-panel {
          width: 100% !important;
          max-width: 1000px !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
        .cs-ai .cs-message { gap: 13px !important; }
        .cs-ai .cs-message-body p {
          font-size: 15px !important;
          line-height: 1.85 !important;
          overflow-wrap: anywhere !important;
        }
        .cs-ai .cs-message-role { font-size: 12px !important; }
        .cs-ai .cs-message-assistant .cs-message-body,
        .cs-ai .cs-message-user .cs-message-body { padding: 15px 18px !important; }
        .cs-ai .cs-composer-area {
          display: block !important;
          position: relative !important;
          flex: 0 0 auto !important;
          width: 100% !important;
          min-height: 0 !important;
          padding: 10px clamp(18px, 3vw, 34px) 12px !important;
          border-top: 1px solid #edf3ef !important;
          background: #fff !important;
          z-index: 5 !important;
        }
        .cs-ai .cs-composer { width: 100% !important; max-width: 1000px !important; }
        .cs-ai .cs-composer textarea { min-height: 44px !important; max-height: 110px !important; }
        .cs-ai .cs-insights-column.cs-tools-menu-open {
          position: fixed !important;
          top: 100px !important;
          right: 18px !important;
          bottom: 18px !important;
          width: min(360px, calc(100vw - 36px)) !important;
          max-height: calc(100dvh - 118px) !important;
          z-index: 9999 !important;
        }
        @media (max-width: 850px) {
          .cs-ai { height: calc(100dvh - 80px) !important; min-height: 600px !important; }
          .cs-ai .cs-ai-toolbar { margin: 0 10px 7px !important; }
          .cs-ai .cs-hero-banner { margin: 0 10px 8px !important; padding: 11px 14px !important; }
          .cs-ai .cs-hero-art { display: none !important; }
          .cs-ai .cs-workspace { padding: 0 10px 10px !important; }
          .cs-ai .cs-chat-scroll { padding: 16px !important; }
          .cs-ai .cs-message-body p { font-size: 14px !important; }
        }
        @media (max-width: 600px) {
          .cs-ai { height: calc(100dvh - 65px) !important; min-height: 560px !important; }
          .cs-ai .cs-hero-copy h2 { font-size: 20px !important; }
          .cs-ai .cs-hero-copy p { font-size: 11px !important; }
          .cs-ai .cs-hero-tags span { font-size: 8px !important; padding: 4px 6px !important; }
          .cs-ai .cs-chat-scroll { padding: 12px !important; }
          .cs-ai .cs-message-body p { font-size: 14px !important; line-height: 1.75 !important; }
          .cs-ai .cs-composer-area { padding: 9px !important; }
        }


        /* Smooth tools hamburger menu entrance and exit */
        .cs-ai .cs-insights-column {
          display: flex !important;
          position: fixed !important;
          top: 100px !important;
          right: 18px !important;
          bottom: 18px !important;
          width: min(360px, calc(100vw - 36px)) !important;
          max-height: calc(100dvh - 118px) !important;
          z-index: 9999 !important;
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
          transform: translate3d(18px, 0, 0) scale(.985) !important;
          transform-origin: top right !important;
          transition: opacity 240ms ease, transform 280ms cubic-bezier(.2,.75,.25,1), visibility 280ms ease !important;
          will-change: opacity, transform;
        }
        .cs-ai .cs-insights-column.cs-tools-menu-open {
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
          transform: translate3d(0, 0, 0) scale(1) !important;
        }
        .cs-ai .cs-tools-menu-button {
          transition: background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease !important;
        }
        .cs-ai .cs-tools-menu-button:hover { transform: translateY(-1px); }
        .cs-ai .cs-tools-menu-button:active { transform: translateY(0) scale(.98); }
        .cs-ai .cs-insights-column .cs-tools-menu-header button {
          transition: background-color 180ms ease, transform 180ms ease !important;
        }
        .cs-ai .cs-insights-column .cs-tools-menu-header button:hover { transform: rotate(90deg); }
        @media (max-width: 600px) {
          .cs-ai .cs-insights-column {
            top: 76px !important;
            right: 10px !important;
            bottom: 10px !important;
            width: calc(100vw - 20px) !important;
            max-height: calc(100dvh - 86px) !important;
            transform: translate3d(0, 12px, 0) scale(.99) !important;
          }
          .cs-ai .cs-insights-column.cs-tools-menu-open { transform: translate3d(0, 0, 0) scale(1) !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cs-ai .cs-insights-column,
          .cs-ai .cs-tools-menu-button,
          .cs-ai .cs-insights-column .cs-tools-menu-header button {
            transition: none !important;
            transform: none !important;
          }
        }



        /* ClothStock AI typing indicator */
        .cs-ai .cs-typing-indicator {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          width: fit-content;
          max-width: 100%;
          margin-top: 7px;
          padding: 11px 14px;
          border: 1px solid var(--cs-border, #dfe8e1);
          border-radius: 14px;
          background: var(--cs-card, #fff);
          color: var(--cs-muted, #68766d);
          box-shadow: 0 3px 12px rgba(20, 70, 42, 0.05);
        }
        .cs-ai .cs-thinking-label {
          font-size: 13px;
          line-height: 1.4;
        }
        .cs-ai .cs-typing-dots {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          min-width: 27px;
        }
        .cs-ai .cs-typing-dots i {
          display: block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--cs-primary, #176b45);
          opacity: .45;
          animation: cs-typing-bounce 1s ease-in-out infinite;
        }
        .cs-ai .cs-typing-dots i:nth-child(2) { animation-delay: .15s; }
        .cs-ai .cs-typing-dots i:nth-child(3) { animation-delay: .3s; }
        @keyframes cs-typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: .4; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cs-ai .cs-typing-dots i { animation: none; opacity: .8; }
        }

        /* ClothStock AI profile picture */
        .cs-ai .cs-message-avatar.cs-assistant-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          overflow: hidden;
          padding: 0;
          background: #168451;
          box-shadow: 0 2px 7px rgba(22, 132, 81, .18);
        }
        .cs-ai .cs-ai-profile-picture,
        .cs-ai .cs-ai-profile-picture svg {
          display: block;
          width: 100%;
          height: 100%;
        }
        .cs-ai .cs-message-avatar.cs-user-avatar {
          border-radius: 50%;
        }

        /* Animated main application navigation drawer */
        .cs-ai .cs-app-nav-trigger {
          position: fixed; z-index: 61; top: 18px; left: 18px;
          width: 48px; height: 48px; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 5px;
          border: 1px solid rgba(22,132,81,.16); border-radius: 15px;
          background: rgba(255,255,255,.94); box-shadow: 0 8px 24px rgba(13,74,48,.13);
          cursor: pointer; transition: transform .28s cubic-bezier(.2,.8,.2,1), background .25s, box-shadow .25s;
          backdrop-filter: blur(12px);
        }
        .cs-ai .cs-app-nav-trigger:hover { transform: translateY(-2px) scale(1.04); background:#eaf8f0; box-shadow:0 12px 28px rgba(13,74,48,.2); }
        .cs-ai .cs-app-nav-trigger span { display:block; width:20px; height:2.5px; border-radius:9px; background:#08764e; transition:transform .32s cubic-bezier(.2,.8,.2,1), opacity .2s, width .25s; }
        .cs-ai .cs-app-nav-trigger span:nth-child(2) { width:15px; margin-left:5px; }
        .cs-ai .cs-app-nav-trigger.is-open span:first-child { transform:translateY(7.5px) rotate(45deg); }
        .cs-ai .cs-app-nav-trigger.is-open span:nth-child(2) { opacity:0; transform:translateX(-8px); }
        .cs-ai .cs-app-nav-trigger.is-open span:last-child { transform:translateY(-7.5px) rotate(-45deg); }
        .cs-ai .cs-app-nav-backdrop { position:fixed; z-index:58; inset:0; border:0; padding:0; background:rgba(4,28,19,0); opacity:0; visibility:hidden; pointer-events:none; transition:opacity .32s ease, background .32s ease, visibility .32s; }
        .cs-ai .cs-app-nav-backdrop.is-visible { opacity:1; visibility:visible; pointer-events:auto; background:rgba(4,28,19,.38); backdrop-filter:blur(3px); }
        .cs-ai .cs-app-nav-drawer { position:fixed; z-index:60; top:0; bottom:0; left:0; width:min(330px, calc(100vw - 44px)); padding:24px 17px 18px; display:flex; flex-direction:column; gap:7px; overflow-y:auto; background:linear-gradient(165deg,#ffffff 0%,#f5fbf7 72%,#e9f8ef 100%); border-right:1px solid #dceee3; box-shadow:18px 0 55px rgba(7,52,33,0); transform:translateX(-105%); opacity:.8; visibility:hidden; transition:transform .42s cubic-bezier(.2,.85,.25,1), opacity .3s ease, box-shadow .4s ease, visibility .42s; }
        .cs-ai .cs-app-nav-drawer.is-open { transform:translateX(0); opacity:1; visibility:visible; box-shadow:18px 0 55px rgba(7,52,33,.22); }
        .cs-ai .cs-app-nav-brand { display:flex; align-items:center; gap:11px; padding:7px 4px 23px; border-bottom:1px solid #e1eee6; margin-bottom:13px; }
        .cs-ai .cs-app-nav-logo { width:43px; height:43px; display:grid; place-items:center; border-radius:14px; color:#fff; font-size:21px; font-weight:900; background:linear-gradient(145deg,#1caa70,#075d3d); box-shadow:0 7px 16px #0b75472e; }
        .cs-ai .cs-app-nav-brand strong { display:block; color:#104b35; font-size:16px; letter-spacing:-.3px; }
        .cs-ai .cs-app-nav-brand span { display:block; margin-top:3px; color:#7b9587; font-size:9px; font-weight:800; letter-spacing:1.3px; }
        .cs-ai .cs-app-nav-close { margin-left:auto; width:34px; height:34px; border:0; border-radius:10px; color:#426454; background:#eaf5ee; font-size:25px; cursor:pointer; transition:transform .25s, background .25s; }
        .cs-ai .cs-app-nav-close:hover { transform:rotate(90deg); background:#d9f0e2; }
        .cs-ai .cs-app-nav-label { margin:0 10px 7px; color:#91a79a; font-size:10px; font-weight:850; letter-spacing:1.5px; }
        .cs-ai .cs-app-nav-item { position:relative; display:flex; align-items:center; gap:13px; width:100%; min-height:49px; padding:10px 13px; border:1px solid transparent; border-radius:13px; color:#496456; background:transparent; text-align:left; font:inherit; font-size:13px; font-weight:700; cursor:pointer; opacity:0; transform:translateX(-12px); transition:opacity .28s ease, transform .35s cubic-bezier(.2,.8,.2,1), color .2s, background .2s, border-color .2s; }
        .cs-ai .cs-app-nav-drawer.is-open .cs-app-nav-item { opacity:1; transform:translateX(0); }
        .cs-ai .cs-app-nav-drawer.is-open .cs-app-nav-item:nth-of-type(1) { transition-delay:.04s; }
        .cs-ai .cs-app-nav-drawer.is-open .cs-app-nav-item:nth-of-type(2) { transition-delay:.08s; }
        .cs-ai .cs-app-nav-drawer.is-open .cs-app-nav-item:nth-of-type(3) { transition-delay:.12s; }
        .cs-ai .cs-app-nav-drawer.is-open .cs-app-nav-item:nth-of-type(4) { transition-delay:.16s; }
        .cs-ai .cs-app-nav-drawer.is-open .cs-app-nav-item:nth-of-type(5) { transition-delay:.2s; }
        .cs-ai .cs-app-nav-drawer.is-open .cs-app-nav-item:nth-of-type(6) { transition-delay:.24s; }
        .cs-ai .cs-app-nav-item:hover { color:#086744; background:#e9f7ef; border-color:#d4eddf; transform:translateX(4px); }
        .cs-ai .cs-app-nav-item.is-current { color:#08764e; background:linear-gradient(100deg,#dff5e8,#effaf3); border-color:#c8ead6; box-shadow:inset 3px 0 #168451; }
        .cs-ai .cs-app-nav-item-icon { display:grid; place-items:center; flex:0 0 30px; width:30px; height:30px; border-radius:10px; background:#edf5ef; color:#168451; font-size:18px; }
        .cs-ai .cs-app-nav-item.is-current .cs-app-nav-item-icon { color:#fff; background:linear-gradient(145deg,#1eaa70,#08704a); }
        .cs-ai .cs-app-nav-current-dot { width:6px; height:6px; margin-left:auto; border-radius:50%; background:#18a66a; box-shadow:0 0 0 4px #c9f0d9; }
        .cs-ai .cs-app-nav-footer { display:flex; align-items:center; gap:10px; margin-top:auto; padding:16px 8px 4px; border-top:1px solid #e1eee6; }
        .cs-ai .cs-app-nav-user-avatar { display:grid; place-items:center; width:37px; height:37px; border-radius:50%; background:#d8f1e2; color:#08764e; font-weight:850; }
        .cs-ai .cs-app-nav-footer strong { display:block; max-width:190px; overflow:hidden; color:#254e3b; font-size:12px; text-overflow:ellipsis; white-space:nowrap; }
        .cs-ai .cs-app-nav-footer div span { display:block; margin-top:3px; color:#81988b; font-size:10px; }
        @media (max-width:600px) { .cs-ai .cs-app-nav-trigger { top:12px; left:12px; width:43px; height:43px; border-radius:13px; } .cs-ai .cs-app-nav-drawer { padding:18px 13px 14px; } }
        @media (prefers-reduced-motion: reduce) { .cs-ai .cs-app-nav-trigger, .cs-ai .cs-app-nav-trigger span, .cs-ai .cs-app-nav-backdrop, .cs-ai .cs-app-nav-drawer, .cs-ai .cs-app-nav-item, .cs-ai .cs-app-nav-close { transition:none !important; } }


        /* Compact the welcome banner so the conversation area gets priority */
        .cs-ai .cs-hero-banner {
          min-height: 142px;
          height: 142px;
          flex: 0 0 142px;
          padding: 16px clamp(20px, 2.4vw, 32px);
          margin: 0 18px 10px;
          border-radius: 14px;
        }
        .cs-ai .cs-hero-copy { max-width: 760px; }
        .cs-ai .cs-hero-badge { padding: 5px 9px; font-size: 9px; }
        .cs-ai .cs-hero-copy h2 { margin: 7px 0 5px; font-size: clamp(21px, 2vw, 28px); }
        .cs-ai .cs-hero-copy p { max-width: 620px; font-size: 11px; line-height: 1.45; }
        .cs-ai .cs-hero-tags { gap: 6px; margin-top: 9px; }
        .cs-ai .cs-hero-tags span { padding: 5px 8px; font-size: 9px; }
        .cs-ai .cs-hero-art { flex-basis: 155px; height: 128px; transform: scale(.82); transform-origin: center; }
        .cs-ai .cs-hero-robot { animation: clothstockRobotFloat 3.2s ease-in-out infinite; }
        .cs-ai .cs-hero-orbit { animation: clothstockOrbit 7s linear infinite; }
        .cs-ai .cs-robot-antenna::before { animation: clothstockAntennaGlow 1.8s ease-in-out infinite; }
        .cs-ai .cs-robot-eye { animation: clothstockRobotBlink 4.8s infinite; transform-origin: center; }
        .cs-ai .cs-robot-eye:nth-child(2) { animation-delay: .08s; }
        .cs-ai .cs-hero-speech { animation: clothstockSpeechFloat 3.2s ease-in-out infinite; }
        @keyframes clothstockRobotFloat {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-7px) rotate(1deg); }
        }
        @keyframes clothstockOrbit {
          from { transform: rotate(0deg) translateX(9px) rotate(0deg); }
          to { transform: rotate(360deg) translateX(9px) rotate(-360deg); }
        }
        @keyframes clothstockAntennaGlow {
          0%, 100% { box-shadow: 0 0 8px #a4ffd0; }
          50% { box-shadow: 0 0 21px #a4ffd0, 0 0 30px rgba(164,255,208,.55); }
        }
        @keyframes clothstockRobotBlink {
          0%, 43%, 47%, 100% { transform: scaleY(1); }
          45% { transform: scaleY(.12); }
        }
        @keyframes clothstockSpeechFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        /* Keep the chat and composer inside the available viewport height */
        .cs-ai .cs-ai-toolbar { flex: 0 0 auto; margin: 0 18px 8px; }
        .cs-ai .cs-workspace { min-height: 0; }
        .cs-ai .cs-chat-column { min-height: 0; }
        .cs-ai .cs-chat-scroll { padding: 14px 20px; }
        .cs-ai .cs-welcome { margin-bottom: 12px; }
        .cs-ai .cs-welcome-icon { width: 38px; height: 38px; margin-right: 10px; margin-bottom: 6px; font-size: 23px; }
        .cs-ai .cs-welcome h1 { font-size: 18px; }
        .cs-ai .cs-welcome-text { margin-bottom: 10px; font-size: 11px; line-height: 1.5; }
        .cs-ai .cs-suggestions { margin-top: 10px; }
        .cs-ai .cs-suggestion { min-height: 58px; padding: 9px; }
        .cs-ai .cs-composer-area { padding: 9px 14px 11px; }
        .cs-ai .cs-composer textarea { min-height: 30px; max-height: 78px; }
        @media (max-height: 800px) and (min-width: 851px) {
          .cs-ai { height: calc(100vh - 82px); }
          .cs-ai .cs-hero-banner { height: 126px; min-height: 126px; flex-basis: 126px; }
          .cs-ai .cs-hero-art { transform: scale(.7); }
          .cs-ai .cs-chat-scroll { padding-top: 10px; padding-bottom: 10px; }
          .cs-ai .cs-suggestion { min-height: 50px; }
        }
        @media (max-width: 850px) {
          .cs-ai .cs-hero-banner { height: auto; min-height: 0; flex-basis: auto; margin: 0 10px 8px; padding: 16px; }
          .cs-ai .cs-hero-art { display: none; }
          .cs-ai .cs-ai-toolbar { margin: 0 10px 8px; }
          .cs-ai .cs-workspace { padding: 0 10px 10px; }
          .cs-ai .cs-chat-column { height: 58vh; min-height: 360px; }
          .cs-ai .cs-suggestions { grid-template-columns: 1fr; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cs-ai .cs-hero-robot, .cs-ai .cs-hero-orbit,
          .cs-ai .cs-robot-antenna::before, .cs-ai .cs-robot-eye,
          .cs-ai .cs-hero-speech { animation: none !important; }
        }

        /* FINAL LAYOUT: place the welcome banner first and reclaim the top gap */
        .cs-ai {
          display: flex !important;
          flex-direction: row !important;
          align-items: stretch;
        }
        .cs-ai > .cs-main {
          display: flex !important;
          flex-direction: column !important;
          align-items: stretch;
          justify-content: flex-start;
          min-height: 0 !important;
          height: 100% !important;
          gap: 0;
        }
        .cs-ai .cs-hero-banner {
          order: 0 !important;
          flex: 0 0 auto;
          min-height: 175px;
          margin: 0 18px 12px !important;
          padding: 22px clamp(20px, 2.5vw, 32px) !important;
        }
        .cs-ai .cs-topbar {
          order: 1 !important;
          flex: 0 0 56px;
        }
        .cs-ai .cs-ai-toolbar {
          order: 2 !important;
          flex: 0 0 auto;
          margin: 0 18px 10px !important;
        }
        .cs-ai .cs-workspace {
          order: 3 !important;
          flex: 1 1 0;
          min-height: 0;
          height: 0;
        }
        @media (max-width: 850px) {
          .cs-ai .cs-hero-banner {
            min-height: 150px;
            margin: 0 12px 10px !important;
            padding: 18px 16px !important;
          }
          .cs-ai .cs-ai-toolbar { margin: 0 12px 8px !important; }
          .cs-ai .cs-workspace { flex: 1 1 0; min-height: 0; }
        }
        @media (max-width: 600px) {
          .cs-ai .cs-hero-banner { min-height: 130px; padding: 15px !important; }
          .cs-ai .cs-hero-art { display: flex !important; flex-basis: 90px; transform: scale(.72); transform-origin: center right; }
          .cs-ai .cs-hero-copy p { max-width: 90%; }
          .cs-ai .cs-hero-tags { gap: 5px; margin-top: 9px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cs-ai .cs-hero-robot,
          .cs-ai .cs-robot-eye,
          .cs-ai .cs-robot-antenna,
          .cs-ai .cs-hero-orbit,
          .cs-ai .cs-hero-speech { animation: none !important; }
        }

        @media (max-width: 760px) {
          .cs-ai { margin-top: -92px !important; height: calc(100vh + 8px) !important; }
          .cs-ai .cs-hero-banner { margin: 8px 10px 10px 70px !important; padding: 12px 14px !important; min-height: 112px !important; }
          .cs-ai .cs-hero-art { display: none !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cs-ai .cs-hero-robot, .cs-ai .cs-robot-eye, .cs-ai .cs-robot-antenna, .cs-ai .cs-hero-orbit, .cs-ai .cs-hero-speech { animation: none !important; }
        }

        /* FINAL FIX: stretch the conversation to the bottom and dock the message input */
        .cs-ai {
          height: calc(100dvh - 94px) !important;
          min-height: 680px !important;
          max-height: none !important;
          overflow: hidden !important;
          align-items: stretch !important;
        }
        .cs-ai > .cs-main {
          flex: 1 1 auto !important;
          height: 100% !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }
        .cs-ai .cs-workspace {
          flex: 1 1 0 !important;
          height: 0 !important;
          min-height: 0 !important;
          overflow: hidden !important;
          padding-bottom: 12px !important;
        }
        .cs-ai .cs-chat-column {
          display: flex !important;
          flex: 1 1 auto !important;
          flex-direction: column !important;
          height: 100% !important;
          min-height: 0 !important;
          overflow: hidden !important;
        }
        .cs-ai .cs-chat-scroll {
          flex: 1 1 auto !important;
          height: 0 !important;
          min-height: 0 !important;
          overflow-y: auto !important;
          overscroll-behavior: contain !important;
        }
        .cs-ai .cs-composer-area {
          position: relative !important;
          flex: 0 0 auto !important;
          margin-top: auto !important;
          width: 100% !important;
          background: #fff !important;
          z-index: 2 !important;
        }
        @media (max-width: 760px) {
          .cs-ai {
            height: calc(100dvh - 78px) !important;
            min-height: 600px !important;
          }
          .cs-ai .cs-workspace { padding: 0 10px 10px !important; }
          .cs-ai .cs-composer-area { padding: 9px 10px 12px !important; }
        }
        /* Final layout refinements: taller, wider conversation and unobstructed hero robot */
        .cs-ai .cs-main {
          display: flex !important;
          flex-direction: column !important;
          height: calc(100vh - 110px);
          min-height: 620px !important;
          min-width: 0;
        }
        .cs-ai .cs-hero-banner {
          flex: 0 0 auto;
          margin-bottom: 12px;
        }
        .cs-ai .cs-hero-speech {
          right: calc(100% + 12px) !important;
          top: 30px !important;
          z-index: 2;
          white-space: nowrap;
        }
        .cs-ai .cs-topbar {
          flex: 0 0 auto;
        }
        .cs-ai .cs-ai-toolbar {
          flex: 0 0 auto;
        }
        .cs-ai .cs-workspace {
          display: grid !important;
          grid-template-columns: minmax(0, 1fr) !important;
          flex: 1 1 auto;
          min-height: 0 !important;
          overflow: hidden;
        }
        .cs-ai .cs-chat-column {
          display: flex !important;
          flex-direction: column !important;
          width: 100%;
          height: 100%;
          min-height: 0 !important;
          max-width: none;
          overflow: hidden;
        }
        .cs-ai .cs-chat-scroll {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto !important;
          padding: 22px 28px;
        }
        .cs-ai .cs-messages {
          width: 100%;
          max-width: none !important;
        }
        .cs-ai .cs-message-assistant {
          width: 100%;
          justify-content: flex-start;
        }
        .cs-ai .cs-message-assistant .cs-message-body {
          flex: 1 1 auto;
          min-width: 0;
          max-width: none;
        }
        .cs-ai .cs-composer-area {
          flex: 0 0 auto;
          width: 100%;
          padding: 16px 24px 12px !important;
        }
        .cs-ai .cs-composer {
          width: 100%;
          max-width: none !important;
          margin: 0 auto;
        }
        .cs-ai .cs-insights-column {
          display: none;
        }
        .cs-ai .cs-insights-column.cs-tools-menu-open {
          display: flex;
          position: fixed;
          z-index: 10020;
          top: 100px;
          right: 20px;
          bottom: 20px;
          width: min(340px, calc(100vw - 40px));
          overflow-y: auto;
          padding: 16px;
          border: 1px solid #dcece4;
          border-radius: 16px;
          background: #f8fbf9;
          box-shadow: 0 16px 48px rgba(0,0,0,.18);
        }
        @media (max-width: 850px) {
          .cs-ai .cs-main {
            height: auto;
            min-height: calc(100vh - 100px) !important;
          }
          .cs-ai .cs-workspace {
            min-height: 65vh !important;
            overflow: visible;
          }
          .cs-ai .cs-chat-column {
            min-height: 65vh !important;
          }
          .cs-ai .cs-hero-speech {
            right: calc(100% + 8px) !important;
            top: 22px !important;
            font-size: 9px;
          }
        }
        @media (max-width: 560px) {
          .cs-ai .cs-main {
            min-height: 0 !important;
          }
          .cs-ai .cs-hero-speech {
            right: calc(100% + 5px) !important;
            top: 12px !important;
            padding: 7px 8px;
            font-size: 8px;
          }
          .cs-ai .cs-chat-scroll {
            padding: 16px 12px;
          }
          .cs-ai .cs-composer-area {
            padding: 12px !important;
          }
        }

        /* Final requested adjustments: narrower centered chat and composer at the bottom */
        .cs-ai .cs-workspace {
          width: calc(100% - 36px) !important;
          max-width: 1320px !important;
          margin: 0 auto 24px !important;
          min-height: 0 !important;
          flex: 1 1 auto !important;
          align-self: center !important;
        }
        .cs-ai .cs-chat-column {
          min-height: 0 !important;
          height: 100% !important;
          flex: 1 1 auto !important;
        }
        .cs-ai .cs-chat-scroll {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          padding: 20px 24px !important;
        }
        .cs-ai .cs-welcome {
          width: 100% !important;
          max-width: 820px !important;
          margin: 0 auto 18px !important;
        }
        .cs-ai .cs-messages {
          width: 100% !important;
          max-width: 900px !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
        .cs-ai .cs-composer-area {
          width: 100% !important;
          flex: 0 0 auto !important;
          margin-top: auto !important;
          padding: 16px 20px 18px !important;
        }
        .cs-ai .cs-composer {
          width: 100% !important;
          max-width: 900px !important;
          margin: 0 auto !important;
        }
        @media (min-width: 761px) {
          .cs-ai .cs-main {
            min-height: calc(100vh - 280px) !important;
          }
          .cs-ai .cs-workspace {
            min-height: 430px !important;
          }
        }
        @media (max-width: 760px) {
          .cs-ai .cs-workspace {
            width: calc(100% - 16px) !important;
            margin-bottom: 12px !important;
          }
          .cs-ai .cs-chat-scroll {
            padding: 14px 12px !important;
          }
          .cs-ai .cs-welcome,
          .cs-ai .cs-messages,
          .cs-ai .cs-composer {
            max-width: 100% !important;
          }
          .cs-ai .cs-composer-area {
            padding: 12px !important;
          }
        }
        /* Final layout refinements from the user's marked screenshot */
        .cs-ai .cs-hero-banner {
          flex: 0 0 auto !important;
          min-height: 150px !important;
          height: auto !important;
          padding: 18px 24px !important;
          overflow: hidden !important;
        }
        .cs-ai .cs-hero-copy {
          min-width: 0 !important;
          max-width: calc(100% - 190px) !important;
        }
        .cs-ai .cs-hero-tags {
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 6px !important;
          max-width: 100% !important;
          overflow: visible !important;
        }
        .cs-ai .cs-hero-tags span {
          display: inline-flex !important;
          align-items: center !important;
          max-width: 100% !important;
          white-space: normal !important;
          overflow-wrap: anywhere !important;
          font-size: 10px !important;
          line-height: 1.25 !important;
          padding: 5px 8px !important;
        }
        .cs-ai .cs-workspace {
          flex: 1 1 auto !important;
          height: auto !important;
          min-height: 0 !important;
          grid-template-columns: minmax(0, 1fr) !important;
          padding: 0 20px 20px !important;
          gap: 0 !important;
        }
        .cs-ai .cs-chat-column {
          min-height: 0 !important;
          height: 100% !important;
        }
        .cs-ai .cs-chat-scroll {
          flex: 1 1 auto !important;
          min-height: 0 !important;
          padding: 22px clamp(22px, 6vw, 76px) !important;
        }
        .cs-ai .cs-welcome,
        .cs-ai .cs-messages,
        .cs-ai .cs-error,
        .cs-ai .cs-result-panel {
          width: 100% !important;
          max-width: 820px !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
        .cs-ai .cs-composer-area {
          flex: 0 0 auto !important;
          margin-top: auto !important;
          padding: 14px 24px 20px !important;
        }
        .cs-ai .cs-composer {
          width: 100% !important;
          max-width: 760px !important;
          margin: 0 auto !important;
        }
        .cs-ai .cs-disclaimer {
          margin-top: 10px !important;
        }
        @media (max-width: 760px) {
          .cs-ai .cs-hero-banner { padding: 15px !important; min-height: 0 !important; }
          .cs-ai .cs-hero-copy { max-width: calc(100% - 95px) !important; }
          .cs-ai .cs-hero-tags span { font-size: 9px !important; padding: 4px 6px !important; }
          .cs-ai .cs-workspace { padding: 0 10px 10px !important; }
          .cs-ai .cs-chat-scroll { padding: 16px 12px !important; }
          .cs-ai .cs-composer-area { padding: 10px 12px 14px !important; }
          .cs-ai .cs-composer { max-width: 100% !important; }
        }
        /* Latest request: extend the conversation panel down into the empty space */
        @media (min-width: 761px) {
          .cs-ai {
            min-height: 100vh !important;
          }
          .cs-ai .cs-main {
            display: flex !important;
            flex-direction: column !important;
            min-height: calc(100dvh - 94px) !important;
            height: auto !important;
          }
          .cs-ai .cs-workspace {
            flex: 1 1 auto !important;
            min-height: max(500px, calc(100dvh - 420px)) !important;
            height: auto !important;
            margin-bottom: 0 !important;
          }
          .cs-ai .cs-chat-column {
            display: flex !important;
            flex-direction: column !important;
            min-height: 0 !important;
            height: 100% !important;
          }
          .cs-ai .cs-chat-scroll {
            flex: 1 1 auto !important;
            min-height: 0 !important;
          }
          .cs-ai .cs-composer-area {
            margin-top: auto !important;
          }
        }
        @media (max-width: 760px) {
          .cs-ai .cs-workspace { min-height: 65vh !important; }
        }

        /* Mobile-safe refinements: responsive hero banner and always-visible Send button */
        .cs-ai .cs-hero-banner { position:relative !important; display:flex !important; align-items:center !important; gap:12px !important; min-width:0 !important; }
        .cs-ai .cs-hero-copy { flex:1 1 auto !important; min-width:0 !important; }
        .cs-ai .cs-hero-art { flex:0 0 150px !important; min-width:0 !important; }
        .cs-ai .cs-composer, .cs-ai .cs-composer-bottom, .cs-ai .cs-send { min-width:0 !important; }
        .cs-ai .cs-composer-bottom { display:flex !important; flex-wrap:wrap !important; justify-content:space-between !important; align-items:center !important; gap:10px !important; }
        .cs-ai .cs-composer-bottom > span { flex:1 1 120px !important; max-width:100% !important; overflow-wrap:anywhere !important; }
        .cs-ai .cs-send { flex:0 0 auto !important; display:inline-flex !important; align-items:center !important; justify-content:center !important; min-height:42px !important; white-space:nowrap !important; visibility:visible !important; }
        @media (max-width:760px) {
          .cs-ai { width:100% !important; max-width:100vw !important; min-width:0 !important; height:auto !important; min-height:100dvh !important; overflow:visible !important; margin-top:0 !important; border-radius:0 !important; }
          .cs-ai > .cs-main { width:100% !important; min-width:0 !important; height:auto !important; min-height:100dvh !important; overflow:visible !important; }
          .cs-ai .cs-hero-banner { width:auto !important; min-height:0 !important; height:auto !important; margin:8px 10px 10px !important; padding:15px 14px !important; gap:5px !important; overflow:hidden !important; border-radius:18px !important; }
          .cs-ai .cs-hero-copy { flex:1 1 auto !important; width:auto !important; max-width:none !important; min-width:0 !important; }
          .cs-ai .cs-hero-copy h2 { font-size:clamp(18px,5vw,25px) !important; line-height:1.2 !important; overflow-wrap:anywhere !important; }
          .cs-ai .cs-hero-copy p { max-width:none !important; font-size:12px !important; line-height:1.45 !important; }
          .cs-ai .cs-hero-tags { display:flex !important; flex-wrap:wrap !important; gap:5px !important; margin-top:9px !important; }
          .cs-ai .cs-hero-tags span { max-width:100% !important; white-space:normal !important; overflow-wrap:anywhere !important; font-size:9px !important; line-height:1.25 !important; padding:5px 7px !important; }
          .cs-ai .cs-hero-art { display:flex !important; position:relative !important; flex:0 0 76px !important; width:76px !important; height:92px !important; align-self:center !important; transform:scale(.58) !important; transform-origin:center right !important; margin-left:-7px !important; }
          .cs-ai .cs-hero-speech { display:none !important; }
          .cs-ai .cs-topbar, .cs-ai .cs-ai-toolbar { min-width:0 !important; margin-left:10px !important; margin-right:10px !important; }
          .cs-ai .cs-topbar { gap:8px !important; flex-wrap:wrap !important; height:auto !important; min-height:54px !important; }
          .cs-ai .cs-topbar-title { min-width:0 !important; flex:1 1 100px !important; overflow-wrap:anywhere !important; }
          .cs-ai .cs-topbar-actions { min-width:0 !important; gap:6px !important; }
          .cs-ai .cs-tools-menu-button, .cs-ai .cs-topbar-new { padding:8px 9px !important; white-space:nowrap !important; }
          .cs-ai .cs-workspace { width:auto !important; max-width:none !important; min-height:58vh !important; height:auto !important; margin:0 10px 12px !important; padding:0 !important; overflow:visible !important; }
          .cs-ai .cs-chat-column { width:100% !important; min-width:0 !important; min-height:58vh !important; height:auto !important; overflow:hidden !important; }
          .cs-ai .cs-chat-scroll { min-width:0 !important; min-height:300px !important; height:auto !important; padding:16px 12px !important; }
          .cs-ai .cs-welcome, .cs-ai .cs-messages, .cs-ai .cs-error, .cs-ai .cs-result-panel { width:100% !important; max-width:100% !important; }
          .cs-ai .cs-composer-area { position:relative !important; flex:0 0 auto !important; width:100% !important; min-width:0 !important; padding:10px !important; margin-top:0 !important; }
          .cs-ai .cs-composer { display:block !important; width:100% !important; max-width:100% !important; min-width:0 !important; padding:12px !important; }
          .cs-ai .cs-composer textarea { display:block !important; width:100% !important; min-width:0 !important; min-height:48px !important; max-height:110px !important; font-size:14px !important; }
          .cs-ai .cs-composer-bottom { width:100% !important; padding-top:10px !important; }
          .cs-ai .cs-send { min-width:82px !important; min-height:42px !important; padding:10px 13px !important; }
          .cs-ai .cs-disclaimer { margin:8px 0 0 !important; text-align:center !important; line-height:1.4 !important; }
        }
        @media (max-width:390px) {
          .cs-ai .cs-hero-banner { padding:13px 11px !important; }
          .cs-ai .cs-hero-art { flex-basis:58px !important; width:58px !important; transform:scale(.48) !important; }
          .cs-ai .cs-hero-copy h2 { font-size:18px !important; }
          .cs-ai .cs-topbar-title { font-size:11px !important; }
          .cs-ai .cs-tools-menu-button { font-size:11px !important; }
          .cs-ai .cs-topbar-new { font-size:10px !important; }
          .cs-ai .cs-composer-bottom > span { flex-basis:100px !important; font-size:9px !important; }
        }
      `}</style>
    </div>
        </div>
      </section>
      <style>{`
        .cs-ai-float-shell{position:fixed;right:22px;bottom:94px;z-index:9990;font-family:Inter,system-ui,sans-serif;pointer-events:none}
        .cs-ai-float-shell>.cs-ai-float-launcher{pointer-events:auto}
        .cs-ai-float-shell>.cs-ai-float-panel{pointer-events:auto}
        .cs-ai-float-launcher{position:relative;display:grid;place-items:center;width:62px;height:62px;padding:0;border:3px solid white;border-radius:50%;background:#176b45;box-shadow:0 7px 26px #102c1c40;cursor:pointer;animation:cs-float-bob 3s ease-in-out infinite}
        .cs-ai-float-launcher .cs-ai-profile-picture,.cs-ai-float-launcher .cs-ai-profile-picture svg{display:block;width:100%;height:100%}
        .cs-ai-float-online{position:absolute;right:0;bottom:1px;width:14px;height:14px;border:2px solid white;border-radius:50%;background:#31c777}
        .cs-ai-float-panel{position:fixed;right:22px;bottom:94px;width:min(850px,calc(100vw - 32px));height:min(720px,calc(100dvh - 125px));border:1px solid #dce7df;border-radius:18px;background:#f7f9f7;box-shadow:0 20px 70px #102c1c40;overflow:hidden;transform-origin:bottom right;opacity:0;visibility:hidden;pointer-events:none;transform:translate3d(0,18px,0) scale(.96);transition:opacity .28s ease,transform .38s cubic-bezier(.2,.8,.2,1),visibility 0s linear .38s;will-change:opacity,transform}
        .cs-ai-float-panel.is-collapsed{opacity:0;visibility:hidden;pointer-events:none;transform:translate3d(0,18px,0) scale(.96)}
        .cs-ai-float-panel.is-expanded{opacity:1;visibility:visible;pointer-events:auto;transform:translate3d(0,0,0) scale(1);transition:opacity .28s ease,transform .38s cubic-bezier(.2,.8,.2,1),visibility 0s linear 0s}
        .cs-ai-float-launcher:active { transform:scale(.91)!important; }
        .cs-ai-float-launcher .cs-ai-profile-picture { transition:transform .42s cubic-bezier(.2,.9,.25,1.25),filter .35s ease; }
        .cs-ai-float-launcher:active .cs-ai-profile-picture { transform:scale(.88) rotate(-8deg); }
        .cs-ai-float-windowbar{height:62px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 15px;background:#176b45;color:white}
        .cs-ai-float-windowbrand{display:flex;align-items:center;gap:10px;min-width:0}.cs-ai-float-windowbrand .cs-ai-profile-picture{width:42px;height:42px}.cs-ai-float-windowbrand strong,.cs-ai-float-windowbrand small{display:block}.cs-ai-float-windowbrand small{margin-top:3px;font-size:11px;opacity:.82}
        .cs-ai-float-windowcontrols{display:flex;gap:5px}.cs-ai-float-windowcontrols button{display:grid;place-items:center;width:34px;height:34px;border:0;border-radius:8px;background:#ffffff20;color:white;font-size:24px;cursor:pointer}
        .cs-ai-float-content{height:calc(100% - 62px);min-height:0}.cs-ai-float-panel .cs-ai{display:flex!important;flex-direction:row!important;width:100%!important;height:100%!important;min-height:0!important;max-height:none!important;margin:0!important;border:0!important;border-radius:0!important;overflow:hidden!important}
        .cs-ai-float-panel .cs-hero-banner,.cs-ai-float-panel .cs-ai-toolbar,.cs-ai-float-panel .cs-insights-column{display:none!important}.cs-ai-float-panel .cs-main{display:flex!important;flex:1 1 auto!important;flex-direction:column!important;width:100%!important;height:100%!important;min-height:0!important;overflow:hidden!important}.cs-ai-float-panel .cs-workspace{display:flex!important;flex:1 1 auto!important;min-height:0!important;height:auto!important;margin:0!important;padding:0!important;overflow:hidden!important}.cs-ai-float-panel .cs-chat-column{display:flex!important;flex:1 1 auto!important;width:100%!important;height:100%!important;min-height:0!important;overflow:hidden!important}.cs-ai-float-panel .cs-chat-scroll{flex:1 1 auto!important;min-height:0!important;height:auto!important;padding:16px!important;overflow-y:auto!important}.cs-ai-float-panel .cs-composer-area{flex:0 0 auto!important}.cs-ai-float-panel .cs-suggestions{grid-template-columns:1fr!important}
        /* Desktop chat history: reserve a permanent column beside the conversation. */
        @media (min-width: 651px) {
          .cs-ai-float-panel { width: min(1040px, calc(100vw - 40px)) !important; }
          .cs-ai-float-content { display: block !important; }
          .cs-ai-float-panel .cs-ai { display: flex !important; flex-direction: row !important; align-items: stretch !important; }
          .cs-ai-float-panel .cs-ai > .cs-float-history,
          .cs-ai-float-panel .cs-ai > aside.cs-sidebar {
            display: flex !important; flex: 0 0 245px !important; width: 245px !important;
            min-width: 245px !important; max-width: 245px !important; height: 100% !important;
            position: relative !important; inset: auto !important; visibility: visible !important;
            opacity: 1 !important; transform: none !important; pointer-events: auto !important;
            overflow: hidden !important; z-index: 3 !important; background: #fff !important;
            border-right: 1px solid #dce7df !important; box-shadow: none !important;
          }
          .cs-ai-float-panel .cs-ai > .cs-main { flex: 1 1 0 !important; width: 0 !important; min-width: 0 !important; }
          .cs-ai-float-panel .cs-ai .cs-history { display: flex !important; flex: 1 1 auto !important; min-height: 0 !important; overflow-y: auto !important; }
          .cs-ai-float-panel .cs-ai .cs-sidebar-overlay,
          .cs-ai-float-panel .cs-ai .cs-menu-button,
          .cs-ai-float-panel .cs-ai .cs-mobile-close { display: none !important; }
        }
        /* History toggle works on desktop too, with a polished width/opacity transition. */
        .cs-ai-float-panel .cs-menu-button{display:grid!important;place-items:center!important;flex:0 0 36px!important;width:36px!important;height:36px!important;border:1px solid #dce9df!important;border-radius:10px!important;background:#f2f8f3!important;color:#176b45!important;font-size:20px!important;cursor:pointer!important;transition:background .18s ease,transform .22s ease!important}
        .cs-ai-float-panel .cs-menu-button:hover{background:#e0f2e5!important;transform:scale(1.06)}
        @media(min-width:651px){
          .cs-ai-float-panel .cs-ai>.cs-float-history{transition:flex-basis .28s cubic-bezier(.2,.8,.2,1),width .28s, min-width .28s,opacity .18s,transform .28s!important}
          .cs-ai-float-panel .cs-ai.cs-history-hidden>.cs-float-history{flex-basis:0!important;width:0!important;min-width:0!important;max-width:0!important;opacity:0!important;transform:translateX(-14px)!important;border:0!important;pointer-events:none!important}
          .cs-ai-float-panel .cs-ai.cs-history-hidden .cs-menu-button{transform:rotate(180deg)}
          .cs-ai-float-panel .cs-ai.cs-history-visible .cs-menu-button{display:grid!important}
        }
        @keyframes cs-float-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @media(max-width:650px){
          .cs-ai-float-shell{right:14px;bottom:84px}
          .cs-ai-float-launcher{width:56px;height:56px}
          /* Mobile chat uses the full available screen instead of a clipped card. */
          .cs-ai-float-panel{position:fixed!important;inset:0!important;right:0!important;bottom:0!important;width:100vw!important;height:100dvh!important;max-height:100dvh!important;border-radius:0!important;border:0!important;transform-origin:center!important}
          .cs-ai-float-content{height:calc(100% - 62px)!important;width:100%!important;min-width:0!important;overflow:hidden!important}
          .cs-ai-float-panel .cs-ai{width:100%!important;max-width:100%!important;min-width:0!important;height:100%!important;min-height:0!important;overflow:hidden!important}
          .cs-ai-float-panel .cs-main{width:100%!important;min-width:0!important;max-width:100%!important;flex:1 1 0!important}
          .cs-ai-float-panel .cs-topbar{height:auto!important;min-height:54px!important;gap:7px!important;padding:8px 10px!important;flex-wrap:wrap!important}
          .cs-ai-float-panel .cs-topbar-title{gap:6px!important;font-size:11px!important;min-width:0!important}
          .cs-ai-float-panel .cs-beta{display:none!important}
          .cs-ai-float-panel .cs-topbar-actions{display:flex!important;gap:6px!important;min-width:0!important}
          .cs-ai-float-panel .cs-topbar-new,.cs-ai-float-panel .cs-tools-menu-button{padding:7px 8px!important;font-size:10px!important;white-space:nowrap!important}
          .cs-ai-float-panel .cs-chat-scroll{width:100%!important;max-width:100%!important;min-width:0!important;padding:12px!important;overflow-x:hidden!important}
          .cs-ai-float-panel .cs-messages{width:100%!important;max-width:100%!important;min-width:0!important}
          .cs-ai-float-panel .cs-message{max-width:100%!important;min-width:0!important}
          .cs-ai-float-panel .cs-message-body{overflow-wrap:anywhere!important;min-width:0!important}
          .cs-ai-float-panel .cs-result-panel{width:100%!important;max-width:100%!important;min-width:0!important;overflow-x:auto!important}
          .cs-ai-float-panel .cs-composer-area{width:100%!important;max-width:100%!important;min-width:0!important;padding:8px!important}
          .cs-ai-float-panel .cs-composer{width:100%!important;max-width:100%!important;min-width:0!important}
          .cs-ai-float-panel .cs-composer textarea,.cs-ai-float-panel .cs-composer input{min-width:0!important;max-width:100%!important}
          .cs-ai-float-panel .cs-suggestions{grid-template-columns:minmax(0,1fr)!important}
        }

        /* Mobile staff-account chat: force viewport-sized layout and flexible children */
        @media (max-width: 760px) {
          .cs-ai-float-shell { position: fixed !important; z-index: 99999 !important; }
          .cs-ai-float-panel,
          .cs-ai-float-panel.is-expanded {
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            height: 100vh !important;
            height: 100dvh !important;
            max-height: none !important;
            margin: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-sizing: border-box !important;
          }
          .cs-ai-float-windowbar { flex: 0 0 58px !important; min-width: 0 !important; padding: 7px 10px !important; }
          .cs-ai-float-windowbrand { flex: 1 1 auto !important; min-width: 0 !important; }
          .cs-ai-float-windowbrand strong { font-size: 13px !important; }
          .cs-ai-float-windowbrand small { font-size: 10px !important; }
          .cs-ai-float-windowcontrols { flex: 0 0 auto !important; }
          .cs-ai-float-content {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            height: calc(100% - 58px) !important;
            min-height: 0 !important;
            overflow: hidden !important;
          }
          .cs-ai-float-panel .cs-ai,
          .cs-ai-float-panel .cs-main,
          .cs-ai-float-panel .cs-workspace,
          .cs-ai-float-panel .cs-chat-column {
            display: flex !important;
            flex-direction: column !important;
            flex: 1 1 auto !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            min-height: 0 !important;
            height: 100% !important;
            margin: 0 !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
          }
          .cs-ai-float-panel .cs-chat-scroll {
            flex: 1 1 0 !important;
            width: 100% !important;
            min-width: 0 !important;
            min-height: 0 !important;
            overflow-x: hidden !important;
            overflow-y: auto !important;
            padding: 12px 10px !important;
            box-sizing: border-box !important;
          }
          .cs-ai-float-panel .cs-message,
          .cs-ai-float-panel .cs-message-body {
            max-width: 100% !important;
            min-width: 0 !important;
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
          }
          .cs-ai-float-panel .cs-result-panel,
          .cs-ai-float-panel .cs-table-wrap {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
          }
          .cs-ai-float-panel .cs-table { min-width: 560px !important; }
          .cs-ai-float-panel .cs-composer-area {
            flex: 0 0 auto !important;
            width: 100% !important;
            min-width: 0 !important;
            padding: 8px !important;
            padding-bottom: max(8px, env(safe-area-inset-bottom)) !important;
            box-sizing: border-box !important;
          }
          .cs-ai-float-panel .cs-composer { width: 100% !important; min-width: 0 !important; box-sizing: border-box !important; }
          .cs-ai-float-panel .cs-composer textarea { width: 100% !important; min-width: 0 !important; max-width: 100% !important; font-size: 16px !important; box-sizing: border-box !important; }
          .cs-ai-float-panel .cs-composer-bottom { display: flex !important; align-items: center !important; justify-content: space-between !important; flex-wrap: wrap !important; gap: 8px !important; }
          .cs-ai-float-panel .cs-send { flex: 0 0 auto !important; min-height: 42px !important; }
        }
        @media(prefers-reduced-motion:reduce){.cs-ai-float-launcher,.cs-ai-float-panel{animation:none;transition:none}}
        /* Final interaction polish: history toggle is available on desktop and mobile. */
        .cs-ai-float-panel .cs-ai .cs-menu-button {
          display:grid!important; place-items:center!important; flex:0 0 36px!important;
          width:36px!important; height:36px!important; border:1px solid #dce9df!important;
          border-radius:10px!important; background:linear-gradient(145deg,#f7fcf8,#e8f4eb)!important;
          color:#176b45!important; font-size:20px!important; cursor:pointer!important;
          box-shadow:0 3px 10px #176b4510!important;
          transition:transform .32s cubic-bezier(.2,.8,.2,1),background .2s,box-shadow .2s!important;
        }
        .cs-ai-float-panel .cs-ai .cs-menu-button:hover {
          transform:translateY(-1px) scale(1.05)!important; background:#dff2e5!important;
          box-shadow:0 6px 16px #176b4520!important;
        }
        .cs-ai-float-panel .cs-ai .cs-menu-button:active { transform:scale(.94)!important; }
        @media (min-width:651px) {
          .cs-ai-float-panel .cs-ai>.cs-float-history {
            transition:flex-basis .36s cubic-bezier(.22,1,.36,1),width .36s cubic-bezier(.22,1,.36,1),
              min-width .36s cubic-bezier(.22,1,.36,1),max-width .36s cubic-bezier(.22,1,.36,1),
              opacity .2s ease,transform .36s cubic-bezier(.22,1,.36,1)!important;
          }
          .cs-ai-float-panel .cs-ai.cs-history-hidden>.cs-float-history {
            flex-basis:0!important;width:0!important;min-width:0!important;max-width:0!important;
            padding-left:0!important;padding-right:0!important;opacity:0!important;
            transform:translateX(-22px) scale(.985)!important;border-right:0!important;
            pointer-events:none!important;
          }
          .cs-ai-float-panel .cs-ai.cs-history-hidden .cs-menu-button { transform:rotate(180deg)!important; }
          .cs-ai-float-panel .cs-ai.cs-history-visible .cs-menu-button { display:grid!important; }
        }
        .cs-ai-float-windowcontrols button { transition:transform .2s ease,background .2s ease,box-shadow .2s ease!important; }
        .cs-ai-float-windowcontrols button:hover { transform:translateY(-2px); background:#ffffff35!important; box-shadow:0 5px 14px #062b1a25; }
        .cs-ai-float-launcher { transition:transform .28s cubic-bezier(.2,.8,.2,1),box-shadow .28s ease!important; }
        .cs-ai-float-launcher:hover { transform:translateY(-4px) scale(1.045)!important; box-shadow:0 16px 38px #176b4545!important; }
        /* Signature launcher: luminous orbit, custom robot badge, and an expanding hover label. */
        .cs-ai-float-shell { isolation:isolate; }
        .cs-ai-float-launcher {
          z-index:2; width:70px!important; height:70px!important; border:1px solid rgba(255,255,255,.9)!important;
          background:linear-gradient(145deg,#20a66a 0%,#087447 56%,#064e38 100%)!important;
          box-shadow:0 10px 28px rgba(4,77,48,.32),inset 0 1px 0 rgba(255,255,255,.6),0 0 0 5px rgba(34,197,112,.10)!important;
          isolation:isolate; transition:transform .48s cubic-bezier(.16,1,.3,1),box-shadow .4s ease!important;
        }
        .cs-ai-float-launcher::before { content:""; position:absolute; inset:-7px; border:1px solid rgba(45,211,126,.45); border-radius:50%; animation:cs-ai-orbit-pulse 2.8s ease-out infinite; pointer-events:none; }
        .cs-ai-float-launcher::after { content:""; position:absolute; inset:4px; border-radius:50%; background:linear-gradient(135deg,rgba(255,255,255,.23),transparent 48%); pointer-events:none; }
        .cs-ai-float-launcher .cs-ai-profile-picture { position:relative; z-index:2; width:56px!important; height:56px!important; border-radius:50%; overflow:hidden; filter:drop-shadow(0 3px 4px rgba(0,0,0,.18)); }
        .cs-ai-float-launcher .cs-ai-profile-picture svg { width:100%;height:100%; }
        .cs-ai-launcher-label { position:absolute; z-index:-1; right:39px; top:50%; display:flex; flex-direction:column; gap:3px; width:max-content; max-width:min(290px,calc(100vw - 105px)); padding:12px 43px 12px 17px; border:1px solid rgba(255,255,255,.82); border-radius:18px 8px 8px 18px; color:#f4fff8; background:linear-gradient(110deg,rgba(8,83,53,.98),rgba(15,135,79,.97)); box-shadow:0 10px 28px rgba(5,60,39,.22),inset 0 1px rgba(255,255,255,.14); font-size:12px; font-weight:500; white-space:nowrap; opacity:0; transform:translate(18px,-50%) scale(.82); transform-origin:right center; clip-path:inset(0 0 0 100% round 18px); transition:opacity .28s ease,transform .48s cubic-bezier(.16,1,.3,1),clip-path .48s cubic-bezier(.16,1,.3,1); pointer-events:none; }
        /* Hint is timer-driven, never hover-driven. */
        .cs-ai-launcher-label { z-index:1!important; }
        .cs-ai-launcher-label.is-hint-visible { opacity:1!important; visibility:visible!important; transform:translate(0,-50%) scale(1)!important; clip-path:inset(0 0 0 0 round 18px)!important; }
        .cs-ai-launcher-label.is-hint-hidden { opacity:0!important; visibility:hidden!important; transform:translate(16px,-50%) scale(.88)!important; clip-path:inset(0 0 0 100% round 18px)!important; }
        .cs-ai-float-launcher:hover .cs-ai-launcher-label,.cs-ai-float-launcher:focus-visible .cs-ai-launcher-label { opacity:inherit; }
        .cs-ai-float-launcher:hover .cs-ai-launcher-orbit,.cs-ai-float-launcher:focus-visible .cs-ai-launcher-orbit { opacity:1; animation:cs-ai-orbit-spin 3s linear infinite; }
        .cs-ai-launcher-label strong { font-size:14px; letter-spacing:.1px; }
        .cs-ai-launcher-label i { color:#b9f5d1; font-size:10px; font-style:normal; }
        .cs-ai-launcher-orbit { position:absolute; inset:-3px; border-radius:50%; border:2px solid transparent; border-top-color:#b6ffd2; border-right-color:rgba(182,255,210,.4); opacity:0; transition:opacity .3s ease; pointer-events:none; }
        .cs-ai-float-launcher:hover,.cs-ai-float-launcher:focus-visible { z-index:5; transform:translateY(-4px) scale(1.055)!important; box-shadow:0 18px 42px rgba(4,77,48,.38),0 0 0 7px rgba(34,197,112,.13)!important; }
        .cs-ai-float-launcher:hover .cs-ai-launcher-label:not(.is-hint-visible),.cs-ai-float-launcher:focus-visible .cs-ai-launcher-label:not(.is-hint-visible) { opacity:0!important; }
        .cs-ai-float-launcher:hover .cs-ai-launcher-orbit,.cs-ai-float-launcher:focus-visible .cs-ai-launcher-orbit { opacity:1; animation:cs-ai-orbit-spin 3s linear infinite; }
        .cs-ai-float-online { z-index:4; right:0!important; bottom:0!important; width:15px!important; height:15px!important; border:3px solid #f4fff8!important; box-shadow:0 0 0 3px rgba(49,199,119,.2); }
        .cs-ai-float-panel { border:1px solid rgba(180,224,195,.85)!important; border-radius:24px!important; box-shadow:0 32px 100px rgba(3,45,28,.3),0 0 0 1px rgba(255,255,255,.65)!important; transform-origin:bottom right!important; }
        /* One consistent open/close transition (avoid competing keyframe animations). */
        .cs-ai-float-panel {
          transition: opacity .30s ease,
            transform .42s cubic-bezier(.2,.8,.2,1),
            visibility 0s linear .42s !important;
        }
        .cs-ai-float-panel.is-expanded {
          opacity:1 !important; visibility:visible !important; pointer-events:auto !important;
          transform:translate3d(0,0,0) scale(1) !important;
          transition:opacity .30s ease, transform .42s cubic-bezier(.2,.8,.2,1), visibility 0s linear 0s !important;
        }
        .cs-ai-float-panel.is-collapsed {
          opacity:0 !important;
          visibility:hidden !important;
          pointer-events:none !important;
          transform:translate3d(0,18px,0) scale(.96) !important;
          transition:opacity .30s ease,
            transform .42s cubic-bezier(.2,.8,.2,1),
            visibility 0s linear .42s !important;
        }
        .cs-ai-float-windowbar { background:linear-gradient(110deg,#075c3c,#138653 58%,#20a66a)!important; }
        @keyframes cs-ai-orbit-pulse { 0%{transform:scale(.94);opacity:.85} 75%,100%{transform:scale(1.2);opacity:0} }
        @keyframes cs-ai-orbit-spin { to{transform:rotate(360deg)} }
        @media(max-width:600px) {
          .cs-ai-float-shell { right:14px!important; bottom:88px!important; }
          .cs-ai-float-launcher { width:62px!important;height:62px!important; }
          .cs-ai-float-launcher .cs-ai-profile-picture { width:50px!important;height:50px!important; }
          .cs-ai-launcher-label { max-width:calc(100vw - 90px); padding:10px 34px 10px 12px; }
          .cs-ai-launcher-label strong { font-size:12px; }
          .cs-ai-launcher-label i { font-size:9px; }
          .cs-ai-float-panel { right:10px!important;bottom:82px!important;width:calc(100vw - 20px)!important;height:min(720px,calc(100dvh - 100px))!important;border-radius:20px!important; }
        }
        @media(prefers-reduced-motion:reduce) {
          .cs-ai-float-panel,.cs-ai-float-panel *, .cs-ai-float-launcher,.cs-ai-launcher-label,.cs-ai-launcher-orbit { animation:none!important;transition:none!important; }
          .cs-ai-launcher-label { clip-path:none; }
        }
      `}
      </style>
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



function ClothStockNavIcon({ type }) {
  const common = { width: 21, height: 21, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  const shapes = {
    dashboard: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="4.5" rx="1.5"/><rect x="13.5" y="10.5" width="7" height="10" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/></>,
    products: <><path d="M4 8.5 12 4l8 4.5-8 4.5-8-4.5Z"/><path d="M4 8.5V17l8 4 8-4V8.5M12 13v8M8 6.3l8 4.5"/></>,
    sales: <><path d="M4 19.5h16"/><path d="M6.5 16V11M12 16V5M17.5 16V8"/><path d="m5 8 5-3 4 2 5-4"/></>,
    reports: <><path d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M14.5 3.5V8H19M9 12h6M9 15.5h6M9 9h1"/></>,
    users: <><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20v-1.3a5.5 5.5 0 0 1 11 0V20z"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6.1M17 14.5a4.6 4.6 0 0 1 3.5 4.2V20h-3"/></>,
    logout: <><path d="M10 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20H10"/><path d="M14 8l4 4-4 4M8 12h10"/></>
  };
  return <svg {...common}>{shapes[type] || shapes.products}</svg>;
}

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
  <>
  <style>{`
    .app .sidebar .nav-link { display:flex; align-items:center; gap:12px; position:relative; padding:10px 14px; min-height:49px; border-radius:14px; border:1px solid transparent; text-align:left; transition:background .2s ease, color .2s ease, transform .2s ease, box-shadow .2s ease; }
    /* Remove legacy/duplicate navigation artwork; keep only the new icon inside .cs-nav-icon. */
    .app .sidebar .nav-link::before,
    .app .sidebar .nav-link::after { content:none !important; display:none !important; }
    .app .sidebar .nav-link > svg,
    .app .sidebar .nav-link > i,
    .app .sidebar .nav-link > .icon,
    .app .sidebar .nav-link > .nav-icon,
    .app .sidebar .nav-link > .menu-icon,
    .app .sidebar .nav-link > .sidebar-icon { display:none !important; }
    .app .sidebar .nav-link .cs-nav-icon { position:relative; z-index:1; }
    .app .sidebar .nav-link .cs-nav-label { position:relative; z-index:1; }
    .app .sidebar .nav-link .cs-nav-icon { display:grid; place-items:center; flex:0 0 38px; width:38px; height:38px; border-radius:12px; color:#168451; background:linear-gradient(145deg,#eff8f2,#e3f1e8); box-shadow:inset 0 0 0 1px rgba(26,132,79,.08); transition:background .2s ease,color .2s ease,transform .2s ease; }
    .app .sidebar .nav-link .cs-nav-label { font-weight:650; letter-spacing:.05px; }
    .app .sidebar .nav-link:hover { background:#f0f8f3; color:#08734a; transform:translateX(3px); }
    .app .sidebar .nav-link:hover .cs-nav-icon { color:#fff; background:linear-gradient(145deg,#25b879,#08734a); transform:translateY(-1px); }
    .app .sidebar .nav-link.active { color:#08734a; background:linear-gradient(105deg,#e2f5e9,#f1faf4); border-color:#ccebd8; box-shadow:0 5px 15px rgba(17,116,69,.07), inset 3px 0 #168451; }
    .app .sidebar .nav-link.active .cs-nav-icon { color:#fff; background:linear-gradient(145deg,#29b97c,#08734a); box-shadow:0 4px 9px rgba(8,116,74,.2); }
    .app .sidebar .nav-link:focus-visible { outline:3px solid rgba(37,185,120,.38); outline-offset:2px; }
    .app .sidebar .staff-bottom-logout { margin-top:auto; }
    .app .sidebar .staff-bottom-logout .cs-nav-icon { color:#b34a4a; background:#fff0ef; }
    .app .sidebar .staff-bottom-logout:hover { color:#a42d2d; background:#fff5f4; }
    .app .sidebar .staff-bottom-logout:hover .cs-nav-icon { color:white; background:linear-gradient(145deg,#f07770,#bd3c37); }
    @media (prefers-reduced-motion:reduce) { .app .sidebar .nav-link,.app .sidebar .nav-link .cs-nav-icon { transition:none; } }
  `}</style>
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
            <span className="cs-nav-icon"><ClothStockNavIcon type="dashboard" /></span><span className="cs-nav-label">Dashboard</span>
          </button>
        )}

        <button
          type="button"
          className={`nav-link ${
            activeSection === "products" ? "active" : ""
          }`}
          onClick={() => navigateTo("products")}
        >
          <span className="cs-nav-icon"><ClothStockNavIcon type="products" /></span><span className="cs-nav-label">Products</span>
        </button>

        <button
          type="button"
          className={`nav-link ${
            activeSection === "sales" ? "active" : ""
          }`}
          onClick={() => navigateTo("sales")}
        >
          <span className="cs-nav-icon"><ClothStockNavIcon type="sales" /></span><span className="cs-nav-label">Sales</span>
        </button>

        {!isAdmin && (
          <button
            type="button"
            className="nav-link staff-bottom-logout"
            onClick={logout}
            aria-label="Logout"
          >
            <span className="cs-nav-icon"><ClothStockNavIcon type="logout" /></span>
            <span className="cs-nav-label">Logout</span>
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
            <span className="cs-nav-icon"><ClothStockNavIcon type="reports" /></span><span className="cs-nav-label">Reports</span>
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
            <span className="cs-nav-icon"><ClothStockNavIcon type="users" /></span><span className="cs-nav-label">User Management</span>
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
  </>
  );
}

export default App;
