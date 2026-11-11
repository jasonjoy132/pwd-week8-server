import express, { type Express } from "express";
import cors from "cors";
import restaurantsRouter from "./routes/restaurants.routes";
import submissionsRouter from "./routes/submissions.routes";
import usersRouter from "./routes/users.routes";
import createAuthRouter from "./routes/auth.routes";
import notFound from "./middleware/notFound.middleware";
import errorHandler from "./middleware/error.middleware";

export default function createApp(): Express {
  const app = express();
  const origins = (
    process.env.CLIENT_URL ?? "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: origins,
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: false,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api/auth", createAuthRouter());
  app.use("/api/users", usersRouter);
  app.use("/api/restaurants", restaurantsRouter);
  app.use("/api/submissions", submissionsRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
