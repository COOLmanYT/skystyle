import { NextRequest } from "next/server";
import { categoryHealthResponse } from "@/lib/health-response";
export const dynamic = "force-dynamic";
export const GET = (request: NextRequest) => categoryHealthResponse("ai", request);
