
const express = require("express");
const mongoose = require("mongoose");
const { authenticateToken } = require("./auth");
const {
  Product,
  Sale,
  Conversation,
} = require("../models/aiModels");

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

function getClassmateResponse(question) {
  const q = question
    .toLowerCase()
    .replace(/[?!.,]/g, "")
    .trim();

  const classmates = [
    {
      names: ["stanley", "who is stanley"],
      answer:
        "Stanley is a 3rd-year student who loves EDP. He created me and this website."
    },
    {
      names: ["jhon vergo milca", "jhon milca"],
      answer:
        "Jhon Vergo Milca is known as a hacker. He lives in Mambajao, Maasin City, and he's Stanley's classmate."
    },
    {
      names: ["jhon davis", "john davis"],
      answer:
        "John Davis is an AI assistant of your instructor in EDP. He's also part of Stanley's classmate circle."
    },
    {
      names: ["brylle laroa", "brylle"],
      answer:
        "Brylle Laroa is also known as a web hacker. He lives in Basak, Maasin City, and he's Stanley's classmate."
    },
    {
      names: ["lorence"],
      answer:
        "Lorence is the funny guy in Stanley's classmate circle."
    },
    {
      names: ["aaron loquias", "aaron"],
      answer:
        "Aaron Loquias loves cooking sisig. He's Stanley's classmate."
    },
    {
      names: ["christian lloid", "christian loid", "christian"],
      answer:
        "Christian Lloid lives in Mabini, Macrohon, Southern Leyte. He's Stanley's classmate."
    },
    {
      names: ["edrian"],
      answer:
        "Edrian is described as a hacker, and his boarding house is said to be behind a salon. He's Stanley's classmate."
    },
    {
      names: ["vam"],
      answer:
        "Vam is known for experimenting with network adapters and networking. Vam is Stanley's classmate."
    },
    {
      names: ["jay-ar", "jay ar", "jayar"],
      answer:
        "Jay-ar is a volleyball varsity player and is known as Stanley's 'pre.' He's Stanley's classmate."
    },
    {
      names: ["jevie"],
      answer:
        "Jevie is known among the classmates as a hacker. He's Stanley's classmate."
    },
    {
      names: ["john relap"],
      answer:
        "John Relap is known as the tallest guy in the group. He's Stanley's classmate."
    },
    {
      names: ["yves andre marquiez", "yves andre", "yves"],
      answer:
        "Yves Andre Marquiez is a DOTA player who lives in Mambajao, Maasin City. He's Stanley's classmate."
    },
    {
      names: ["rodel"],
      answer:
        "Rodel is a marathon runner and collects the daily ₱10 contribution. He's Stanley's classmate."
    }
  ];

  for (const person of classmates) {
    const matched = person.names.some((name) => {
      const normalizedName = name.toLowerCase();
      return (
        q === normalizedName ||
        q === `who is ${normalizedName}` ||
        q === `tell me about ${normalizedName}` ||
        q === `do you know ${normalizedName}`
      );
    });

    if (matched) return person.answer;
  }

  return null;
}

function validConversationId(id) {
  return (
    typeof id === "string" &&
    mongoose.isValidObjectId(id)
  );
}

// --------------------------------------------------
// CONVERSATION HISTORY
// --------------------------------------------------

// List the current user's saved conversations.
router.get("/conversations", async (req, res) => {
  try {
    const conversations = await Conversation.find({
      userId: req.user.id,
    })
      .select("title createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({ conversations });
  } catch (error) {
    console.error("Load conversations error:", error.message);
    return res.status(500).json({
      message: "Failed to load conversation history.",
    });
  }
});

// Start a new conversation.
router.post("/conversations", async (req, res) => {
  try {
    const conversation = await Conversation.create({
      userId: req.user.id,
      title: "New conversation",
      messages: [],
    });

    return res.status(201).json({ conversation });
  } catch (error) {
    console.error("Create conversation error:", error.message);
    return res.status(500).json({
      message: "Failed to create a conversation.",
    });
  }
});

// Open a saved conversation.
router.get("/conversations/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!validConversationId(id)) {
      return res.status(400).json({
        message: "Invalid conversation ID.",
      });
    }

    const conversation = await Conversation.findOne({
      _id: id,
      userId: req.user.id,
    }).lean();

    if (!conversation) {
      return res.status(404).json({
        message: "Conversation not found.",
      });
    }

    return res.status(200).json({ conversation });
  } catch (error) {
    console.error("Open conversation error:", error.message);
    return res.status(500).json({
      message: "Failed to open the conversation.",
    });
  }
});

// Delete one of the current user's conversations.
router.delete("/conversations/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!validConversationId(id)) {
      return res.status(400).json({
        message: "Invalid conversation ID.",
      });
    }

    const deleted = await Conversation.findOneAndDelete({
      _id: id,
      userId: req.user.id,
    });

    if (!deleted) {
      return res.status(404).json({
        message: "Conversation not found.",
      });
    }

    return res.status(200).json({
      message: "Conversation deleted successfully.",
    });
  } catch (error) {
    console.error("Delete conversation error:", error.message);
    return res.status(500).json({
      message: "Failed to delete the conversation.",
    });
  }
});

// Save both messages to the conversation.
async function saveConversationMessage(
  userId,
  conversationId,
  question,
  answer
) {
  let conversation;

  if (conversationId) {
    if (!validConversationId(conversationId)) {
      const error = new Error("Invalid conversation ID.");
      error.status = 400;
      throw error;
    }

    conversation = await Conversation.findOne({
      _id: conversationId,
      userId,
    });

    if (!conversation) {
      const error = new Error("Conversation not found.");
      error.status = 404;
      throw error;
    }
  } else {
    conversation = new Conversation({
      userId,
      title: question.slice(0, 80) || "New conversation",
      messages: [],
    });
  }

  if (conversation.messages.length === 0) {
    conversation.title = question.slice(0, 80) || "New conversation";
  }

  conversation.messages.push(
    { role: "user", content: question },
    { role: "assistant", content: answer }
  );

  await conversation.save();

  return conversation._id.toString();
}


 // --------------------------------------------------
 // LIVE INVENTORY INSIGHTS
 // --------------------------------------------------

router.get("/insights", async (req, res) => {
  try {
    if (!req.user || !["admin", "staff"].includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to view inventory insights.",
      });
    }

    const [
      totalProducts,
      lowStockCount,
      outOfStockCount,
      stockTotals,
      lowStockProducts,
      outOfStockProducts,
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
            totalUnits: { $sum: { $ifNull: ["$quantity", 0] } },
          },
        },
      ]),
      Product.find({
        quantity: { $gt: 0, $lte: LOW_STOCK_LIMIT },
      })
        .select("name code category size color quantity")
        .sort({ quantity: 1, name: 1 })
        .limit(100)
        .lean(),
      Product.find({
        quantity: { $lte: 0 },
      })
        .select("name code category size color quantity")
        .sort({ name: 1 })
        .limit(100)
        .lean(),
    ]);

    return res.status(200).json({
      insights: {
        totalProducts,
        totalUnits: stockTotals[0]?.totalUnits || 0,
        lowStockCount,
        outOfStockCount,
        lowStockLimit: LOW_STOCK_LIMIT,
      },
      lowStockProducts,
      outOfStockProducts,
    });
  } catch (error) {
    console.error("Live inventory insights error:", error);

    return res.status(500).json({
      message: "Unable to load inventory insights.",
    });
  }
});

// --------------------------------------------------
// INVENTORY ASSISTANT + CLASSMATE RESPONSES
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

    const conversationId = req.body?.conversationId || null;

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

    // 1. Try a general/classmate response first.
    const classmateAnswer = getClassmateResponse(question);

    if (classmateAnswer) {
      const savedConversationId = await saveConversationMessage(
        req.user.id,
        conversationId,
        question,
        classmateAnswer
      );

      return res.status(200).json({
        message: "Question answered and conversation saved.",
        answer: classmateAnswer,
        products: [],
        intent: "general-conversation",
        conversationId: savedConversationId,
      });
    }

    // 2. If it isn't a classmate question, process inventory requests.
    const intent = getQuestionType(question);

    let answer;
    let products = [];
    let insights;

    if (intent === "help") {
      answer =
        "Hi! I'm ClothStock AI. I can help you check inventory, identify low-stock products, find out-of-stock items, and review stock insights. You can also ask me about Stanley and his classmates.";

    } else if (intent === "insights") {
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
              totalUnits: {
                $sum: { $ifNull: ["$quantity", 0] },
              },
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

      answer =
        `Your inventory currently contains ${totalProducts} product records ` +
        `and ${totalUnits} units in stock. ` +
        `${lowStockCount} product(s) have between 1 and ${LOW_STOCK_LIMIT} items, ` +
        `while ${outOfStockCount} product(s) are out of stock.`;

      if (outOfStockCount > 0) {
        answer += " Prioritize the out-of-stock products for review.";
      } else if (lowStockCount > 0) {
        answer += " Review the low-stock products and consider restocking them.";
      } else {
        answer +=
          " No products currently need attention under the 5-unit stock threshold.";
      }

      products = lowStockProducts;

      insights = {
        totalProducts,
        totalUnits,
        lowStockCount,
        outOfStockCount,
        lowStockLimit: LOW_STOCK_LIMIT,
      };

    } else {
      let filter = {};

      if (intent === "low-stock") {
        filter = {
          quantity: { $gte: 0, $lte: LOW_STOCK_LIMIT },
        };
      } else if (intent === "out-of-stock") {
        filter = {
          quantity: { $lte: 0 },
        };
      } else if (intent === "all-products") {
        filter = {};
      }

      products = await Product.find(filter)
        .select("name code category size color quantity")
        .sort({ quantity: 1, name: 1 })
        .limit(500)
        .lean();

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
    }

    // 3. Save the question and answer to conversation history.
    const savedConversationId = await saveConversationMessage(
      req.user.id,
      conversationId,
      question,
      answer
    );

    return res.status(200).json({
      message: "Question answered and conversation saved.",
      answer,
      products,
      intent,
      conversationId: savedConversationId,

      ...(intent === "low-stock"
        ? { threshold: LOW_STOCK_LIMIT }
        : {}),

      ...(insights ? { insights } : {}),
    });

  } catch (error) {
    if (error.status === 400 || error.status === 404) {
      return res.status(error.status).json({
        message: error.message,
      });
    }

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

    // INVENTORY REPORT
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
          .select("name code category size color quantity costPrice sellingPrice")
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
        lines.push(`No products currently have 1-${LOW_STOCK_LIMIT} units in stock.`);
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

    // SALES REPORT (ADMIN ONLY)
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

        const saleDate =
          sale.soldAt || sale.createdAt
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
