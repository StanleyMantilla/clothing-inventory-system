
import { useEffect, useMemo, useRef, useState } from "react";
import "./AIWorkspace.css";
import { API_URL } from "./api";

const suggestions = [
  { icon: "▣", text: "Which products need restocking?" },
  { icon: "▥", text: "What are my best-selling items?" },
  { icon: "▤", text: "Show me inventory summary" },
  { icon: "₱", text: "What's my total revenue?" },
];

function currency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

export default function AIWorkspace({
  products = [],
  sales = [],
  inventory = null,
  lowStock = [],
  user,
  token,
}) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(new Date());
  const bottomRef = useRef(null);

  const totalRevenue = useMemo(
    () =>
      sales.reduce(
        (sum, sale) => sum + Number(sale.totalAmount || 0),
        0
      ),
    [sales]
  );

  const totalStock =
    inventory?.totalStock ??
    products.reduce(
      (sum, product) => sum + Number(product.quantity || 0),
      0
    );

  const totalProducts =
    inventory?.totalProducts ?? products.length;

  const recentSales = useMemo(
    () =>
      [...sales]
        .sort(
          (a, b) =>
            new Date(b.soldAt || 0) -
            new Date(a.soldAt || 0)
        )
        .slice(0, 4),
    [sales]
  );

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function askAI(text) {
    const cleanQuestion = text.trim();

    if (!cleanQuestion || loading) return;

    if (!token) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    setError("");
    setQuestion("");

    setMessages((previous) => [
      ...previous,
      {
        role: "user",
        content: cleanQuestion,
        id: `${Date.now()}-user`,
      },
    ]);

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: cleanQuestion }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "The AI request failed.");
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: data.answer || "No response was returned.",
          products: Array.isArray(data.products)
            ? data.products
            : [],
          id: `${Date.now()}-assistant`,
        },
      ]);
    } catch (err) {
      setError(err.message || "Unable to connect to ClothStock AI.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    askAI(question);
  }

  function handleSearch(event) {
    event.preventDefault();

    if (search.trim()) {
      askAI(search);
      setSearch("");
    }
  }

  return (
    <div className="ai-workspace">
      <header className="ai-topbar">
        <form className="ai-global-search" onSubmit={handleSearch}>
          <span aria-hidden="true">⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products, codes, or ask ClothStock AI..."
            aria-label="Search inventory or ask AI"
          />
        </form>

        <div className="ai-topbar-user">
          <span className="ai-clock">
            {now.toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {" · "}
            {now.toLocaleTimeString("en-PH", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>

          <span className="ai-user-avatar">
            {(user?.name || "U").charAt(0).toUpperCase()}
          </span>

          <strong>{user?.name || "User"}</strong>
        </div>
      </header>

      <div className="ai-workspace-grid">
        <div className="ai-center-column">
          <section className="ai-hero">
            <div className="ai-hero-copy">
              <span className="ai-hero-label">✦ AI ASSISTANT</span>

              <h1>
                Hello, I’m
                <br />
                <span>ClothStock AI ✨</span>
              </h1>

              <p>
                Your intelligent inventory assistant. Get real-time
                insights, make better decisions, and keep your stock
                running smoothly.
              </p>

              <div className="ai-hero-tags">
                <span>▣ Inventory Insights</span>
                <span>▥ Sales Analysis</span>
                <span>♧ Stock Alerts</span>
                <span>✦ Smart Recommendations</span>
              </div>
            </div>

            <div className="ai-hero-mascot" aria-hidden="true">
              <div className="ai-mascot-orbit">✦</div>
              <div className="ai-mascot-antenna" />
              <div className="ai-mascot-head">
                <span className="ai-mascot-eyes">•ᴗ•</span>
              </div>
              <div className="ai-mascot-body">
                <strong>C</strong>
              </div>
              <div className="ai-mascot-caption">
                Smarter inventory.
                <br />
                Better business.
              </div>
            </div>
          </section>

          <section className="ai-chat-card">
            <div className="ai-chat-heading">
              <span className="ai-sparkle-icon">✦</span>
              <div>
                <h2>Ask ClothStock AI</h2>
                <p>
                  Type your question below or choose a suggested question.
                </p>
              </div>
            </div>

            {messages.length === 0 ? (
              <div className="ai-suggestions">
                {suggestions.map((item) => (
                  <button
                    type="button"
                    className="ai-suggestion"
                    key={item.text}
                    disabled={loading}
                    onClick={() => askAI(item.text)}
                  >
                    <span className="ai-suggestion-icon">
                      {item.icon}
                    </span>
                    <span>{item.text}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="ai-chat-messages" aria-live="polite">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`ai-message ${
                      message.role === "user"
                        ? "ai-message-user"
                        : "ai-message-assistant"
                    }`}
                  >
                    <span className="ai-message-avatar">
                      {message.role === "user" ? "U" : "✦"}
                    </span>

                    <div className="ai-message-content">
                      <strong>
                        {message.role === "user"
                          ? "You"
                          : "ClothStock AI"}
                      </strong>

                      <p>{message.content}</p>

                      {message.products?.length > 0 && (
                        <div className="ai-result-table-wrap">
                          <table className="ai-result-table">
                            <thead>
                              <tr>
                                <th>Product</th>
                                <th>Code</th>
                                <th>Stock</th>
                              </tr>
                            </thead>
                            <tbody>
                              {message.products.map((product, index) => (
                                <tr key={product._id || product.code || index}>
                                  <td>{product.name || "—"}</td>
                                  <td>{product.code || "—"}</td>
                                  <td>{product.quantity ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </article>
                ))}

                {loading && (
                  <div className="ai-thinking">
                    <span className="ai-thinking-dot" />
                    ClothStock AI is checking your records...
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            )}

            {error && (
              <div className="ai-error" role="alert">
                {error}
              </div>
            )}

            <form className="ai-composer" onSubmit={handleSubmit}>
              <span className="ai-composer-icon" aria-hidden="true">
                ✦
              </span>

              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Type your question here..."
                aria-label="Ask ClothStock AI"
                disabled={loading}
              />

              <button
                type="submit"
                disabled={loading || !question.trim()}
                aria-label="Send question"
              >
                ➤
              </button>
            </form>
          </section>

          <footer className="ai-benefit-strip">
            <div><span>✦</span><p><strong>Smarter Decisions</strong><br />with AI</p></div>
            <div><span>▤</span><p><strong>Real-time</strong><br />Inventory Data</p></div>
            <div><span>▥</span><p><strong>Sales Performance</strong><br />Analysis</p></div>
            <div><span>♧</span><p><strong>Stock Alerts &</strong><br />Recommendations</p></div>
          </footer>
        </div>

        <aside className="ai-insights-column">
          <section className="ai-side-card">
            <div className="ai-side-card-heading">
              <h2>↗ Quick Insights</h2>
              <span>Live data</span>
            </div>

            <div className="ai-insight-grid">
              <article className="ai-insight-tile">
                <span className="ai-tile-icon">↗</span>
                <p>Total Products</p>
                <strong>{totalProducts}</strong>
                <small>in inventory</small>
              </article>

              <article className="ai-insight-tile">
                <span className="ai-tile-icon">₱</span>
                <p>Total Sales Revenue</p>
                <strong className="ai-money">
                  {currency(totalRevenue)}
                </strong>
                <small>{sales.length} recorded sales</small>
              </article>

              <article className="ai-insight-tile">
                <span className="ai-tile-icon ai-warning-icon">!</span>
                <p>Low Stock Items</p>
                <strong>{lowStock.length}</strong>
                <small>need attention</small>
              </article>

              <article className="ai-insight-tile">
                <span className="ai-tile-icon">▣</span>
                <p>Total Stock</p>
                <strong>{Number(totalStock).toLocaleString()}</strong>
                <small>units available</small>
              </article>
            </div>
          </section>

          <section className="ai-side-card ai-activity-card">
            <div className="ai-side-card-heading">
              <h2>◷ Recent Activity</h2>
            </div>

            {recentSales.length ? (
              recentSales.map((sale) => (
                <article className="ai-activity-item" key={sale._id}>
                  <span className="ai-activity-icon">₱</span>
                  <div>
                    <strong>Sale recorded</strong>
                    <p>
                      {sale.productId?.name || "Clothing product"} ·{" "}
                      {sale.quantity} unit(s)
                    </p>
                  </div>
                  <small>
                    {sale.soldAt
                      ? new Date(sale.soldAt).toLocaleDateString("en-PH")
                      : "—"}
                  </small>
                </article>
              ))
            ) : (
              <p className="ai-no-activity">
                Your recent sales will appear here.
              </p>
            )}
          </section>

          <section className="ai-cta-card">
            <span className="ai-cta-star">✦</span>
            <h2>Need specific insights?</h2>
            <p>
              Ask ClothStock AI about stock levels, product performance,
              and inventory trends.
            </p>
            <button
              type="button"
              onClick={() =>
                document.querySelector(".ai-composer input")?.focus()
              }
            >
              Ask a question <span>→</span>
            </button>
            <div className="ai-cta-decoration" aria-hidden="true">✧</div>
          </section>
        </aside>
      </div>
    </div>
  );
}
