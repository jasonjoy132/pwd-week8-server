import type { RestaurantRow } from "../types/database.types";
import type {
  RestaurantData,
  RestaurantInput,
} from "../types/restaurant.types";

export default class Restaurant implements RestaurantData {
  id: number;
  name: string;
  category: string;
  location: string;
  priceRange: string;
  rating: number;
  description: string;
  recommendedMenu: string[];
  likes: number;
  image: string;

  constructor({
    id,
    name,
    category,
    location,
    priceRange,
    rating,
    description,
    recommendedMenu = [],
    likes = 0,
    image = "",
  }: RestaurantInput) {
    this.id = Number(id);
    this.name = name;
    this.category = category;
    this.location = location;
    this.priceRange = priceRange;
    this.rating = Number(rating);
    this.description = description;
    this.recommendedMenu = [...recommendedMenu];
    this.likes = Number(likes);
    this.image = image;
  }

  static fromDatabase(row: RestaurantRow): Restaurant {
    return new Restaurant({
      id: row.id,
      name: row.name,
      category: row.category,
      location: row.location,
      priceRange: row.price_range,
      rating: row.rating,
      description: row.description,
      recommendedMenu: row.recommended_menu,
      likes: row.likes,
      image: row.image,
    });
  }

  updateLikes(likes: number | string): this {
    this.likes = Number(likes);
    return this;
  }
}
