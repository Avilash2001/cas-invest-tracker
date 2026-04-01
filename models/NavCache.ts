import mongoose, { Schema, Document, Model } from "mongoose";

export interface INavCache extends Document {
  amfiCode: string;
  nav: number;
  navDate: Date;
  updatedAt: Date;
}

const NavCacheSchema = new Schema<INavCache>({
  amfiCode: { type: String, required: true, unique: true },
  nav: { type: Number, required: true },
  navDate: { type: Date, required: true },
  updatedAt: { type: Date, default: Date.now },
});

// TTL index: auto-expire documents after 24h
NavCacheSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

const NavCache: Model<INavCache> =
  mongoose.models.NavCache || mongoose.model<INavCache>("NavCache", NavCacheSchema);
export default NavCache;
