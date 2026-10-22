const bcrypt = require("bcryptjs");
const User = require("./models/User");

async function createAdmin() {
  const name = process.env.ADMIN_NAME;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      "Missing ADMIN_NAME, ADMIN_EMAIL, or ADMIN_PASSWORD in server/.env"
    );
  }

  if (password.length < 12) {
    throw new Error(
      "ADMIN_PASSWORD must contain at least 12 characters."
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existingAdmin = await User.findOne({
    email: normalizedEmail
  });

  if (existingAdmin) {
    if (existingAdmin.role !== "admin") {
      throw new Error(
        "The configured administrator email belongs to a non-admin account."
      );
    }

    console.log("Administrator account already exists.");
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    role: "admin"
  });

  console.log("Initial administrator account created successfully.");
}

module.exports = createAdmin;