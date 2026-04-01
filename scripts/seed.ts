import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/invest-tracker";

interface IUser {
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
}

const UserSchema = new mongoose.Schema<IUser>({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  const email = process.env.SEED_EMAIL || "admin@example.com";
  const password = process.env.SEED_PASSWORD || "changeme123";
  const name = process.env.SEED_NAME || "Admin";

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`User ${email} already exists, updating password...`);
    existing.passwordHash = await bcrypt.hash(password, 12);
    await existing.save();
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    await User.create({ email, passwordHash, name });
    console.log(`Created user: ${email}`);
  }

  console.log(`\nAdmin credentials:`);
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
