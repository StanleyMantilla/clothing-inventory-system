
// const express = require("express");
// const mongoose = require("mongoose");
// const router = express.Router();


const express = require("express");
const mongoose = require("mongoose");
const OpenAI = require("openai");
const router = express.Router();

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  maxRetries: 0,
});


// const { authenticateToken } = require("./auth");
// const {
//   Product,
//   Sale,
//   Conversation,
// } = require("../models/aiModels");

const { authenticateToken } = require("./auth");

const aiModels = require("../models/aiModels");

const {
  Product,
  Sale,
  Conversation,
} = aiModels;

// AI Memory model
const PersonKnowledge =
  aiModels.PersonKnowledge ||
  mongoose.models.PersonKnowledge ||
  mongoose.model(
    "PersonKnowledge",
    new mongoose.Schema(
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        normalizedName: {
          type: String,
          required: true,
          unique: true,
        },
        description: {
          type: String,
          required: true,
        },
        aliases: {
          type: [String],
          default: [],
        },
      },
      { timestamps: true }
    )
  );

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


  
  // Specific product stock questions
  // Example: How many SVUP-Jersey are in stock?
  // Example: What is the stock of SVUP-002?

  
  // Specific product stock questions
  // Example: How many SVUP-Jersey are in stock?
  // Example: What is the stock of SVUP-002?

  const asksStock =
    /\b(stock|stocks|quantity|available|on hand|remaining|left|units|pieces|pcs)\b/i.test(q);

  const asksSpecificQuantity =
    /\b(how many|how much|what is|whats|what's|tell me|check|show me|give me|quantity of|stock of|available quantity of)\b/i.test(q);

  const asksGeneralInventory =
    /\b(inventory summary|inventory overview|inventory report|stock overview|overall inventory|total stock|total inventory)\b/i.test(q);

  if (
    asksStock &&
    asksSpecificQuantity &&
    !asksGeneralInventory
  ) {
    return "product-stock";
  }

  // Direct stock question, but avoid broad inventory questions.
  if (
    /\b(stock|quantity|available|on hand|remaining|left)\b/i.test(q) &&
    !asksGeneralInventory &&
    !/\b(products?|items?)\s+(in total|overall)\b/i.test(q)
  ) {
    return "product-stock";
  }


  if (
    /\b(how many|how much|what is|whats|what's|tell me|check|show me|give me|quantity of|stock of|available quantity of)\b/i.test(q) &&
    /\b(stock|stocks|in stock|quantity|quantities|available|on hand|remaining|left|units|pieces|pcs)\b/i.test(q)
  ) {
    return "product-stock";
  }

  // Direct product stock questions
  if (
    /\b(stock|quantity|available|on hand|remaining|left)\b/i.test(q) &&
    !/\b(inventory summary|inventory overview|inventory report|stock overview|overall inventory)\b/i.test(q)
  ) {
    return "product-stock";
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
  // Always use a table when the user requests all products.
  const asksAllProducts =
    /\b(all|every)\s+(products?|items?)\b/.test(q) ||
    /\b(products?|items?)\s+(all|every)\b/.test(q);

  return (
    asksAllProducts ||
    /\b(table|tabular|spreadsheet)\b/.test(q)
  )
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

// async function getProducts() {
//   return Product.find({})
//     .select(
//       "name code category size color quantity costPrice sellingPrice createdAt updatedAt"
//     )
//     .sort({ name: 1 })
//     .limit(MAX_PRODUCTS)
//     .lean();
// }


async function getProducts() {
  const products = await Product.find({})
    .select(
      "name code category size color quantity costPrice sellingPrice createdAt updatedAt"
    )
    .sort({ name: 1 })
    .limit(MAX_PRODUCTS)
    .lean();

  // Temporary diagnostic: verify the actual database values.
  console.log(
    "Retrieved product quantities:",
    products.map((p) => ({
      name: p.name,
      code: p.code,
      quantity: p.quantity,
      quantityType: typeof p.quantity,
    }))
  );

  return products;
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
  let conversation;

  try {
    const question = String(req.body?.message || req.body?.question || "").trim();

    if (!question) {
      return res.status(400).json({
        message: "Please enter a message.",
      });
    }

    if (question.length > 5000) {
      return res.status(400).json({
        message: "Your message is too long. Maximum is 5,000 characters.",
      });
    }

    conversation = await getConversation(
      req,
      req.body?.conversationId
    );

    const person = identifyPerson(question);

    const previousProduct = [...(conversation.messages || [])]
      .reverse()
      .find(
        (message) =>
          message.role === "assistant" &&
          message.results?.products?.length
      )?.results?.products?.[0];

    const isFollowUp =
      /\b(what about|how about|is that|are those|does it|do they|its stock|their stock|that enough|enough stock|tell me more|and that|and this)\b/i.test(question) ||
      /^(and|also)\s+/i.test(question.trim());

    const intent = person
      ? "personal-knowledge"
      : isFollowUp && previousProduct
        ? "product-stock"
        : classify(question);

    const results = {};
    let answer = "";

    // 1. PERSONAL KNOWLEDGE
    if (person) {
      answer = `${person.name}: ${person.description}`;
      results.person = person;
    }

    // 2. GREETING
    else if (intent === "greeting") {
      answer =
        "Hello! I'm ClothStock AI. I can help you check inventory, product stock, sales, profits, and inventory reports.";
    }

    // 3. THANKS
    else if (intent === "thanks") {
      answer = "You're welcome! I'm here to help with ClothStock.";
    }

    // 4. HELP
    else if (intent === "help") {
      answer =
        "I can help you with:\n" +
        "- Inventory summary\n" +
        "- Product stock and quantities\n" +
        "- Low-stock and out-of-stock products\n" +
        "- Product lists\n" +
        "- Sales summary\n" +
        "- Best-selling products\n" +
        "- Gross profit estimates\n\n" +
        "Try asking: How many products are in stock?";
    }

    // Inventory and product questions require staff/admin.
    else if (
      [
        "product-stock",
        "product-count",
        "product-list",
        "inventory-table",
        "inventory-summary",
        "inventory-value",
        "low-stock",
        "out-stock",
        "profit",
        "top-profit",
        "top-units",
        "top-revenue",
        "sales",
      ].includes(intent)
    ) {
      if (!isPrivileged(req, res)) return;

      const products = await getProducts();

      const inventory = calculateInventory(products);

      results.inventory = inventory;

      // 5. PRODUCT STOCK
      if (intent === "product-stock") {
        let product = null;

        // Follow-up question: use the previous product.
        if (isFollowUp && previousProduct) {
          product = products.find(
            (p) =>
              String(p._id) === String(previousProduct._id)
          );
        }

        // Match by product code or product name.
        if (!product) {
          const q = question.toLowerCase();

          product = products.find((p) => {
            const code = String(p.code || "").toLowerCase();
            return code && q.includes(code);
          });
        }

        if (!product) {
          const q = question.toLowerCase();

          const matches = products
            .filter((p) => {
              const name = String(p.name || "").toLowerCase();
              return name && q.includes(name);
            })
            .sort(
              (a, b) =>
                String(b.name).length -
                String(a.name).length
            );

          product = matches[0] || null;
        }

        if (!product) {
          answer =
            "I couldn't identify that product. Please provide its exact product name or product code.";
        } else {
          results.products = [product];

          answer =
            `Product: ${product.name}\n` +
            `Code: ${product.code || "—"}\n` +
            `Category: ${product.category || "—"}\n` +
            `Size: ${product.size || "—"}\n` +
            `Color: ${product.color || "—"}\n` +
            `Available stock: ${number(product.quantity)} units\n` +
            `Stock status: ${
              safeNum(product.quantity) <= 0
                ? "Out of stock"
                : safeNum(product.quantity) <= LOW_STOCK_LIMIT
                  ? "Low stock"
                  : "In stock"
            }`;
        }
      }

      // 6. PRODUCT COUNT
      else if (intent === "product-count") {
        answer =
          `There are ${number(products.length)} product records ` +
          `and ${number(inventory.totalUnits)} total units in inventory.`;
      }

      // 7. PRODUCT LIST / INVENTORY TABLE
      
        
      // 7. PRODUCT LIST / INVENTORY TABLE
      else if (
  intent === "product-list" ||
  intent === "inventory-table"
) {
  results.products = products;

  const columns = [
    "Product Name",
    "Code",
    "Category",
    "Size",
    "Color",
    "Quantity",
    "Cost Price",
    "Selling Price",
  ];

  const rows = products.map((p) => [
    p.name || "—",
    p.code || "—",
    p.category || "—",
    p.size || "—",
    p.color || "—",
    safeNum(p.quantity),
    safeNum(p.costPrice),
    safeNum(p.sellingPrice),
  ]);

  // Keep structured table data for the frontend.
  results.table = {
    columns,
    rows,
  };

  // Clean values for readable Markdown.
  const cleanCell = (value) =>
    String(value ?? "—")
      .replace(/\r?\n/g, " ")
      .replace(/\|/g, "\\|")
      .trim() || "—";

  const formatPrice = (value) =>
    money(safeNum(value));

  const tableHeader =
    "| " + columns.join(" | ") + " |";

  const tableDivider =
    "| " + columns.map(() => "---").join(" | ") + " |";

  const tableRows = products.map((p) => {
    const values = [
      cleanCell(p.name),
      cleanCell(p.code),
      cleanCell(p.category),
      cleanCell(p.size),
      cleanCell(p.color),
      number(safeNum(p.quantity)),
      formatPrice(p.costPrice),
      formatPrice(p.sellingPrice),
    ];

    return "| " + values.join(" | ") + " |";
  });

  answer =
    `## Complete Product Inventory\n\n` +
    `**Total products:** ${number(products.length)}  \n` +
    `**Total units:** ${number(inventory.totalUnits)}  \n` +
    `**Low-stock products:** ${number(inventory.lowStockCount)}  \n` +
    `**Out-of-stock products:** ${number(inventory.outOfStockCount)}\n\n` +
    (
      products.length > 0
        ? [
            tableHeader,
            tableDivider,
            ...tableRows,
          ].join("\n")
        : "No products found."
    );
}



      // 8. LOW STOCK
      else if (intent === "low-stock") {
        const lowStockProducts = products.filter(
          (p) =>
            safeNum(p.quantity) > 0 &&
            safeNum(p.quantity) <= LOW_STOCK_LIMIT
        );

        results.products = lowStockProducts;

        answer = lowStockProducts.length
          ? `Found ${lowStockProducts.length} low-stock products:\n` +
            lowStockProducts
              .map(
                (p) =>
                  `- ${p.name} (${p.code || "—"}): ${number(p.quantity)} units`
              )
              .join("\n")
          : "There are no low-stock products right now.";
      }

      // 9. OUT OF STOCK
      else if (intent === "out-stock") {
        const outOfStockProducts = products.filter(
          (p) => safeNum(p.quantity) <= 0
        );

        results.products = outOfStockProducts;

        answer = outOfStockProducts.length
          ? `Found ${outOfStockProducts.length} out-of-stock products:\n` +
            outOfStockProducts
              .map(
                (p) =>
                  `- ${p.name} (${p.code || "—"})`
              )
              .join("\n")
          : "Great! There are no out-of-stock products.";
      }

      // 10. INVENTORY VALUE
      else if (intent === "inventory-value") {
        answer =
          `Inventory cost value: ${money(inventory.inventoryCostValue)}\n` +
          `Potential selling value: ${money(inventory.inventorySellingValue)}\n` +
          `Estimated potential gross profit: ${money(
            inventory.inventorySellingValue -
              inventory.inventoryCostValue
          )}`;

        results.inventoryValue = {
          costValue: inventory.inventoryCostValue,
          sellingValue: inventory.inventorySellingValue,
          estimatedGrossProfit:
            inventory.inventorySellingValue -
            inventory.inventoryCostValue,
        };
      }

      // 11. INVENTORY SUMMARY
      else if (intent === "inventory-summary") {
        answer =
          `Inventory Summary\n\n` +
          `Total products: ${number(inventory.totalProducts)}\n` +
          `Total units: ${number(inventory.totalUnits)}\n` +
          `Low-stock products: ${number(inventory.lowStockCount)}\n` +
          `Out-of-stock products: ${number(inventory.outOfStockCount)}\n` +
          `Inventory cost value: ${money(inventory.inventoryCostValue)}\n` +
          `Potential selling value: ${money(inventory.inventorySellingValue)}`;
      }

      // 12. SALES / PROFIT / PRODUCT RANKINGS
      else {
        const sales = await getSales();
        const summary = calculateSales(sales);

        results.salesSummary = summary;

        // Exclude transactions with missing product references
        // when calculating product-level cost estimates.
        const validSales = sales.filter(
          (s) =>
            s.productId &&
            typeof s.productId === "object"
        );

        const grossProfit = validSales.reduce(
          (sum, sale) => {
            const qty = safeNum(sale.quantity);
            const revenue = safeNum(sale.totalAmount);
            const cost = safeNum(sale.productId.costPrice);

            return sum + (revenue - cost * qty);
          },
          0
        );

        if (
          intent === "top-units" ||
          intent === "top-revenue" ||
          intent === "top-profit"
        ) {
          const ranking = new Map();

          for (const sale of validSales) {
            const product = sale.productId;
            const id = String(product._id);

            const item = ranking.get(id) || {
              productId: id,
              name: product.name || "Unknown",
              code: product.code || "—",
              units: 0,
              revenue: 0,
              estimatedProfit: 0,
            };

            const qty = safeNum(sale.quantity);
            const revenue = safeNum(sale.totalAmount);
            const cost = safeNum(product.costPrice);

            item.units += qty;
            item.revenue += revenue;
            item.estimatedProfit += revenue - cost * qty;

            ranking.set(id, item);
          }

          const ranked = [...ranking.values()];

          ranked.sort((a, b) => {
            if (intent === "top-units") {
              return b.units - a.units;
            }

            if (intent === "top-profit") {
              return b.estimatedProfit - a.estimatedProfit;
            }

            return b.revenue - a.revenue;
          });

          const topProducts = ranked.slice(0, 10);

          results.products = topProducts;

          answer = topProducts.length
            ? "Top products:\n" +
              topProducts
                .map((p, index) => {
                  let metric;

                  if (intent === "top-units") {
                    metric = `${number(p.units)} units sold`;
                  } else if (intent === "top-profit") {
                    metric = `${money(p.estimatedProfit)} estimated profit`;
                  } else {
                    metric = `${money(p.revenue)} revenue`;
                  }

                  return `${index + 1}. ${p.name} (${p.code}) — ${metric}`;
                })
                .join("\n")
            : "There is no product sales data available yet.";
        }

        // PROFIT
        else if (intent === "profit") {
          answer =
            `Recorded transactions: ${number(summary.totalTransactions)}\n` +
            `Units sold: ${number(summary.totalUnitsSold)}\n` +
            `Total sales: ${money(summary.totalRevenue)}\n` +
            `Estimated gross profit: ${money(grossProfit)}\n\n` +
            "Note: This is an estimate based on current product cost prices and recorded sales. Historical cost changes, discounts, refunds, and other expenses may affect actual profit.";

          results.profit = {
            estimatedGrossProfit: grossProfit,
            totalRevenue: summary.totalRevenue,
          };
        }

        // SALES SUMMARY
        else {
          answer =
            `Sales Summary\n\n` +
            `Total transactions: ${number(summary.totalTransactions)}\n` +
            `Units sold: ${number(summary.totalUnitsSold)}\n` +
            `Total sales: ${money(summary.totalRevenue)}\n` +
            `Estimated gross profit: ${money(grossProfit)}`;
        }
      }
    }

    // 13. FALLBACK AI
    else {
      if (!process.env.OPENROUTER_API_KEY) {
        answer =
          "I can help with ClothStock inventory and sales questions. Please try asking about your stock, products, or sales.";
      } else {
        const history = (conversation.messages || [])
          .slice(-10)
          .map((m) => ({
            role: m.role,
            content: String(m.content || "").slice(0, 4000),
          }))
          .filter((m) =>
            ["user", "assistant"].includes(m.role)
          );

        const completion = await openrouter.chat.completions.create({
          model:
            process.env.OPENROUTER_MODEL ||
            "openai/gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are ClothStock AI, a helpful clothing inventory assistant. Be friendly, concise, and honest. Do not invent inventory, sales, product, or user information. For live database questions, ask the user to use a supported inventory or sales query.",
            },
            ...history,
            {
              role: "user",
              content: question,
            },
          ],
        });

        answer =
          completion.choices?.[0]?.message?.content ||
          "I couldn't generate a response. Please try again.";
      }
    }

    console.log("AI TABLE DEBUG:", {
      tableColumns: results.table?.columns,
      tableRows: results.table?.rows,
      productCount: results.products?.length,
    });

    await saveTurn(
      conversation,
      question,
      answer,
      results
    );

    return res.json({
      answer,
      conversationId: conversation._id,
      results,
    });
  } catch (error) {
    console.error("ClothStock AI chat error:", error);

    return res.status(500).json({
      message: "I couldn't process your message. Please try again.",
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
