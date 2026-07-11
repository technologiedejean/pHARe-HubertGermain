import { NextResponse } from "next/server";

// Exemple de route API : accessible sur /api/hello
export async function GET() {
  return NextResponse.json({ message: "Bonjour depuis l'API 👋" });
}
