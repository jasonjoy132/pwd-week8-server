import type { RequestHandler } from "express";

const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: { message: "Resource not found" } });
};

export default notFound;
