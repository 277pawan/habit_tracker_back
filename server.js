import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import cron from "node-cron";
import prisma from "./connection/db.js";
import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-this";

// Middleware
app.use(cors());
app.use(express.json());

// Email Configuration (Nodemailer)
const resend = new Resend(process.env.RESEND_API_KEY);
// const transporter = nodemailer.createTransport({
//   host: process.env.SMTP_HOST || "smtp.gmail.com",
//   port: process.env.SMTP_PORT || 587,
//   secure: false,
//   auth: {
//     user: process.env.SMTP_USER || "your-email@gmail.com",
//     pass: process.env.SMTP_PASS || "your-app-password",
//   },
// });
//
// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
};

// Helper Functions
const generateToken = (user) => {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: "7d",
  });
};

const sendEmail = async (to, subject, html) => {
  try {
    await resend.emails.send({
      from: process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    console.log(`Email sent to ${to}: ${subject}`);
  } catch (error) {
    console.error("Email error:", error);
  }
};

// ============= AUTH ROUTES =============

// Register
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        currentStreak: 0,
        longestStreak: 0,
        boostReceived: 0,
      },
    });

    res.status(201).json({
      message: "User created successfully",
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res
      .status(500)
      .json({ message: "Registration failed", error: error.message });
  }
});

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        primaryIdentity: user.primaryIdentity,
        secondaryIdentity: user.secondaryIdentity,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed", error: error.message });
  }
});

// Get Current User
app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      primaryIdentity: user.primaryIdentity,
      secondaryIdentity: user.secondaryIdentity,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      boostsReceived: user.boostsReceived,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res
      .status(500)
      .json({ message: "Failed to get user", error: error.message });
  }
});

// ============= IDENTITY ROUTES =============

// Get All Identities
app.get("/api/identity", authenticateToken, async (req, res) => {
  try {
    const identities = await prisma.identity.findMany();
    res.json(identities);
  } catch (error) {
    console.error("Get identities error:", error);
    res
      .status(500)
      .json({ message: "Failed to get identities", error: error.message });
  }
});

// Select Identity
app.post("/api/identity/select", authenticateToken, async (req, res) => {
  try {
    const { primaryIdentity, secondaryIdentity } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        primaryIdentity,
        secondaryIdentity: secondaryIdentity || null,
      },
    });

    res.json({ message: "Identity updated", user });
  } catch (error) {
    console.error("Update identity error:", error);
    res
      .status(500)
      .json({ message: "Failed to update identity", error: error.message });
  }
});

// Get User Identity
app.get("/api/identity/user", authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        primaryIdentity: true,
        secondaryIdentity: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Get user identity error:", error);
    res
      .status(500)
      .json({ message: "Failed to get identity", error: error.message });
  }
});

// ============= HABIT ROUTES =============

// Create Habit
app.post("/api/habits", authenticateToken, async (req, res) => {
  try {
    const { name, identity, difficulty, reminderTime, weeklySchedule } =
      req.body;

    const habit = await prisma.habit.create({
      data: {
        userId: req.user.id,
        name,
        identity,
        difficulty,
        reminderTime,
        weeklySchedule,
        streak: 0,
      },
    });

    res.status(201).json(habit);
  } catch (error) {
    console.error("Create habit error:", error);
    res
      .status(500)
      .json({ message: "Failed to create habit", error: error.message });
  }
});

// Get User Habits
app.get("/api/habits", authenticateToken, async (req, res) => {
  try {
    const userHabits = await prisma.habit.findMany({
      where: { userId: req.user.id },
    });

    // Add completion status for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const habitsWithStatus = await Promise.all(
      userHabits.map(async (habit) => {
        const completion = await prisma.completion.findFirst({
          where: {
            habitId: habit.id,
            completedAt: {
              gte: today,
              lt: tomorrow,
            },
          },
        });
        return {
          ...habit,
          completedToday: !!completion,
        };
      }),
    );

    res.json(habitsWithStatus);
  } catch (error) {
    console.error("Get habits error:", error);
    res
      .status(500)
      .json({ message: "Failed to get habits", error: error.message });
  }
});

// Update Habit
app.patch("/api/habits/:id", authenticateToken, async (req, res) => {
  try {
    const habit = await prisma.habit.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    const updatedHabit = await prisma.habit.update({
      where: { id: req.params.id },
      data: req.body,
    });

    res.json(updatedHabit);
  } catch (error) {
    console.error("Update habit error:", error);
    res
      .status(500)
      .json({ message: "Failed to update habit", error: error.message });
  }
});

// Delete Habit
app.delete("/api/habits/:id", authenticateToken, async (req, res) => {
  try {
    const habit = await prisma.habit.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    await prisma.habit.delete({
      where: { id: req.params.id },
    });

    res.json({ message: "Habit deleted" });
  } catch (error) {
    console.error("Delete habit error:", error);
    res
      .status(500)
      .json({ message: "Failed to delete habit", error: error.message });
  }
});

// Complete Habit
app.post("/api/habits/:id/complete", authenticateToken, async (req, res) => {
  try {
    const habit = await prisma.habit.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    // Create completion
    await prisma.completion.create({
      data: {
        habitId: habit.id,
        userId: req.user.id,
      },
    });

    // Update habit streak
    const updatedHabit = await prisma.habit.update({
      where: { id: habit.id },
      data: {
        streak: { increment: 1 },
      },
    });
    const today = new Date();
    const allHabits = await prisma.habit.findMany({
      where: {
        userId: req.user.id,
      },
    });

    const todaysHabits = allHabits.filter(
      (habit) => habit.weeklySchedule[today.getDay()] === true,
    );

    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const habitsWithStatus = await Promise.all(
      todaysHabits.map(async (habit) => {
        const completion = await prisma.completion.findFirst({
          where: {
            habitId: habit.id,
            completedAt: {
              gte: today,
              lt: tomorrow,
            },
          },
        });
        return {
          completedToday: !!completion,
        };
      }),
    );
    const checkHabitStatus = habitsWithStatus.some(
      (data) => data.completedToday === false,
    );

    // Update user streak
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (user && !checkHabitStatus) {
      const newCurrentStreak = user.currentStreak + 1;
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          currentStreak: newCurrentStreak,
          longestStreak:
            newCurrentStreak > user.longestStreak
              ? newCurrentStreak
              : user.longestStreak,
        },
      });
    }

    res.json({ message: "Habit completed", habit: updatedHabit });
  } catch (error) {
    console.error("Complete habit error:", error);
    res
      .status(500)
      .json({ message: "Failed to complete habit", error: error.message });
  }
});

// Uncomplete Habit
app.post("/api/habits/:id/uncomplete", authenticateToken, async (req, res) => {
  try {
    const habit = await prisma.habit.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
      },
    });

    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const completion = await prisma.completion.findFirst({
      where: {
        habitId: habit.id,
        completedAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (completion) {
      await prisma.completion.delete({
        where: { id: completion.id },
      });

      if (habit.streak > 0) {
        await prisma.habit.update({
          where: { id: habit.id },
          data: {
            streak: { decrement: 1 },
          },
        });
      }
    }

    const updatedHabit = await prisma.habit.findUnique({
      where: { id: habit.id },
    });

    // Update user streak
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    const allHabits = await prisma.habit.findMany({
      where: {
        userId: req.user.id,
      },
    });

    const todaysHabits = allHabits.filter(
      (habit) => habit.weeklySchedule[today.getDay()] === true,
    );

    today.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const habitsWithStatus = await Promise.all(
      todaysHabits.map(async (habit) => {
        const completion = await prisma.completion.findFirst({
          where: {
            habitId: habit.id,
            completedAt: {
              gte: today,
              lt: tomorrow,
            },
          },
        });
        return {
          completedToday: !!completion,
        };
      }),
    );
    const checkCount = habitsWithStatus.filter(
      (data) => data.completedToday === true,
    ).length;

    if (user && checkCount === 1) {
      const newCurrentStreak = user.currentStreak - 1;
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          currentStreak: newCurrentStreak,
          longestStreak:
            newCurrentStreak > user.longestStreak
              ? newCurrentStreak
              : user.longestStreak,
        },
      });
    }

    res.json({ message: "Habit uncompleted", habit: updatedHabit });
  } catch (error) {
    console.error("Uncomplete habit error:", error);
    res
      .status(500)
      .json({ message: "Failed to uncomplete habit", error: error.message });
  }
});

// Get Analytics
app.get("/api/habits/analytics", authenticateToken, async (req, res) => {
  try {
    const userHabits = await prisma.habit.findMany({
      where: { userId: req.user.id },
    });

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weeklyCompletions = await prisma.completion.count({
      where: {
        userId: req.user.id,
        completedAt: { gte: weekAgo },
      },
    });

    const totalPossible = userHabits.length * 7;
    const weeklyCompletion =
      totalPossible > 0
        ? Math.round((weeklyCompletions / totalPossible) * 100)
        : 0;

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    const totalCompleted = await prisma.completion.count({
      where: { userId: req.user.id },
    });

    res.json({
      weeklyCompletion,
      currentStreak: user?.currentStreak || 0,
      longestStreak: user?.longestStreak || 0,
      totalCompleted,
      bestDay: "Monday",
      worstDay: "Friday",
    });
  } catch (error) {
    console.error("Get analytics error:", error);
    res
      .status(500)
      .json({ message: "Failed to get analytics", error: error.message });
  }
});

// ============= BOOST ROUTES =============

// Send Boost
app.post("/api/boost/send", authenticateToken, async (req, res) => {
  try {
    const { identityId } = req.body;

    // Find users with this identity (excluding sender)
    const targetUsers = await prisma.user.findMany({
      where: {
        OR: [
          { primaryIdentity: identityId },
          { secondaryIdentity: identityId },
        ],
        NOT: {
          id: req.user.id,
        },
      },
    });

    if (targetUsers.length === 0) {
      return res
        .status(404)
        .json({ message: "No users found with this identity" });
    }

    const randomUser =
      targetUsers[Math.floor(Math.random() * targetUsers.length)];
    console.log(randomUser);

    // Create boost
    await prisma.boost.create({
      data: {
        senderId: req.user.id,
        receiverId: randomUser.id,
        identity: identityId,
      },
    });

    // Update receiver's boost count
    await prisma.user.update({
      where: { id: randomUser.id },
      data: {
        boostReceived: { increment: 1 },
      },
    });

    // Send email notification
    sendEmail(
      randomUser.email,
      "⚡ You received a motivation boost!",
      `<h2>Someone is cheering you on!</h2>
      <p>Another person building their <strong>${identityId}</strong> identity just sent you a boost of energy!</p>
      <p>Keep up the amazing work! 🎉</p>`,
    );

    res.json({ message: "Boost sent!" });
  } catch (error) {
    console.error("Send boost error:", error);
    res
      .status(500)
      .json({ message: "Failed to send boost", error: error.message });
  }
});

// Get My Boosts
app.get("/api/boost/me", authenticateToken, async (req, res) => {
  try {
    const myBoosts = await prisma.boost.findMany({
      where: { receiverId: req.user.id },
      orderBy: { createdAt: "desc" },
    });

    const boostsWithDetails = myBoosts.map((boost) => ({
      ...boost,
      timeAgo: getTimeAgo(boost.createdAt),
    }));

    res.json(boostsWithDetails);
  } catch (error) {
    console.error("Get boosts error:", error);
    res
      .status(500)
      .json({ message: "Failed to get boosts", error: error.message });
  }
});

// ============= REFLECTION ROUTES =============

// Create Reflection
app.post("/api/reflection", authenticateToken, async (req, res) => {
  try {
    const { content, mood } = req.body;

    const reflection = await prisma.reflection.create({
      data: {
        userId: req.user.id,
        content,
        mood,
      },
    });

    res.status(201).json(reflection);
  } catch (error) {
    console.error("Create reflection error:", error);
    res
      .status(500)
      .json({ message: "Failed to create reflection", error: error.message });
  }
});

// Get Reflections
app.get("/api/reflection", authenticateToken, async (req, res) => {
  try {
    const userReflections = await prisma.reflection.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });

    res.json(userReflections);
  } catch (error) {
    console.error("Get reflections error:", error);
    res
      .status(500)
      .json({ message: "Failed to get reflections", error: error.message });
  }
});

// ============= WEEKLY REPORTS =============

app.get("/api/report/weekly", authenticateToken, async (req, res) => {
  try {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const completions = await prisma.completion.count({
      where: {
        userId: req.user.id,
        completedAt: { gte: weekAgo },
      },
    });

    const habits = await prisma.habit.count({
      where: { userId: req.user.id },
    });

    const consistency =
      habits > 0 ? Math.round((completions / (habits * 7)) * 100) : 0;

    res.json({
      summary: `This week you completed ${completions} habits with ${consistency}% consistency. Great job!`,
    });
  } catch (error) {
    console.error("Get weekly report error:", error);
    res
      .status(500)
      .json({ message: "Failed to get report", error: error.message });
  }
});

app.get("/api/report/overview", authenticateToken, async (req, res) => {
  try {
    const totalHabits = await prisma.habit.count({
      where: { userId: req.user.id },
    });

    const totalCompletions = await prisma.completion.count({
      where: { userId: req.user.id },
    });

    res.json({
      totalHabits,
      totalCompletions,
      averagePerDay: (totalCompletions / 30).toFixed(1),
    });
  } catch (error) {
    console.error("Get overview error:", error);
    res
      .status(500)
      .json({ message: "Failed to get overview", error: error.message });
  }
});

// ============= CRON JOBS (EMAIL NOTIFICATIONS) =============

// Send email reminders based on habit schedules
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const currentDay = now.getDay();

    const habits = await prisma.habit.findMany({
      where: {
        reminderTime: currentTime,
      },
      include: {
        user: true,
      },
    });

    for (const habit of habits) {
      const schedule = habit.weeklySchedule;

      // Check if today is scheduled (handle both array and object formats)
      const isScheduledToday = Array.isArray(schedule)
        ? schedule[currentDay]
        : schedule[currentDay];

      if (isScheduledToday && habit.user) {
        sendEmail(
          habit.user.email,
          `⏰ Reminder: ${habit.name}`,
          `<h2>Time for your habit!</h2>
          <p>It's time to work on: <strong>${habit.name}</strong></p>
          <p>Identity: ${habit.identity}</p>
          <p>You've got this! 💪</p>`,
        );
      }
    }
  } catch (error) {
    console.error("Cron job error:", error);
  }
});

// Helper function
function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval > 1 ? "s" : ""} ago`;
    }
  }
  return "just now";
}

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on ${PORT}`);
  console.log(`Email notifications enabled`);
});
