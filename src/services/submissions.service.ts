import { getSupabase, throwDatabaseError } from "../config/supabase";
import type { AppUser } from "../types/auth.types";
import type { SubmissionRow } from "../types/database.types";
import Restaurant from "../models/restaurant.model";
import HttpError from "../utils/httpError";
import { menuField, numericId, objectBody, textField } from "../utils/input";

function submissionResponse(row: SubmissionRow) {
  return {
    id: row.id,
    restaurantName: row.restaurant_name,
    category: row.category,
    location: row.location,
    priceRange: row.price_range,
    recommendedMenu: row.recommended_menu,
    review: row.review,
    submitterId: row.submitter_id,
    submitterName: row.submitter_name,
    submitterEmail: row.submitter_email,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export async function listSubmissions(status: unknown) {
  if (
    status !== undefined &&
    !["pending", "approved", "rejected"].includes(String(status))
  )
    throw new HttpError(400, "제보 상태가 올바르지 않습니다.");
  let query = getSupabase().from("submissions").select("*");
  if (typeof status === "string")
    query = query.eq("status", status as SubmissionRow["status"]);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throwDatabaseError(error);
  return (data ?? []).map(submissionResponse);
}
export async function getSubmissionById(id: string) {
  const { data, error } = await getSupabase()
    .from("submissions")
    .select("*")
    .eq("id", numericId(id))
    .maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw new HttpError(404, "Submission not found");
  return submissionResponse(data);
}
export async function createSubmission(body: unknown, user: AppUser) {
  const input = objectBody(body);
  const { data, error } = await getSupabase()
    .from("submissions")
    .insert({
      restaurant_name: textField(
        input.restaurantName,
        "restaurantName",
        true,
        300,
      ),
      category: textField(input.category, "category", true, 300),
      location: textField(input.location, "location", true, 300),
      price_range: textField(input.priceRange, "priceRange"),
      recommended_menu: menuField(input.recommendedMenu),
      review: textField(input.review, "review"),
      // [이론: 사용자 ID] user는 컨트롤러가 req.auth에서 전달한 검증된 프로필입니다.
      // 요청 본문의 submitterId 대신 이 계정의 UUID를 저장해 제보와 사용자를 연결합니다.
      submitter_id: user.id,
      submitter_name: user.name,
      submitter_email: user.email,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throwDatabaseError(error);
  return submissionResponse(data!);
}
export async function rejectSubmission(
  id: string,
  body: unknown,
  reviewer: AppUser,
) {
  const input = objectBody(body);
  if (input.status !== "rejected")
    throw new HttpError(
      400,
      "거절은 status=rejected, 승인은 승인 전용 API를 사용하세요.",
    );
  const numeric = numericId(id);
  const { data, error } = await getSupabase()
    .from("submissions")
    .update({
      status: "rejected",
      reviewed_by: reviewer.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", numeric)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) {
    await getSubmissionById(id);
    throw new HttpError(409, "대기 중인 제보만 거절할 수 있습니다.");
  }
  return submissionResponse(data);
}
export async function approveSubmission(id: string, reviewer: AppUser) {
  const { data, error } = await getSupabase().rpc(
    "approve_foodmap_submission",
    { p_submission_id: numericId(id), p_reviewer_id: reviewer.id },
  );
  if (error) throwDatabaseError(error);
  return Restaurant.fromDatabase(data![0]);
}
export async function deleteSubmission(id: string) {
  const { data, error } = await getSupabase()
    .from("submissions")
    .delete()
    .eq("id", numericId(id))
    .select("id")
    .maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw new HttpError(404, "Submission not found");
}
