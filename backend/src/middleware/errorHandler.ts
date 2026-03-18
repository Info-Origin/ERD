import type { Request, Response, NextFunction } from "express";

export const notFound = (_req: Request, res: Response): void => {
  res.status(404).json({ message: "Route not found" });
};

export const errorHandler = (
  err: Error & { status?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || "Internal server error",
  });
};
