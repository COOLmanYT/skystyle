import { categoryHealthResponse } from "@/lib/health-response";
export const dynamic = "force-dynamic";
export const GET = () => categoryHealthResponse("database");
