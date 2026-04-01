import mongoose, { Schema, Document, Model } from "mongoose";

export interface IFund extends Document {
  userId: mongoose.Types.ObjectId;
  amfiCode: string;
  isin: string;
  schemeName: string;
  fundHouse: string;
  category: string;
  subCategory: string;
  folioNumber: string;
  currentUnits: number;
  currentNav: number;
}

const FundSchema = new Schema<IFund>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  amfiCode: { type: String, required: true },
  isin: { type: String, default: "" },
  schemeName: { type: String, required: true },
  fundHouse: { type: String, default: "" },
  category: { type: String, default: "Equity" },
  subCategory: { type: String, default: "" },
  folioNumber: { type: String, required: true },
  currentUnits: { type: Number, default: 0 },
  currentNav: { type: Number, default: 0 },
});

FundSchema.index({ userId: 1, amfiCode: 1 }, { unique: true });

const Fund: Model<IFund> =
  mongoose.models.Fund || mongoose.model<IFund>("Fund", FundSchema);
export default Fund;
