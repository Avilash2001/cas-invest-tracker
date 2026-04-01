import mongoose, { Schema, Document, Model } from "mongoose";

export type TransactionType =
  | "purchase"
  | "redemption"
  | "dividend"
  | "switch_in"
  | "switch_out";

export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId;
  folioNumber: string;
  amfiCode: string;
  fundName: string;
  date: Date;
  type: TransactionType;
  amount: number;
  units: number;
  nav: number;
}

const TransactionSchema = new Schema<ITransaction>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  folioNumber: { type: String, required: true },
  amfiCode: { type: String, required: true, index: true },
  fundName: { type: String, required: true },
  date: { type: Date, required: true },
  type: {
    type: String,
    enum: ["purchase", "redemption", "dividend", "switch_in", "switch_out"],
    required: true,
  },
  amount: { type: Number, required: true },
  units: { type: Number, required: true },
  nav: { type: Number, required: true },
});

TransactionSchema.index({ userId: 1, amfiCode: 1, date: 1, type: 1 });

const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ||
  mongoose.model<ITransaction>("Transaction", TransactionSchema);
export default Transaction;
