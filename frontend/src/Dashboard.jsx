
import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

const COLORS = ["#176b45", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899"];

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 2,
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function getProductId(value) {
  if (!value) return "";

  if (typeof value === "object") {
    return String(value._id || value.id || "");
  }

  return String(value);
}

function getSaleDate(sale) {
  const possibleDates = [
    sale?.soldAt,
    sale?.createdAt,
    sale?.saleDate,
    sale?.date,
    sale?.timestamp,
    sale?.updatedAt,
  ];

  for (const value of possibleDates) {
    if (!value) continue;

    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  // Use the MongoDB ObjectId timestamp as a fallback.
  const id = String(sale?._id || "");

  if (/^[a-f\d]{24}$/i.test(id)) {
    const date = new Date(
      Number.parseInt(id.slice(0, 8), 16) * 1000
    );

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function EmptyState({ children = "No data available yet." }) {
  return <div className="chart-empty">{children}</div>;
}

function SummaryCard({ label, value, detail, icon }) {
  return (
    <article className="dashboard-stat-card">
      <div className="dashboard-stat-top">
        <span className="dashboard-stat-label">{label}</span>
        <span className="dashboard-stat-icon" aria-hidden="true">
          {icon}
        </span>
      </div>

      <div className="dashboard-stat-value">{value}</div>

      {detail && (
        <div className="dashboard-stat-detail">{detail}</div>
      )}
    </article>
  );
}

export default function Dashboard({
  products = [],
  sales = [],
  inventory = {},
  lowStock = [],
}) {
  const safeProducts = Array.isArray(products) ? products : [];
  const safeSales = Array.isArray(sales) ? sales : [];
  const safeLowStock = Array.isArray(lowStock) ? lowStock : [];

  const summary = useMemo(() => {
    const totalProducts = safeProducts.length;

    const totalStock = safeProducts.reduce(
      (sum, product) =>
        sum + (Number(product.quantity) || 0),
      0
    );

    const totalRevenue = safeSales.reduce(
      (sum, sale) =>
        sum + (Number(sale.totalAmount) || 0),
      0
    );

    const inventoryCost = safeProducts.reduce(
      (sum, product) =>
        sum +
        (Number(product.quantity) || 0) *
          (Number(product.costPrice) || 0),
      0
    );

    const inventorySellingValue = safeProducts.reduce(
      (sum, product) =>
        sum +
        (Number(product.quantity) || 0) *
          (Number(product.sellingPrice) || 0),
      0
    );

    return {
      totalProducts,
      totalStock,
      lowStockCount: safeLowStock.length,
      totalRevenue,
      inventoryCost,
      inventorySellingValue,
    };
  }, [safeProducts, safeSales, safeLowStock]);

  const salesChartData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days = [];

    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);

      const dateKey = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");

      days.push({
        dateKey,
        day: date.toLocaleDateString("en-PH", {
          weekday: "short",
        }),
        revenue: 0,
        transactions: 0,
      });
    }

    const daysByKey = new Map(
      days.map((day) => [day.dateKey, day])
    );

    safeSales.forEach((sale) => {
      const date = getSaleDate(sale);
      if (!date) return;

      const dateKey = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");

      const day = daysByKey.get(dateKey);

      if (day) {
        day.revenue += Number(sale.totalAmount) || 0;
        day.transactions += 1;
      }
    });

    return days;
  }, [safeSales]);

  const topProducts = useMemo(() => {
    const totals = new Map();

    safeSales.forEach((sale) => {
      const productId = getProductId(sale.productId);

      const populatedName =
        typeof sale.productId === "object"
          ? sale.productId?.name
          : "";

      const product = safeProducts.find(
        (item) => getProductId(item._id) === productId
      );

      const name =
        populatedName ||
        product?.name ||
        sale.productName ||
        "Unknown product";

      const key = productId || name;
      const existing = totals.get(key) || {
        name,
        quantity: 0,
      };

      existing.quantity += Number(sale.quantity) || 0;
      totals.set(key, existing);
    });

    return Array.from(totals.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [safeSales, safeProducts]);

  const categoryData = useMemo(() => {
    const categories = new Map();

    safeProducts.forEach((product) => {
      const category = product.category || "Uncategorized";
      const quantity = Number(product.quantity) || 0;

      categories.set(
        category,
        (categories.get(category) || 0) + quantity
      );
    });

    return Array.from(categories, ([name, value]) => ({
      name,
      value,
    })).filter((item) => item.value > 0);
  }, [safeProducts]);

  const recentSales = useMemo(() => {
    return safeSales
      .map((sale) => ({
        ...sale,
        dashboardDate: getSaleDate(sale),
      }))
      .sort((a, b) => {
        return (
          (b.dashboardDate?.getTime() || 0) -
          (a.dashboardDate?.getTime() || 0)
        );
      })
      .slice(0, 5);
  }, [safeSales]);

  function productNameForSale(sale) {
    if (
      sale.productId &&
      typeof sale.productId === "object" &&
      sale.productId.name
    ) {
      return sale.productId.name;
    }

    const productId = getProductId(sale.productId);

    const product = safeProducts.find(
      (item) => getProductId(item._id) === productId
    );

    return (
      product?.name ||
      sale.productName ||
      "Unknown product"
    );
  }

  return (
    <div className="dashboard-content">
      <div className="dashboard-page-heading">
        <div>
          <h2>Dashboard Overview</h2>
          <p>
            Monitor your clothing inventory and sales performance.
          </p>
        </div>

        <div className="dashboard-date-label">
          {new Date().toLocaleDateString("en-PH", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      </div>

      <section className="dashboard-stats">
        <SummaryCard
          label="Total Products"
          value={summary.totalProducts.toLocaleString("en-PH")}
          detail="Different product entries"
          icon="▦"
        />

        <SummaryCard
          label="Total Stock"
          value={summary.totalStock.toLocaleString("en-PH")}
          detail="Units currently recorded"
          icon="▤"
        />

        <SummaryCard
          label="Low-Stock Items"
          value={summary.lowStockCount.toLocaleString("en-PH")}
          detail="Products needing attention"
          icon="!"
        />

        <SummaryCard
          label="Recorded Revenue"
          value={formatCurrency(summary.totalRevenue)}
          detail={`${safeSales.length} recorded sales`}
          icon="₱"
        />
      </section>

      <section className="dashboard-kpi-row">
        <div className="dashboard-kpi-card">
          <span>Inventory Cost Value</span>
          <strong>{formatCurrency(summary.inventoryCost)}</strong>
          <small>Current stock × cost price</small>
        </div>

        <div className="dashboard-kpi-card">
          <span>Potential Selling Value</span>
          <strong>
            {formatCurrency(summary.inventorySellingValue)}
          </strong>
          <small>Current stock × selling price</small>
        </div>

        <div className="dashboard-kpi-card">
          <span>Recorded Transactions</span>
          <strong>{safeSales.length.toLocaleString("en-PH")}</strong>
          <small>Sales entries in the system</small>
        </div>
      </section>

      <section className="dashboard-charts">
        <article className="dashboard-chart-card">
          <div className="dashboard-chart-heading">
            <div>
              <h3>Sales Overview</h3>
              <p>Recorded revenue over the last 7 days</p>
            </div>
          </div>

          <div className="dashboard-chart-area">
            {salesChartData.some((day) => day.revenue > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={salesChartData}
                  margin={{ top: 12, right: 12, left: 4, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis dataKey="day" />
                  <YAxis
                    width={65}
                    tickFormatter={(value) =>
                      value >= 1000
                        ? `₱${(value / 1000).toFixed(1)}k`
                        : `₱${value}`
                    }
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      name === "Revenue"
                        ? formatCurrency(value)
                        : value,
                      name,
                    ]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#176b45"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState>
                No dated sales found for the last 7 days.
              </EmptyState>
            )}
          </div>
        </article>

        <article className="dashboard-chart-card">
          <div className="dashboard-chart-heading">
            <div>
              <h3>Top-Selling Products</h3>
              <p>Products ranked by units sold</p>
            </div>
          </div>

          <div className="dashboard-chart-area">
            {topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topProducts}
                  layout="vertical"
                  margin={{ top: 8, right: 18, left: 12, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                  />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="quantity"
                    name="Units Sold"
                    fill="#176b45"
                    radius={[0, 5, 5, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState>No sales recorded yet.</EmptyState>
            )}
          </div>
        </article>

        <article className="dashboard-chart-card inventory-chart-card">
          <div className="dashboard-chart-heading">
            <div>
              <h3>Inventory by Category</h3>
              <p>Current stock distribution</p>
            </div>
          </div>

          <div className="dashboard-chart-area">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius="58%"
                    innerRadius="32%"
                    paddingAngle={3}
                    label={false}
                    labelLine={false}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    layout="horizontal"
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{ fontSize: 11, paddingTop: 8, maxWidth: "100%" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState>
                No stock available to display.
              </EmptyState>
            )}
          </div>
        </article>
      </section>

      <section className="dashboard-bottom-grid">
        <article className="dashboard-table-card">
          <div className="dashboard-table-heading">
            <div>
              <h3>Low-Stock Alerts</h3>
              <p>Products that may need restocking</p>
            </div>

            <span className="dashboard-count-pill">
              {safeLowStock.length}
            </span>
          </div>

          {safeLowStock.length > 0 ? (
            <div className="dashboard-table-scroll">
              <table className="dashboard-data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {safeLowStock.slice(0, 5).map((product, index) => (
                    <tr key={product._id || product.code || index}>
                      <td>
                        <strong>
                          {product.name || "Unnamed product"}
                        </strong>
                        <small>
                          {product.code || "No product code"}
                        </small>
                      </td>
                      <td>{product.category || "Uncategorized"}</td>
                      <td>
                        <span className="dashboard-stock-warning">
                          {Number(product.quantity) || 0} left
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>No low-stock products reported.</EmptyState>
          )}
        </article>

        <article className="dashboard-table-card">
          <div className="dashboard-table-heading">
            <div>
              <h3>Recent Sales</h3>
              <p>Your latest recorded transactions</p>
            </div>

            <span className="dashboard-count-pill">
              {recentSales.length}
            </span>
          </div>

          {recentSales.length > 0 ? (
            <div className="dashboard-table-scroll">
              <table className="dashboard-data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale, index) => (
                    <tr key={sale._id || index}>
                      <td>
                        <strong>{productNameForSale(sale)}</strong>
                        <small>{formatDate(sale.dashboardDate)}</small>
                      </td>
                      <td>{Number(sale.quantity) || 0}</td>
                      <td>
                        <strong>
                          {formatCurrency(sale.totalAmount)}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>No sales have been recorded yet.</EmptyState>
          )}
        </article>
      </section>
    </div>
  );
}
