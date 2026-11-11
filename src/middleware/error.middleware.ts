import type { ErrorRequestHandler } from "express";

const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  const error =
    err instanceof Error ? err : new Error("서버 오류가 발생했습니다.");
  const status =
    "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 500;
  res
    .status(status)
    .json({
      success: false,
      message: error.message,
      error: { message: error.message },
    });
};
export default errorHandler;
