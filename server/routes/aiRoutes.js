
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const { authenticateToken } = require("./auth");
const {
  Product,
  Sale,
  Conversation,
} = require("../models/aiModels");

router.use(authenticateToken);

/* ==========================================
   CLOTHSTOCK AI MEMORY — MANAGE PEOPLE
========================================== */

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({
      message: "Only administrators can manage AI Memory.",
    });
  }

  next();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/ai/people?search=Stanley
router.get("/people", requireAdmin, async (req, res) => {
  try {
    const search = String(req.query.search || "").trim().slice(0, 100);

    const filter = search
      ? {
          $or: [
            { name: { $regex: escapeRegex(search), $options: "i" } },
            { description: { $regex: escapeRegex(search), $options: "i" } },
            { aliases: { $regex: escapeRegex(search), $options: "i" } },
          ],
        }
      : {};

    const people = await PersonKnowledge.find(filter)
      .sort({ name: 1 })
      .lean();

    res.json({ people });
  } catch (error) {
    console.error("AI Memory list error:", error);
    res.status(500).json({
      message: "Unable to load saved people.",
    });
  }
});

// POST /api/ai/people
router.post("/people", requireAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const description = String(req.body?.description || "").trim();

    const aliases = Array.isArray(req.body?.aliases)
      ? req.body.aliases
          .map((item) => String(item).trim())
          .filter(Boolean)
          .slice(0, 20)
      : String(req.body?.aliases || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 20);

    if (!name || name.length > 100) {
      return res.status(400).json({
        message: "Name is required and must be under 100 characters.",
      });
    }

    if (!description || description.length > 2000) {
      return res.status(400).json({
        message: "Description is required and must be under 2,000 characters.",
      });
    }

    const normalizedName = name.toLowerCase();

    const existing = await PersonKnowledge.findOne({ normalizedName });

    if (existing) {
      return res.status(409).json({
        message: "This person already exists. Edit the existing entry instead.",
      });
    }

    const person = await PersonKnowledge.create({
      name,
      normalizedName,
      description,
      aliases,
    });

    res.status(201).json({ person });
  } catch (error) {
    console.error("AI Memory create error:", error);

    res.status(500).json({
      message: "Unable to save this person.",
    });
  }
});

// PUT /api/ai/people/:id
router.put("/people/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid person ID.",
      });
    }

    const person = await PersonKnowledge.findById(id);

    if (!person) {
      return res.status(404).json({
        message: "Person not found.",
      });
    }

    const name = String(req.body?.name ?? person.name).trim();
    const description = String(
      req.body?.description ?? person.description
    ).trim();

    const aliases = Array.isArray(req.body?.aliases)
      ? req.body.aliases
          .map((item) => String(item).trim())
          .filter(Boolean)
          .slice(0, 20)
      : String(req.body?.aliases ?? person.aliases.join(", "))
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 20);

    if (
      !name ||
      name.length > 100 ||
      !description ||
      description.length > 2000
    ) {
      return res.status(400).json({
        message: "Enter a name and description within the allowed lengths.",
      });
    }

    const normalizedName = name.toLowerCase();

    const duplicate = await PersonKnowledge.findOne({
      normalizedName,
      _id: { $ne: person._id },
    });

    if (duplicate) {
      return res.status(409).json({
        message: "Another saved person already uses that name.",
      });
    }

    person.name = name;
    person.normalizedName = normalizedName;
    person.description = description;
    person.aliases = aliases;

    await person.save();

    res.json({ person });
  } catch (error) {
    console.error("AI Memory update error:", error);

    res.status(500).json({
      message: "Unable to update this person.",
    });
  }
});

// DELETE /api/ai/people/:id
router.delete("/people/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid person ID.",
      });
    }

    const person = await PersonKnowledge.findByIdAndDelete(id);

    if (!person) {
      return res.status(404).json({
        message: "Person not found.",
      });
    }

    res.json({
      message: `${person.name} was removed from AI Memory.`,
    });
  } catch (error) {
    console.error("AI Memory delete error:", error);

    res.status(500).json({
      message: "Unable to delete this person.",
    });
  }
});

const LOW_STOCK_LIMIT = 5;
const MAX_PRODUCTS = 500;
const MAX_SALES = 5000;


/* =========================
   CLOTHSTOCK AI - PERSONAL KNOWLEDGE
========================= */

const PERSONAL_KNOWLEDGE = {
  stanley: {
    name: "Stanley",
    description:
      "Stanley is a 3rd-year student who loves programming. He created ClothStock AI and this website by himself."
  },

  lorence: {
    name: "Lorence",
    description:
      "Lorence is the funny guy in the room."
  },

  jevie: {
    name: "Jevie",
    description:
      "Jevie is known as the hacker of motors."
  },

  brylle: {
    name: "Brylle",
    description:
      "Brylle is Stanley's classmate. He's also known as a web hacker."
  },

  loid: {
    name: "Loid",
    description:
      "Loid is also known as a web and network hacker."
  },

  vam: {
    name: "Vam",
    description:
      "Vam is known as a network hacker."
  },

  rodel: {
    name: "Rodel",
    description:
      "Rodel is a marathon runner who collects 10 bucks per day."
  },

  "yar-ar": {
    name: "Jay-Ar (Yar-Ar)",
    description:
      "Jay-Ar, also called Yar-Ar, is a varsity player and Stanley's classmate."
  },

  edgar: {
    name: "Edgar (Bernard)",
    description:
      "Edgar, also known as Bernard, is a dancer of ITRIX."
  },

  rai: {
    name: "Rai",
    description:
      "Rai is known as the rockstar in the room."
  },

  "john davis": {
    name: "John Davis",
    description:
      "John Davis is an AI assistant of your instructor in EDP."
  },

  edrian: {
    name: "Edrian",
    description:
      "Edrian is known as the glass man in the room."
  },

  jualo: {
    name: "Jualo",
    description:
      "Jualo is the tallest guy in the room."
  }
};

function identifyPerson(question) {
  const q = question
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Match names only when the user is asking who someone is.
  const asksWho =
    /\b(who is|who's|who are|tell me about|introduce)\b/.test(q);

  if (!asksWho) return null;

  const aliases = {
    "john davis": ["john davis"],
    "yar-ar": ["yar-ar", "jay-ar", "jay ar"],
    stanley: ["stanley"],
    lorence: ["lorence"],
    jevie: ["jevie"],
    brylle: ["brylle"],
    loid: ["loid"],
    vam: ["vam"],
    rodel: ["rodel"],
    edgar: ["edgar", "bernard"],
    rai: ["rai"],
    edrian: ["edrian"],
    jualo: ["jualo"]
  };

  for (const [key, names] of Object.entries(aliases)) {
    for (const name of names) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`\\b${escaped}\\b`, "i");

      if (pattern.test(q)) {
        return PERSONAL_KNOWLEDGE[key];
      }
    }
  }

  return null;
}


const money = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const number = (value) =>
  Number(value || 0).toLocaleString("en-PH");

const safeNum = (value) =>
  Number.isFinite(Number(value)) ? Number(value) : 0;

const isPrivileged = (req, res) => {
  if (!["admin", "staff"].includes(req.user?.role)) {
    res.status(403).json({ message: "Access denied." });
    return false;
  }

  return true;
};

const validId = (id) =>
  mongoose.Types.ObjectId.isValid(id);

/* =====================================================
   NATURAL LANGUAGE QUESTION CLASSIFICATION
===================================================== */

function classify(question) {
  const q = String(question || "")
    .toLowerCase()
    .replace(/[?!.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (
    /^(hi|hello|hey|hiya|good morning|good afternoon|good evening|greetings|howdy|kumusta)$/.test(q)
  ) {
    return "greeting";
  }

  if (
    /\b(thank you|thanks|thank u|thx)\b/.test(q)
  ) {
    return "thanks";
  }

  if (
    /\b(what can you do|what do you do|help me|help|your capabilities|how can you help)\b/.test(q)
  ) {
    return "help";
  }

  // Sales rankings must be detected before generic inventory questions.
  if (
    /\b(top|best|highest|most|largest|greatest|number one|number 1)\b/.test(q) &&
    /\b(sell|selling|seller|sold|sales|sale|revenue|earning|earner|profitable|performing|popular)\b/.test(q)
  ) {
    if (
      /\b(profit|profitable|margin|earnings after cost)\b/.test(q)
    ) {
      return "top-profit";
    }

    if (
      /\b(unit|units|quantity|quantities|volume|most sold|best seller|best selling|top selling)\b/.test(q)
    ) {
      return "top-units";
    }

    return "top-revenue";
  }

  if (
    /\b(best seller|bestseller|best selling|best-selling|top selling|top-selling|most sold|fastest selling|popular products|product ranking)\b/.test(q)
  ) {
    return "top-units";
  }

  if (
    /\b(low stock|running low|need restocking|needs restocking|need to restock|reorder|restock|below minimum|almost out)\b/.test(q)
  ) {
    return "low-stock";
  }

  if (
    /\b(out of stock|zero stock|no stock|stockout|stock outs|unavailable products|sold out)\b/.test(q)
  ) {
    return "out-stock";
  }

  if (
    /\b(gross profit|net profit|profit margin|profitability|profit|profitable)\b/.test(q)
  ) {
    return "profit";
  }

  if (
    /\b(inventory|stock|products?)\b/.test(q) &&
    /\b(worth|value|valuation|valued|cost value|selling value)\b/.test(q)
  ) {
    return "inventory-value";
  }

  if (
    /\b(how many|number of|count of|count|total number)\b/.test(q) &&
    /\b(products?|items?|product records?)\b/.test(q)
  ) {
    return "product-count";
  }

  if (
    /\b(show|list|display|view|find|search|all|every|which|what are|give me)\b/.test(q) &&
    /\b(products?|items?)\b/.test(q) &&
    !/\b(sold|sales|selling|seller|revenue|profit)\b/.test(q)
  ) {
    return /\b(table|tabular|spreadsheet)\b/.test(q)
      ? "inventory-table"
      : "product-list";
  }

  if (
    /\b(table|tabular|spreadsheet)\b/.test(q) &&
    /\b(inventory|stock|products?)\b/.test(q)
  ) {
    return "inventory-table";
  }

  if (
    /\b(sales summary|sales overview|sales report|revenue|total sales|sales performance|transactions|units sold|sales today|sales this month|sales this week)\b/.test(q)
  ) {
    return "sales";
  }

  if (
    /\b(inventory summary|summarize inventory|summarise inventory|inventory overview|inventory insights|stock overview|inventory report|dashboard|overall inventory)\b/.test(q)
  ) {
    return "inventory-summary";
  }

  if (
    /\b(inventory|stock|products|overview|summary|insights|report|total value)\b/.test(q)
  ) {
    return "inventory-summary";
  }

  return "help";
}

/* =====================================================
   DATABASE HELPERS
===================================================== */

async function getProducts() {
  return Product.find({})
    .select(
      "name code category size color quantity costPrice sellingPrice createdAt updatedAt"
    )
    .sort({ name: 1 })
    .limit(MAX_PRODUCTS)
    .lean();
}

async function getSales() {
  return Sale.find({})
    .populate("productId", "name code category costPrice sellingPrice")
    .sort({ soldAt: -1, createdAt: -1 })
    .limit(MAX_SALES)
    .lean();
}

function calculateInventory(products) {
  const totalUnits = products.reduce(
    (sum, p) => sum + safeNum(p.quantity),
    0
  );

  const lowStock = products.filter(
    (p) =>
      safeNum(p.quantity) > 0 &&
      safeNum(p.quantity) <= LOW_STOCK_LIMIT
  );

  const outOfStock = products.filter(
    (p) => safeNum(p.quantity) <= 0
  );

  const costValue = products.reduce(
    (sum, p) =>
      sum + safeNum(p.quantity) * safeNum(p.costPrice),
    0
  );

  const sellingValue = products.reduce(
    (sum, p) =>
      sum + safeNum(p.quantity) * safeNum(p.sellingPrice),
    0
  );

  return {
    totalProducts: products.length,
    totalUnits,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    inventoryCostValue: costValue,
    inventorySellingValue: sellingValue,
    lowStockLimit: LOW_STOCK_LIMIT,
  };
}

function calculateSales(sales) {
  const totalRevenue = sales.reduce(
    (sum, s) => sum + safeNum(s.totalAmount),
    0
  );

  const totalUnitsSold = sales.reduce(
    (sum, s) => sum + safeNum(s.quantity),
    0
  );

  const ranking = new Map();

  for (const sale of sales) {
    const product = sale.productId;
    const productId =
      product && typeof product === "object"
        ? String(product._id)
        : String(product || "unknown");

    const current = ranking.get(productId) || {
      productId,
      name:
        product && typeof product === "object"
          ? product.name || "Unknown product"
          : "Unknown product",
      code:
        product && typeof product === "object"
          ? product.code || "—"
          : "—",
      units: 0,
      revenue: 0,
      transactions: 0,
    };

    current.units += safeNum(sale.quantity);
    current.revenue += safeNum(sale.totalAmount);
    current.transactions += 1;

    ranking.set(productId, current);
  }

  const rankedProducts = [...ranking.values()];

  return {
    totalTransactions: sales.length,
    totalRevenue,
    totalUnitsSold,
    rankedProducts,
  };
}

async function getConversation(req, requestedId) {
  const userId = req.user.id || req.user._id;

  if (requestedId && validId(requestedId)) {
    const existing = await Conversation.findOne({
      _id: requestedId,
      userId,
    });

    if (existing) return existing;
  }

  return Conversation.create({
    userId,
    title: "New conversation",
    messages: [],
  });
}

async function saveTurn(conversation, question, answer, results) {
  conversation.messages.push(
    { role: "user", content: question },
    {
      role: "assistant",
      content: answer,
      results,
    }
  );

  if (conversation.title === "New conversation") {
    conversation.title = question.slice(0, 80);
  }

  await conversation.save();
}

/* =====================================================
   CONVERSATION HISTORY
===================================================== */

router.get("/conversations", async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const conversations = await Conversation.find({ userId })
      .select("title updatedAt createdAt messages")
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    res.json({
      conversations: conversations.map((c) => ({
        _id: c._id,
        title: c.title,
        updatedAt: c.updatedAt,
        createdAt: c.createdAt,
        messageCount: c.messages?.length || 0,
      })),
    });
  } catch (error) {
    console.error("Conversation list error:", error);
    res.status(500).json({
      message: "I couldn't load your conversations. Please try again.",
    });
  }
});

router.post("/conversations", async (req, res) => {
  try {
    const conversation = await Conversation.create({
      userId: req.user.id || req.user._id,
      title: "New conversation",
      messages: [],
    });

    res.status(201).json({ conversation });
  } catch (error) {
    console.error("Create conversation error:", error);
    res.status(500).json({
      message: "I couldn't create a new conversation.",
    });
  }
});

router.get("/conversations/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: "That conversation ID is invalid.",
      });
    }

    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user.id || req.user._id,
    }).lean();

    if (!conversation) {
      return res.status(404).json({
        message: "I couldn't find that conversation.",
      });
    }

    res.json({ conversation });
  } catch (error) {
    console.error("Open conversation error:", error);
    res.status(500).json({
      message: "I couldn't open that conversation.",
    });
  }
});

router.delete("/conversations/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: "That conversation ID is invalid.",
      });
    }

    const deleted = await Conversation.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id || req.user._id,
    });

    if (!deleted) {
      return res.status(404).json({
        message: "I couldn't find that conversation.",
      });
    }

    res.json({ message: "Conversation deleted successfully." });
  } catch (error) {
    console.error("Delete conversation error:", error);
    res.status(500).json({
      message: "I couldn't delete that conversation.",
    });
  }
});

/* =====================================================
   LIVE INVENTORY INSIGHTS
===================================================== */

router.get("/insights", async (req, res) => {
  try {
    if (!isPrivileged(req, res)) return;

    const products = await getProducts();
    const insights = calculateInventory(products);

    res.json({ insights });
  } catch (error) {
    console.error("Inventory insights error:", error);
    res.status(500).json({
      message: "I couldn't calculate your inventory insights.",
    });
  }
});

/* =====================================================
   CLOTHSTOCK AI CHAT
===================================================== */

router.post("/chat", async (req, res) => {
  try {
    if (!isPrivileged(req, res)) return;

    const question = String(req.body?.question || "").trim();

    if (!question) {
      return res.status(400).json({
        message: "Please enter a question so I can help.",
      });
    }

    if (question.length > 1000) {
      return res.status(400).json({
        message: "Please keep your question under 1,000 characters.",
      });
    }

    
const person = identifyPerson(question);

const intent = person ? "personal-knowledge" : classify(question);
const results = {};
let answer = "";

if (person) {
  answer = `Here's what I know about ${person.name}:

${person.description}

Want to ask about someone else?`;
}


    if (intent === "greeting") {
      answer =
        "Hello! 👋 Welcome to ClothStock AI. I'm here to help you understand your inventory, check stock levels, discover your best-selling products, and analyze your sales. What would you like to explore today?";

    } else if (intent === "thanks") {
      answer =
        "You're very welcome! 😊 I'm happy to help with your ClothStock inventory. Would you like to explore your sales performance or check which products need restocking?";

    } else if (person) {
  // Personal knowledge response is already prepared above.
}    else if (intent === "help") {
      answer =
        "Of course! 😊 I can analyze the records in your ClothStock database. Try asking me:\n\n" +
        "• Which product has the highest sales?\n" +
        "• Which products sell the most units?\n" +
        "• What is my total sales revenue?\n" +
        "• Which products are running low?\n" +
        "• What is my inventory worth?\n" +
        "• What is my estimated gross profit?\n\n" +
        "I'll calculate the available figures from your saved records and explain the results.";

    } else {
      const needsProducts = [
        "product-count",
        "inventory-value",
        "product-list",
        "inventory-table",
        "inventory-summary",
        "low-stock",
        "out-stock",
        "profit",
        "top-profit",
      ].includes(intent);

      const needsSales = [
        "sales",
        "top-units",
        "top-revenue",
        "top-profit",
        "profit",
      ].includes(intent);

      const products = needsProducts ? await getProducts() : [];
      const sales = needsSales ? await getSales() : [];

      const inventory = calculateInventory(products);
      const salesSummary = calculateSales(sales);

      if (intent === "product-count") {
        results.insights = {
          totalProducts: inventory.totalProducts,
        };

        answer =
          `Absolutely! 😊 You currently have ${number(inventory.totalProducts)} product records in your inventory.`;
      }

      else if (intent === "inventory-value") {
        const asksCost =
          /\b(cost|purchase|at cost|investment)\b/i.test(question);

        const asksSelling =
          /\b(selling|retail|potential sales|if all sold)\b/i.test(question);

        if (asksCost && !asksSelling) {
          results.insights = {
            inventoryCostValue: inventory.inventoryCostValue,
          };

          answer =
            `Here's your inventory cost valuation. 📦 The current stock represents ${money(inventory.inventoryCostValue)} in recorded product cost. This is calculated from each product's available quantity multiplied by its recorded cost price.`;
        } else if (asksSelling && !asksCost) {
          results.insights = {
            inventorySellingValue: inventory.inventorySellingValue,
          };

          answer =
            `Here's the potential selling value of your current stock. 💰 If all available units sold at their recorded selling prices, the total would be ${money(inventory.inventorySellingValue)} before expenses, discounts, and other adjustments.`;
        } else {
          results.insights = {
            inventoryCostValue: inventory.inventoryCostValue,
            inventorySellingValue: inventory.inventorySellingValue,
          };

          answer =
            `Here's your inventory valuation. 📊\n\n` +
            `• Recorded stock cost: ${money(inventory.inventoryCostValue)}\n` +
            `• Potential selling value: ${money(inventory.inventorySellingValue)}\n\n` +
            `The potential selling value isn't profit; it represents expected sales before expenses and other adjustments.`;
        }
      }

      else if (
        intent === "product-list" ||
        intent === "inventory-table"
      ) {
        results.products = products;
        results.display =
          intent === "inventory-table" ? "table" : "products";

        answer = products.length
          ? `Here you go! 😊 I found ${number(products.length)} product records in the inventory data retrieved for this report. You can review the product details below.`
          : "I checked the retrieved inventory records, but there are no products to display.";
      }

      else if (
        intent === "low-stock" ||
        intent === "out-stock"
      ) {
        const chosen =
          intent === "low-stock"
            ? products.filter(
                (p) =>
                  safeNum(p.quantity) > 0 &&
                  safeNum(p.quantity) <= LOW_STOCK_LIMIT
              )
            : products.filter(
                (p) => safeNum(p.quantity) <= 0
              );

        results.products = chosen;
        results.display = "products";

        answer = chosen.length
          ? intent === "low-stock"
            ? `I found ${number(chosen.length)} product(s) that may need your attention. ⚠️ These items have between 1 and ${LOW_STOCK_LIMIT} units remaining. Consider reviewing the product cards below and planning your next restock.`
            : `Good news: I've identified ${number(chosen.length)} product(s) with no available stock. These items may need replenishment before you can fulfill new orders.`
          : intent === "low-stock"
            ? `Good news! 🎉 I couldn't find any products within the low-stock range of 1–${LOW_STOCK_LIMIT} units in the retrieved inventory records.`
            : "Great news! 🎉 No out-of-stock products were found in the retrieved inventory records.";
      }

      else if (intent === "inventory-summary") {
        results.insights = inventory;

        answer =
          `Here's your inventory snapshot! 📊\n\n` +
          `• Products: ${number(inventory.totalProducts)}\n` +
          `• Units on hand: ${number(inventory.totalUnits)}\n` +
          `• Low-stock products: ${number(inventory.lowStockCount)}\n` +
          `• Out-of-stock products: ${number(inventory.outOfStockCount)}\n` +
          `• Stock cost value: ${money(inventory.inventoryCostValue)}\n` +
          `• Potential selling value: ${money(inventory.inventorySellingValue)}\n\n` +
          (inventory.lowStockCount > 0 || inventory.outOfStockCount > 0
            ? "Recommendation: review the stock alerts and prioritize products that need replenishment."
            : "Your retrieved stock records show no low-stock or out-of-stock items.");
      }

      else if (
        intent === "top-units" ||
        intent === "top-revenue" ||
        intent === "top-profit"
      ) {
        const costById = new Map(
          products.map((p) => [
            String(p._id),
            safeNum(p.costPrice),
          ])
        );

        const ranked = salesSummary.rankedProducts.map((p) => {
          const cost = costById.get(String(p.productId));

          return {
            ...p,
            estimatedProfit:
              cost === undefined
                ? null
                : p.revenue - p.units * cost,
          };
        });

        if (intent === "top-units") {
          ranked.sort((a, b) => b.units - a.units);
        } else if (intent === "top-profit") {
          ranked.sort(
            (a, b) =>
              (b.estimatedProfit ?? -Infinity) -
              (a.estimatedProfit ?? -Infinity)
          );
        } else {
          ranked.sort((a, b) => b.revenue - a.revenue);
        }

        const top = ranked.slice(0, 10);

        results.table = top;
        results.display = "top-products";

        if (!top.length) {
          answer =
            "I'd be happy to find your leading products, but I couldn't find any recorded sales in the retrieved sales records yet. Once sales are recorded against products, I can rank them for you.";
        } else {
          const winner = top[0];

          if (intent === "top-units") {
            answer =
              `I checked your recorded sales! 🏆 Your top-selling product is **${winner.name}**` +
              `${winner.code && winner.code !== "—" ? ` (code: ${winner.code})` : ""}, ` +
              `with ${number(winner.units)} unit(s) sold across ${number(winner.transactions)} transaction(s).\n\n` +
              `Its recorded sales revenue is ${money(winner.revenue)}. I've ranked the leading products below by units sold.`;
          } else if (intent === "top-profit") {
            if (winner.estimatedProfit === null) {
              answer =
                `I found recorded sales for ${number(top.length)} product(s), but I couldn't reliably rank gross profit because some products no longer have a matching cost price in the retrieved inventory. I can still compare their recorded revenue and units sold.`;
            } else {
              answer =
                `I analyzed your recorded sales alongside the current product cost prices. 📈 The highest estimated gross-profit product is **${winner.name}**, with an estimated gross profit of ${money(winner.estimatedProfit)}.\n\n` +
                `This estimate uses current costs, not historical costs at the time of sale. I've listed the leading products below.`;
            }
          } else {
            answer =
              `I checked your recorded sales! 🏆 The product with the highest recorded sales revenue is **${winner.name}**` +
              `${winner.code && winner.code !== "—" ? ` (code: ${winner.code})` : ""}.\n\n` +
              `• Recorded revenue: ${money(winner.revenue)}\n` +
              `• Units sold: ${number(winner.units)}\n` +
              `• Transactions: ${number(winner.transactions)}\n\n` +
              `I've ranked the leading products below by revenue. Note that revenue is not the same as profit.`;
          }
        }
      }

      else if (intent === "profit") {
        const costById = new Map(
          products.map((p) => [
            String(p._id),
            safeNum(p.costPrice),
          ])
        );

        let estimatedProfit = 0;
        let unknownCostSales = 0;

        for (const sale of sales) {
          const productId = String(
            sale.productId?._id || sale.productId || ""
          );

          if (!costById.has(productId)) {
            unknownCostSales++;
            continue;
          }

          estimatedProfit +=
            safeNum(sale.totalAmount) -
            safeNum(sale.quantity) * costById.get(productId);
        }

        results.insights = {
          estimatedGrossProfit: estimatedProfit,
          totalRevenue: salesSummary.totalRevenue,
          totalTransactions: salesSummary.totalTransactions,
          unitsSold: salesSummary.totalUnitsSold,
          uncostedTransactions: unknownCostSales,
          note:
            "Estimate uses current product cost prices. Historical costs and operating expenses are not included.",
        };

        answer =
          `Here's your estimated gross-profit analysis. 📈\n\n` +
          `• Recorded revenue: ${money(salesSummary.totalRevenue)}\n` +
          `• Estimated gross profit: ${money(estimatedProfit)}\n` +
          `• Retrieved transactions: ${number(salesSummary.totalTransactions)}\n` +
          `• Units sold: ${number(salesSummary.totalUnitsSold)}\n\n` +
          `Please note: this estimate uses current product cost prices and excludes operating expenses. ` +
          (unknownCostSales
            ? `${number(unknownCostSales)} transaction(s) couldn't be matched to a current product cost and were excluded from the profit calculation.`
            : "Historical cost changes may affect the accuracy of the estimate.");
      }

      else {
        results.insights = {
          totalTransactions: salesSummary.totalTransactions,
          unitsSold: salesSummary.totalUnitsSold,
          totalRevenue: salesSummary.totalRevenue,
        };

        answer =
          `Here's your sales overview! 💰\n\n` +
          `• Retrieved transactions: ${number(salesSummary.totalTransactions)}\n` +
          `• Units sold: ${number(salesSummary.totalUnitsSold)}\n` +
          `• Recorded revenue: ${money(salesSummary.totalRevenue)}\n\n` +
          `These figures are calculated from the latest ${number(MAX_SALES)} sales records retrieved, or fewer if your database contains fewer records.`;
      }
    }

    // Persist the actual answer and structured analysis for conversation history.
    const conversation = await getConversation(
      req,
      req.body?.conversationId
    );

    await saveTurn(
      conversation,
      question,
      answer,
      results
    );

    // Return only data relevant to the current request.
    res.json({
      answer,
      intent,
      conversationId: conversation._id,
      ...(results.products ? { products: results.products } : {}),
      ...(results.insights ? { insights: results.insights } : {}),
      ...(results.table ? { table: results.table } : {}),
      ...(results.display ? { display: results.display } : {}),
    });
  } catch (error) {
    console.error("ClothStock AI analysis error:", error);

    res.status(500).json({
      message:
        "I'm sorry, I couldn't finish analyzing your records just now. Please try again.",
    });
  }
});

/* =====================================================
   PDF REPORT DATA
===================================================== */

router.post("/report", async (req, res) => {
  try {
    if (!isPrivileged(req, res)) return;

    const reportType = req.body?.reportType;

    if (!["inventory", "sales"].includes(reportType)) {
      return res.status(400).json({
        message: "Please choose an inventory or sales report.",
      });
    }

    if (reportType === "sales" && req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only administrators can generate sales reports.",
      });
    }

    const products = await getProducts();

    if (reportType === "inventory") {
      const insights = calculateInventory(products);

      const lowStockProducts = products.filter(
        (p) =>
          safeNum(p.quantity) > 0 &&
          safeNum(p.quantity) <= LOW_STOCK_LIMIT
      );

      const outOfStockProducts = products.filter(
        (p) => safeNum(p.quantity) <= 0
      );

      return res.json({
        report: {
          generatedAt: new Date(),
          summary: insights,
          lowStockProducts,
          outOfStockProducts,
          products,
        },
      });
    }

    const sales = await getSales();
    const summary = calculateSales(sales);

    return res.json({
      report: {
        generatedAt: new Date(),
        summary: {
          totalTransactions: summary.totalTransactions,
          totalQuantity: summary.totalUnitsSold,
          totalSales: summary.totalRevenue,
        },
        sales,
      },
    });
  } catch (error) {
    console.error("ClothStock report error:", error);

    res.status(500).json({
      message: "I couldn't generate that report. Please try again.",
    });
  }
});

module.exports = router;
