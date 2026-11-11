import asyncHandler from "../utils/asyncHandler";
import * as service from "../services/submissions.service";
export const list = asyncHandler(async (req, res) => {
  res.json({ data: await service.listSubmissions(req.query.status) });
});
export const get = asyncHandler(async (req, res) => {
  res.json({ data: await service.getSubmissionById(req.params.id) });
});
export const create = asyncHandler(async (req, res) => {
  res
    .status(201)
    .json({ data: await service.createSubmission(req.body, req.auth!) });
});
export const reject = asyncHandler(async (req, res) => {
  res.json({
    data: await service.rejectSubmission(req.params.id, req.body, req.auth!),
  });
});
export const approve = asyncHandler(async (req, res) => {
  res.json({ data: await service.approveSubmission(req.params.id, req.auth!) });
});
export const remove = asyncHandler(async (req, res) => {
  await service.deleteSubmission(req.params.id);
  res.status(204).send();
});
