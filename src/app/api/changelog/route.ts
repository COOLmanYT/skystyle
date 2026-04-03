import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export interface ChangelogEntry {
  date: string;
  version: string;
  title: string;
  description: string;
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "changelog.json");
    const raw = await readFile(filePath, "utf-8");
    const entries: ChangelogEntry[] = JSON.parse(raw);
    return NextResponse.json(entries);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
