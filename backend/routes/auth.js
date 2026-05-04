const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const { v4: uuidv4 } = require("uuid");
const { requireAuth } = require("../middleware/auth");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required in environment variables");
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function sendToken(res, user) {
  const token = jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie("token", token, COOKIE_OPTIONS);
  return token;
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    created_at: user.created_at,
  };
}

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array().map((error) => ({ field: error.param, message: error.msg })) });
  }
  next();
}

module.exports = (pool) => {
  const router = express.Router();

  router.post(
    "/signup",
    [
      body("name").trim().notEmpty().withMessage("Name is required"),
      body("email").isEmail().withMessage("Valid email is required"),
      body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    ],
    handleValidation,
    async (req, res) => {
      const { name, email, password } = req.body;
      try {
        const existingUser = await pool.query("SELECT * FROM users WHERE lower(email) = lower($1)", [email]);
        if (existingUser.rows.length > 0) {
          return res.status(400).json({ message: "Email already in use" });
        }

        const countResult = await pool.query("SELECT COUNT(1) as count FROM users");
        const role = countResult.rows[0].count === 0 ? "admin" : "member";
        const password_hash = bcrypt.hashSync(password, 10);
        const now = new Date().toISOString();
        const user = { id: uuidv4(), name, email, password_hash, role, created_at: now };

        await pool.query(
          `INSERT INTO users (id, name, email, password_hash, role, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [user.id, user.name, user.email, user.password_hash, user.role, user.created_at]
        );
        sendToken(res, user);
        return res.status(201).json({ user: sanitizeUser(user) });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  router.post(
    "/login",
    [
      body("email").isEmail().withMessage("Valid email is required"),
      body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    ],
    handleValidation,
    async (req, res) => {
      const { email, password } = req.body;
      try {
        const result = await pool.query("SELECT * FROM users WHERE lower(email) = lower($1)", [email]);
        const user = result.rows[0];
        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
          return res.status(401).json({ message: "Invalid email or password" });
        }
        sendToken(res, user);
        return res.json({ user: sanitizeUser(user) });
      } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
      }
    }
  );

  router.post("/logout", requireAuth, (req, res) => {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });
    return res.json({ message: "Logged out" });
  });

  router.get("/me", requireAuth, async (req, res) => {
    try {
      const result = await pool.query("SELECT id, name, email, role, created_at FROM users WHERE id = $1", [req.user.id]);
      const user = result.rows[0];
      if (!user) {
        return res.status(401).json({ message: "Invalid user" });
      }
      return res.json({ user: sanitizeUser(user) });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  return router;
};
