const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

const router = express.Router();

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET must be configured with at least 32 characters."
    );
  }

  return secret;
}

// Verify the token and retrieve the user's CURRENT role from MongoDB.
async function authenticateToken(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Authentication required.",
    });
  }

  const token = authorization.slice(7);

  try {
    const decoded = jwt.verify(token, getJwtSecret());

    if (!decoded.sub || !mongoose.isValidObjectId(decoded.sub)) {
      return res.status(401).json({
        message: "Invalid login token.",
      });
    }

    const user = await User.findById(decoded.sub).select(
      "_id name email role"
    );

    if (!user) {
      return res.status(401).json({
        message: "Account not found.",
      });
    }

    // Never trust an outdated role embedded in the JWT.
    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        message: "Invalid or expired login token.",
      });
    }

    console.error("Authentication error:", error.message);

    return res.status(500).json({
      message: "Unable to verify authentication.",
    });
  }
}

// Allow only specified roles.
function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to perform this action.",
      });
    }

    next();
  };
}

// GET /api/auth/me
router.get("/me", authenticateToken, async (req, res) => {
  res.status(200).json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password");

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign(
      {},
      getJwtSecret(),
      {
        subject: user._id.toString(),
        expiresIn: "2h",
      }
    );

    res.status(200).json({
      message: "Login successful.",
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);

    res.status(500).json({
      message: "Unable to log in at this time.",
    });
  }
});

// POST /api/auth/staff
// Only administrators can create staff accounts.
router.post(
  "/staff",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { name, email, password } = req.body;

      if (
        typeof name !== "string" ||
        typeof email !== "string" ||
        typeof password !== "string" ||
        !name.trim() ||
        !email.trim() ||
        password.length < 12
      ) {
        return res.status(400).json({
          message:
            "Provide a name, email, and password containing at least 12 characters.",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      const existingUser = await User.findOne({
        email: normalizedEmail,
      });

      if (existingUser) {
        return res.status(409).json({
          message: "An account with this email already exists.",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const staff = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: "staff",
      });

      res.status(201).json({
        message: "Staff account created successfully.",
        user: {
          id: staff._id.toString(),
          name: staff.name,
          email: staff.email,
          role: staff.role,
        },
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          message: "An account with this email already exists.",
        });
      }

      console.error("Create staff error:", error.message);

      res.status(500).json({
        message: "Failed to create staff account.",
      });
    }
  }
);

// GET /api/auth/users
// Only administrators can view user accounts.
router.get(
  "/users",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const users = await User.find()
        .select("name email role createdAt")
        .sort({ createdAt: -1 });

      res.status(200).json({
        message: "Users retrieved successfully.",
        users,
      });
    } catch (error) {
      console.error("Retrieve users error:", error.message);

      res.status(500).json({
        message: "Failed to retrieve users.",
      });
    }
  }
);

// PUT /api/auth/users/:id/role
router.put(
  "/users/:id/role",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          message: "Invalid user ID.",
        });
      }

      if (!["admin", "staff"].includes(role)) {
        return res.status(400).json({
          message: "Role must be admin or staff.",
        });
      }

      if (id === req.user.id) {
        return res.status(400).json({
          message: "You cannot change your own role.",
        });
      }

      const targetUser = await User.findById(id);

      if (!targetUser) {
        return res.status(404).json({
          message: "User not found.",
        });
      }

      // Do not allow the last administrator to be demoted.
      if (targetUser.role === "admin" && role === "staff") {
        const adminCount = await User.countDocuments({
          role: "admin",
        });

        if (adminCount <= 1) {
          return res.status(400).json({
            message:
              "You cannot demote the last administrator. Promote another staff member first.",
          });
        }
      }

      targetUser.role = role;
      await targetUser.save();

      res.status(200).json({
        message: "User role updated successfully.",
        user: {
          id: targetUser._id.toString(),
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
        },
      });
    } catch (error) {
      console.error("Update user role error:", error.message);

      res.status(500).json({
        message: "Failed to update user role.",
      });
    }
  }
);

// DELETE /api/auth/users/:id
router.delete(
  "/users/:id",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          message: "Invalid user ID.",
        });
      }

      if (id === req.user.id) {
        return res.status(400).json({
          message: "You cannot delete your own account.",
        });
      }

      const targetUser = await User.findById(id);

      if (!targetUser) {
        return res.status(404).json({
          message: "User not found.",
        });
      }

      // Do not allow the last administrator to be deleted.
      if (targetUser.role === "admin") {
        const adminCount = await User.countDocuments({
          role: "admin",
        });

        if (adminCount <= 1) {
          return res.status(400).json({
            message:
              "You cannot delete the last administrator. Promote another staff member first.",
          });
        }
      }

      await targetUser.deleteOne();

      res.status(200).json({
        message: "User account deleted successfully.",
      });
    } catch (error) {
      console.error("Delete user error:", error.message);

      res.status(500).json({
        message: "Failed to delete user account.",
      });
    }
  }
);

module.exports = {
  router,
  authenticateToken,
  authorizeRoles,
};