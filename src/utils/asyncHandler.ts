import type { NextFunction, Request, RequestHandler, Response } from "express";

export default function asyncHandler<
  Params = Record<string, string>,
  ResponseBody = unknown,
  RequestBody = unknown,
  Query = Request["query"],
>(
  handler: (
    req: Request<Params, ResponseBody, RequestBody, Query>,
    res: Response<ResponseBody>,
    next: NextFunction,
  ) => Promise<void>,
): RequestHandler<Params, ResponseBody, RequestBody, Query> {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
