
const express = require("express");
const { authenticateToken } = require("./auth");
const { Product, Sale } = require("../models/aiModels");

const router = express.Router();
const LOW_STOCK_LIMIT = 5;

router.use(authenticateToken);

function getQuestionType(question) {
  const q = question.toLowerCase();

  if (
    q.includes("insight") ||
    q.includes("summary") ||
    q.includes("overview") ||
    q.includes("stock status") ||
    q.includes("inventory status") ||
    q.includes("inventory report") ||
    q.includes("restock report") ||
    q.includes("how is my inventory") ||
    q.includes("how many products") ||
    q.includes("total stock") ||
    q.includes("stock analysis")
  ) {
    return "insights";
  }

  if (
    q.includes("out of stock") ||
    q.includes("out-of-stock") ||
    q.includes("zero stock") ||
    q.includes("no stock")
  ) {
    return "out-of-stock";
  }

  if (
    q.includes("low stock") ||
    q.includes("low-stock") ||
    q.includes("running low") ||
    q.includes("restock") ||
    q.includes("reorder") ||
    q.includes("5 or fewer") ||
    q.includes("5 or less") ||
    q.includes("five or fewer") ||
    q.includes("five or less") ||
    q.includes("low quantity") ||
    q.includes("stock levels")
  ) {
    return "low-stock";
  }

  if (
    q.includes("all products") ||
    q.includes("list products") ||
    q.includes("show products") ||
    q.includes("inventory list") ||
    q.includes("all inventory")
  ) {
    return "all-products";
  }

  return "help";
}

function formatPHP(value) {
  return `PHP ${(Number(value) || 0).toFixed(2)}`;
}

// --------------------------------------------------
// INVENTORY ASSISTANT
// --------------------------------------------------

router.post("/chat", async (req, res) => {
  try {
    if (!req.user || !["admin", "staff"].includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to use ClothStock AI.",
      });
    }

    const question =
      typeof req.body?.question === "string"
        ? req.body.question.trim()
        : "";

    if (!question) {
      return res.status(400).json({
        message: "Please enter a question.",
      });
    }

    if (question.length > 1000) {
      return res.status(400).json({
        message: "Your question must be 1000 characters or fewer.",
      });
    }

    const intent = getQuestionType(question);

    if (intent === "help") {
      return res.status(200).json({
        message: "Question received.",
        answer:
          "I can check low-stock products, out-of-stock items, and inventory insights. Try asking: 'Which products have 5 or fewer items in stock?', 'Which products are out of stock?', or 'Show my inventory insights.'",
        products: [],
        intent: "help",
      });
    }

    if (intent === "insights") {
      const [
        totalProducts,
        lowStockCount,
        outOfStockCount,
        stockTotals,
        lowStockProducts,
      ] = await Promise.all([
        Product.countDocuments({}),

        Product.countDocuments({
          quantity: { $gt: 0, $lte: LOW_STOCK_LIMIT },
        }),

        Product.countDocuments({
          quantity: { $lte: 0 },
        }),

        Product.aggregate([
          {
            $group: {
              _id: null,
              totalUnits: { $sum: "$quantity" },
            },
          },
        ]),

        Product.find({
          quantity: { $lte: LOW_STOCK_LIMIT },
        })
          .select("name code category size color quantity")
          .sort({ quantity: 1, name: 1 })
          .limit(500)
          .lean(),
      ]);

      const totalUnits = stockTotals[0]?.totalUnits || 0;

      let answer =
        `Your inventory currently contains ${totalProducts} product records ` +
        `and ${totalUnits} units in stock. ` +
        `${lowStockCount} product(s) have between 1 and ${LOW_STOCK_LIMIT} items, ` +
        `while ${outOfStockCount} product(s) are out of stock.`;

      if (outOfStockCount > 0) {
        answer += " Prioritize the out-of-stock products for review.";
      } else if (lowStockCount > 0) {
        answer +=
          " Review the low-stock products and consider restocking them.";
      } else {
        answer +=
          " No products currently need attention under the 5-unit stock threshold.";
      }

      return res.status(200).json({
        message: "Inventory insights generated successfully.",
        answer,
        intent,
        products: lowStockProducts,
        insights: {
          totalProducts,
          totalUnits,
          lowStockCount,
          outOfStockCount,
          lowStockLimit: LOW_STOCK_LIMIT,
        },
      });
    }

    let filter = {};

    if (intent === "low-stock") {
      filter = {
        quantity: { $gte: 0, $lte: LOW_STOCK_LIMIT },
      };
    } else if (intent === "out-of-stock") {
      filter = {
        quantity: { $lte: 0 },
      };
    }

    const products = await Product.find(filter)
      .select("name code category size color quantity")
      .sort({ quantity: 1, name: 1 })
      .limit(500)
      .lean();

    let answer;

    if (intent === "low-stock") {
      answer =
        products.length === 0
          ? `No products currently have ${LOW_STOCK_LIMIT} or fewer items in stock.`
          : `Found ${products.length} product(s) with ${LOW_STOCK_LIMIT} or fewer items in stock. Review these products for possible restocking.`;
    } else if (intent === "out-of-stock") {
      answer =
        products.length === 0
          ? "Good news! There are no out-of-stock products in your inventory."
          : `Found ${products.length} out-of-stock product(s). Consider prioritizing these items for restocking.`;
    } else {
      const totalProducts = await Product.countDocuments({});

      answer =
        `Showing ${products.length} product record(s) from your inventory. ` +
        `Your database contains ${totalProducts} product record(s) in total.`;
    }

    return res.status(200).json({
      message: "Inventory checked successfully.",
      answer,
      products,
      intent,
      ...(intent === "low-stock"
        ? { threshold: LOW_STOCK_LIMIT }
        : {}),
    });
  } catch (error) {
    console.error("ClothStock AI error:", error);

    return res.status(500).json({
      message: "Unable to check inventory right now. Please try again.",
    });
  }
});

// --------------------------------------------------
// PDF REPORT GENERATOR
// --------------------------------------------------

router.post("/report", async (req, res) => {
  try {
    if (!req.user || !["admin", "staff"].includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to generate reports.",
      });
    }

    const reportType =
      typeof req.body?.reportType === "string"
        ? req.body.reportType
        : "inventory";

    if (!["inventory", "sales"].includes(reportType)) {
      return res.status(400).json({
        message: "Choose either an inventory report or a sales report.",
      });
    }

    // Sales reports are administrator-only.
    if (reportType === "sales" && req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only administrators can generate sales reports.",
      });
    }

    const generatedAt = new Date();

    const lines = [
      "CLOTHSTOCK REPORT",
      "=================",
      `Report type: ${
        reportType === "sales" ? "Sales Summary" : "Inventory Summary"
      }`,
      `Generated: ${generatedAt.toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
      })}`,
      "",
    ];

    // ----------------------------------------------
    // INVENTORY REPORT
    // ----------------------------------------------

    if (reportType === "inventory") {
      const [
        totalProducts,
        lowStockProducts,
        outOfStockProducts,
        stockSummary,
        allProducts,
      ] = await Promise.all([
        Product.countDocuments({}),

        Product.find({
          quantity: { $gt: 0, $lte: LOW_STOCK_LIMIT },
        })
          .select("name code category size color quantity costPrice sellingPrice")
          .sort({ quantity: 1, name: 1 })
          .lean(),

        Product.find({
          quantity: { $lte: 0 },
        })
          .select("name code category size color quantity costPrice sellingPrice")
          .sort({ name: 1 })
          .lean(),

        Product.aggregate([
          {
            $group: {
              _id: null,
              totalUnits: { $sum: { $ifNull: ["$quantity", 0] } },
              costValue: {
                $sum: {
                  $multiply: [
                    { $ifNull: ["$quantity", 0] },
                    { $ifNull: ["$costPrice", 0] },
                  ],
                },
              },
              sellingValue: {
                $sum: {
                  $multiply: [
                    { $ifNull: ["$quantity", 0] },
                    { $ifNull: ["$sellingPrice", 0] },
                  ],
                },
              },
            },
          },
        ]),

        Product.find({})
          .select(
            "name code category size color quantity costPrice sellingPrice"
          )
          .sort({ name: 1 })
          .lean(),
      ]);

      const summary = stockSummary[0] || {
        totalUnits: 0,
        costValue: 0,
        sellingValue: 0,
      };

      lines.push(
        `Total product records: ${totalProducts}`,
        `Total units in stock: ${summary.totalUnits || 0}`,
        `Low-stock products (1-${LOW_STOCK_LIMIT} units): ${lowStockProducts.length}`,
        `Out-of-stock products: ${outOfStockProducts.length}`,
        `Estimated inventory cost value: ${formatPHP(summary.costValue)}`,
        `Potential selling value: ${formatPHP(summary.sellingValue)}`,
        "",
        "ALL INVENTORY PRODUCTS",
        "-----------------------"
      );

      if (allProducts.length === 0) {
        lines.push("No inventory products found.");
      } else {
        allProducts.forEach((product) => {
          lines.push(
            `${product.name || "Unnamed product"} | ` +
              `Code: ${product.code || "N/A"} | ` +
              `Category: ${product.category || "N/A"} | ` +
              `Size: ${product.size || "N/A"} | ` +
              `Color: ${product.color || "N/A"} | ` +
              `Quantity: ${product.quantity ?? 0} | ` +
              `Cost: ${formatPHP(product.costPrice)} | ` +
              `Selling: ${formatPHP(product.sellingPrice)}`
          );
        });
      }

      lines.push("", "LOW-STOCK PRODUCTS", "------------------");

      if (lowStockProducts.length === 0) {
        lines.push("No products currently have 1-5 units in stock.");
      } else {
        lowStockProducts.forEach((product) => {
          lines.push(
            `${product.name || "Unnamed product"} | ` +
              `Code: ${product.code || "N/A"} | ` +
              `Category: ${product.category || "N/A"} | ` +
              `Quantity: ${product.quantity ?? 0}`
          );
        });
      }

      lines.push("", "OUT-OF-STOCK PRODUCTS", "---------------------");

      if (outOfStockProducts.length === 0) {
        lines.push("No out-of-stock products found.");
      } else {
        outOfStockProducts.forEach((product) => {
          lines.push(
            `${product.name || "Unnamed product"} | ` +
              `Code: ${product.code || "N/A"} | ` +
              `Category: ${product.category || "N/A"} | ` +
              `Quantity: ${product.quantity ?? 0}`
          );
        });
      }

      const report = {
        reportType,
        generatedAt: generatedAt.toISOString(),

        summary: {
          totalProducts,
          totalUnits: summary.totalUnits || 0,
          lowStockCount: lowStockProducts.length,
          outOfStockCount: outOfStockProducts.length,
          costValue: summary.costValue || 0,
          sellingValue: summary.sellingValue || 0,
        },

        // These structured fields are used by the PDF generator.
        products: allProducts,
        lowStockProducts,
        outOfStockProducts,

        text: lines.join("\n"),
      };

      return res.status(200).json({
        message: "Inventory report generated successfully.",
        report,
      });
    }

    // ----------------------------------------------
    // SALES REPORT (ADMIN ONLY)
    // ----------------------------------------------

    const sales = await Sale.find({})
      .sort({ soldAt: -1, createdAt: -1 })
      .limit(5000)
      .populate("productId", "name code")
      .lean();

    const totalTransactions = sales.length;

    const totalUnitsSold = sales.reduce(
      (total, sale) => total + (Number(sale.quantity) || 0),
      0
    );

    const totalSales = sales.reduce(
      (total, sale) => total + (Number(sale.totalAmount) || 0),
      0
    );

    lines.push(
      `Transactions included: ${totalTransactions}`,
      `Units sold: ${totalUnitsSold}`,
      `Total recorded sales: ${formatPHP(totalSales)}`,
      "",
      "RECENT SALES",
      "------------"
    );

    if (sales.length === 0) {
      lines.push("No sales records found.");
    } else {
      sales.slice(0, 100).forEach((sale) => {
        const productName =
          sale.productId?.name || "Product unavailable";
        const productCode = sale.productId?.code || "N/A";

        const saleDate = sale.soldAt || sale.createdAt
          ? new Date(sale.soldAt || sale.createdAt).toLocaleDateString(
              "en-PH",
              { timeZone: "Asia/Manila" }
            )
          : "Date unavailable";

        lines.push(
          `${saleDate} | ${productName} (${productCode}) | ` +
            `Quantity: ${sale.quantity || 0} | ` +
            `Unit price: ${formatPHP(sale.unitPrice)} | ` +
            `Total: ${formatPHP(sale.totalAmount)}`
        );
      });

      if (sales.length > 100) {
        lines.push(
          "",
          "Showing the latest 100 transactions in the detail list."
        );
      }
    }

    return res.status(200).json({
      message: "Sales report generated successfully.",

      report: {
        reportType,
        generatedAt: generatedAt.toISOString(),

        summary: {
          totalTransactions,
          totalUnitsSold,
          totalSales,
        },

        // Includes transaction data for the PDF table.
        sales,

        text: lines.join("\n"),
      },
    });
  } catch (error) {
    console.error("ClothStock report error:", error);

    return res.status(500).json({
      message: "Unable to generate the report right now.",
    });
  }
});

module.exports = router;
