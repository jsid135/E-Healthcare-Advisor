import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, "data", "store.json");

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-this-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "2h";
const DEFAULT_ARTICLE_CATEGORIES = [
  { id: "general", name: "General Medicine" },
  { id: "cardiology", name: "Cardiology" },
  { id: "dermatology", name: "Dermatology" },
  { id: "gastroenterology", name: "Gastroenterology" },
  { id: "neurology", name: "Neurology" },
  { id: "orthopedics", name: "Orthopedics" },
  { id: "pediatrics", name: "Pediatrics" },
  { id: "nutrition", name: "Nutrition" }
];

app.use(cors());
app.use(express.json());

function readStore() {
  if (!existsSync(DATA_PATH)) {
    const empty = {
      users: [],
      specializations: [],
      doctors: [],
      appointments: [],
      articles: [],
      chats: []
    };
    writeStore(empty);
    return empty;
  }

  const store = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
  let updated = false;

  if (Array.isArray(store.users)) {
    store.users = store.users.map((user) => {
      if (user.passwordHash) return user;
      if (user.password) {
        updated = true;
        const passwordHash = bcrypt.hashSync(String(user.password), 10);
        const migratedUser = { ...user, passwordHash };
        delete migratedUser.password;
        return migratedUser;
      }
      return user;
    });
  }

  if (!Array.isArray(store.articleCategories) || !store.articleCategories.length) {
    store.articleCategories = [...DEFAULT_ARTICLE_CATEGORIES];
    updated = true;
  }

  if (Array.isArray(store.articles)) {
    store.articles = store.articles.map((article) => {
      if (article.category) return article;
      updated = true;
      return { ...article, category: "general" };
    });
  }

  if (updated) {
    writeStore(store);
  }

  return store;
}

function writeStore(data) {
  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function publicUser(user) {
  const { password, passwordHash, ...safeUser } = user;
  return safeUser;
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return res.status(401).json({ message: "Authorization token missing." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.sub;
    const store = readStore();
    const user = store.users.find((u) => u.id === userId);
    if (!user) {
      return res.status(401).json({ message: "User not found for token." });
    }

    req.user = user;
    req.token = token;
    return next();
  } catch (_error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "ehealthcare-backend" });
});

app.post("/api/auth/register", (req, res) => {
  const { firstName, lastName, dob, place, email, username, password } = req.body;
  if (!firstName || !lastName || !dob || !place || !email || !username || !password) {
    return res.status(400).json({ message: "All registration fields are required." });
  }

  const store = readStore();
  const exists = store.users.some(
    (u) => u.username.toLowerCase() === String(username).toLowerCase() || u.email.toLowerCase() === String(email).toLowerCase()
  );

  if (exists) {
    return res.status(409).json({ message: "Username or email already exists." });
  }

  const user = {
    id: randomUUID(),
    firstName,
    lastName,
    dob,
    place,
    email,
    username,
    passwordHash: bcrypt.hashSync(String(password), 10)
  };

  store.users.push(user);
  writeStore(store);

  return res.status(201).json({ message: "Registration successful.", user: publicUser(user) });
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  const store = readStore();
  const user = store.users.find(
    (u) => u.username.toLowerCase() === String(username).toLowerCase()
  );

  if (!user || !user.passwordHash || !bcrypt.compareSync(String(password), user.passwordHash)) {
    return res.status(401).json({ message: "Invalid username or password." });
  }

  const token = jwt.sign({ sub: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });

  return res.json({
    message: "Login successful.",
    token,
    expiresIn: JWT_EXPIRES_IN,
    user: publicUser(user)
  });
});

app.get("/api/auth/me", authRequired, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post("/api/auth/logout", authRequired, (req, res) => {
  res.json({ message: "Logged out. Remove token on client side." });
});

app.get("/api/specializations", (_req, res) => {
  const store = readStore();
  res.json({ specializations: store.specializations });
});

app.get("/api/doctors", (req, res) => {
  const { specialization } = req.query;
  const store = readStore();
  const doctors = specialization
    ? store.doctors.filter((doc) => doc.specialization === specialization)
    : store.doctors;
  res.json({ doctors });
});

app.post("/api/appointments", authRequired, (req, res) => {
  const { name, date, place, specialization, doctor } = req.body;
  if (!name || !date || !place || !specialization || !doctor) {
    return res.status(400).json({ message: "All appointment fields are required." });
  }

  const store = readStore();
  const appointment = {
    id: randomUUID(),
    userId: req.user.id,
    name,
    date,
    place,
    specialization,
    doctor,
    createdAt: new Date().toISOString()
  };

  store.appointments.push(appointment);
  writeStore(store);

  res.status(201).json({ message: "Appointment request submitted.", appointment });
});

app.get("/api/appointments/me", authRequired, (req, res) => {
  const store = readStore();
  const appointments = store.appointments.filter((a) => a.userId === req.user.id);
  res.json({ appointments });
});

app.get("/api/articles", (_req, res) => {
  const { category } = _req.query;
  const store = readStore();
  let articles = [...store.articles];
  if (category && category !== "all") {
    articles = articles.filter((item) => item.category === category);
  }
  const sorted = articles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ articles: sorted });
});

app.get("/api/article-categories", (_req, res) => {
  const store = readStore();
  res.json({ categories: store.articleCategories || DEFAULT_ARTICLE_CATEGORIES });
});

app.post("/api/articles", authRequired, (req, res) => {
  const { title, content, category } = req.body;
  if (!title || !content || !category) {
    return res.status(400).json({ message: "Title, content, and category are required." });
  }

  const store = readStore();
  const validCategory = (store.articleCategories || DEFAULT_ARTICLE_CATEGORIES).some(
    (item) => item.id === category
  );
  if (!validCategory) {
    return res.status(400).json({ message: "Invalid article category." });
  }

  const article = {
    id: randomUUID(),
    title,
    content,
    category,
    authorId: req.user.id,
    author: `${req.user.firstName} ${req.user.lastName}`,
    createdAt: new Date().toISOString()
  };

  store.articles.push(article);
  writeStore(store);

  res.status(201).json({ message: "Article created.", article });
});

app.post("/api/chat", authRequired, (req, res) => {
  const { message } = req.body;
  if (!message || !String(message).trim()) {
    return res.status(400).json({ message: "Message is required." });
  }

  const text = String(message).toLowerCase();
  let response = "I can help with appointments, specializations, and preventive care tips.";

  if (text.includes("appointment")) {
    response = "You can book from the Appointments page. Choose specialization, doctor, and date, then submit.";
  } else if (text.includes("specialization") || text.includes("doctor")) {
    response = "For chest pain choose cardiology, for skin concerns choose dermatology, and for general symptoms choose general medicine.";
  } else if (text.includes("diet") || text.includes("food")) {
    response = "Aim for balanced meals with protein, vegetables, hydration, and limited processed sugar.";
  }

  const store = readStore();
  store.chats.push({
    id: randomUUID(),
    userId: req.user.id,
    message,
    response,
    createdAt: new Date().toISOString()
  });
  writeStore(store);

  res.json({ reply: response });
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
