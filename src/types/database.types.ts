export type RestaurantRow = {
  id: number;
  name: string;
  category: string;
  location: string;
  price_range: string;
  rating: number;
  description: string;
  recommended_menu: string[];
  likes: number;
  image: string;
  source_submission_id: number | null;
  created_at: string;
  updated_at: string;
};
export type RestaurantInsert = Pick<
  RestaurantRow,
  "name" | "category" | "location"
> &
  Partial<Omit<RestaurantRow, "id" | "name" | "category" | "location">>;
export type ProfileRow = {
  id: string;
  email: string;
  name: string;
  avatar: string;
  provider: string;
  user_type: "user" | "admin";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type SubmissionRow = {
  id: number;
  restaurant_name: string;
  category: string;
  location: string;
  price_range: string;
  recommended_menu: string[];
  review: string;
  submitter_id: string;
  submitter_name: string;
  submitter_email: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};
export type SubmissionInsert = Pick<
  SubmissionRow,
  | "restaurant_name"
  | "category"
  | "location"
  | "submitter_id"
  | "submitter_name"
  | "submitter_email"
> &
  Partial<
    Omit<
      SubmissionRow,
      | "id"
      | "restaurant_name"
      | "category"
      | "location"
      | "submitter_id"
      | "submitter_name"
      | "submitter_email"
    >
  >;
type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};
export interface Database {
  public: {
    Tables: {
      restaurants: Table<RestaurantRow, RestaurantInsert>;
      profiles: Table<ProfileRow, ProfileRow>;
      submissions: Table<SubmissionRow, SubmissionInsert>;
    };
    Views: Record<never, never>;
    Functions: {
      approve_foodmap_submission: {
        Args: { p_submission_id: number; p_reviewer_id: string };
        Returns: RestaurantRow[];
      };
      set_foodmap_user_type: {
        Args: { p_user_id: string; p_user_type: string };
        Returns: ProfileRow[];
      };
      deactivate_foodmap_account: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
