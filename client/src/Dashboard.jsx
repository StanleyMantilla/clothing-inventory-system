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

const COLORS = [
  "#16734a",
  "#399b70",
  "#70b995",
  "#e5aa45",
  "#5588c8",
  "#8c78cc",
];

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);
}

function Dashboard({
  products = [],
  sales = [],
  inventory = {},
  lowStock = [],
}) {
  // Prepare sales data by calendar date.
  const chartData = useMemo(() => {
    const dailySales = new Map();

    sales.forEach((sale) => {
      if (!sale.soldAt) return;

      const date = new Date(sale.soldAt);

      if (Number.isNaN(date.getTime())) return;

      const key = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
      ].join("-");

      if (!dailySales.has(key)) {
        dailySales.set(key, {
          key,
          date: date.toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
          }),
          revenue: 0,
          transactions: 0,
        });
      }

      const day = dailySales.get(key);

      day.revenue += Number(sale.totalAmount) || 0;
      day.transactions += 1;
    });

    return Array.from(dailySales.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-7);
  }, [sales]);

  // Rank products by the quantity sold.
  const topProducts = useMemo(() => {
    const productSales = new Map();

    sales.forEach((sale) => {
      const product = sale.productId;

      const productId =
        product && typeof product === "object"
          ? String(product._id || product.id || product.name)
          : String(product || "");

      const productName =
        product && typeof product === "object"
          ? product.name || "Unknown product"
          : products.find(
              (item) => String(item._id) === productId
            )?.name || "Unknown product";

      if (!productSales.has(productId)) {
        productSales.set(productId, {
          name: productName,
          quantity: 0,
        });
      }

      productSales.get(productId).quantity +=
        Number(sale.quantity) || 0;
    });

    return Array.from(productSales.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [sales, products]);

  // Group current inventory by category.
  const categoryData = useMemo(() => {
    const categories = new Map();

    products.forEach((product) => {
      const category = product.category || "Uncategorized";
      const quantity = Number(product.quantity) || 0;

      categories.set(
        category,
        (categories.get(category) || 0) + quantity
      );
    });

    return Array.from(categories.entries())
      .map(([name, stock]) => ({ name, stock }))
      .filter((category) => category.stock > 0)
      .sort((a, b) => b.stock - a.stock);
  }, [products]);

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

  const totalRevenue = sales.reduce(
    (total, sale) =>
      total + (Number(sale.totalAmount) || 0),
    0
  );

  const statistics = [
    {
      title: "Total Products",
      value: totalProducts.toLocaleString(),
      description: "Products registered",
      accent: "green",
    },
    {
      title: "Total Stock",
      value: totalStock.toLocaleString(),
      description: "Units currently available",
      accent: "blue",
    },
    {
      title: "Low-Stock Products",
      value: lowStockCount.toLocaleString(),
      description: "Products needing attention",
      accent: "orange",
    },
    {
      title: "Total Recorded Revenue",
      value: formatCurrency(totalRevenue),
      description: "Revenue from loaded sales records",
      accent: "purple",
    },
  ];

  return (
    <section className="dashboard-content">
      {/* SUMMARY CARDS */}
      <div className="dashboard-stats">
        {statistics.map((stat) => (
          <article
            className={`dashboard-stat-card ${stat.accent}`}
            key={stat.title}
          >
            <span className="dashboard-stat-label">
              {stat.title}
            </span>

            <h2>{stat.value}</h2>

            <p>{stat.description}</p>
          </article>
        ))}
      </div>

      {/* CHARTS */}
      <div className="dashboard-charts">
        {/* SALES OVERVIEW */}
        <article className="dashboard-chart-card">
          <div className="dashboard-chart-heading">
            <div>
              <h3>Sales Overview</h3>
              <p>Revenue from available sales records</p>
            </div>

            <span className="chart-label">Revenue</span>
          </div>

          <div className="dashboard-chart-area">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{
                    top: 12,
                    right: 12,
                    left: 8,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid
                    stroke="#e8eee9"
                    strokeDasharray="4 4"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#718078", fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "#dfe8e1" }}
                  />

                  <YAxis
                    width={75}
                    tick={{ fill: "#718078", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) =>
                      `₱${Number(value).toLocaleString("en-PH")}`
                    }
                  />

                  <Tooltip
                    formatter={(value) => [
                      formatCurrency(value),
                      "Revenue",
                    ]}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #e1eae3",
                      fontSize: 12,
                    }}
                  />

                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#16734a"
                    strokeWidth={3}
                    dot={{
                      r: 4,
                      fill: "#16734a",
                      strokeWidth: 2,
                      stroke: "#ffffff",
                    }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">
                <span className="chart-empty-icon">↗</span>
                <strong>No sales data yet</strong>
                <p>
                  Record a sale to start tracking daily revenue.
                </p>
              </div>
            )}
          </div>
        </article>

        {/* TOP-SELLING PRODUCTS */}
        <article className="dashboard-chart-card">
          <div className="dashboard-chart-heading">
            <div>
              <h3>Top-Selling Products</h3>
              <p>Products ranked by quantity sold</p>
            </div>

            <span className="chart-label">Units sold</span>
          </div>

          <div className="dashboard-chart-area">
            {topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topProducts}
                  margin={{
                    top: 12,
                    right: 12,
                    left: -10,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid
                    stroke="#e8eee9"
                    strokeDasharray="4 4"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#718078", fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: "#dfe8e1" }}
                    interval={0}
                    tickFormatter={(value) =>
                      value.length > 12
                        ? `${value.slice(0, 12)}…`
                        : value
                    }
                  />

                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: "#718078", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />

                  <Tooltip
                    formatter={(value) => [
                      `${value} units`,
                      "Quantity sold",
                    ]}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #e1eae3",
                      fontSize: 12,
                    }}
                  />

                  <Bar
                    dataKey="quantity"
                    name="Units Sold"
                    fill="#399b70"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={54}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">
                <span className="chart-empty-icon">▥</span>
                <strong>No product sales yet</strong>
                <p>
                  Products will appear here after sales are recorded.
                </p>
              </div>
            )}
          </div>
        </article>

        {/* INVENTORY DISTRIBUTION */}
        <article className="dashboard-chart-card inventory-chart-card">
          <div className="dashboard-chart-heading">
            <div>
              <h3>Inventory Distribution</h3>
              <p>Current stock by product category</p>
            </div>
          </div>

          <div className="dashboard-chart-area">
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="stock"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    labelLine={false}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={COLORS[index % COLORS.length]}
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>

                  <Tooltip
                    formatter={(value) => [
                      `${Number(value).toLocaleString()} units`,
                      "Current stock",
                    ]}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #e1eae3",
                      fontSize: 12,
                    }}
                  />

                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{
                      fontSize: 11,
                      paddingTop: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">
                <span className="chart-empty-icon">◉</span>
                <strong>No inventory data yet</strong>
                <p>
                  Add products with available stock to see the distribution.
                </p>
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

export default Dashboard;