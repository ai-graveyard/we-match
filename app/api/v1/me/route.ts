import { authenticate } from "@/lib/api/auth";
import { serializeSelf } from "@/lib/api/serialize";

// GET /api/v1/me：本人名片全量字段 + 可见性设置
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (auth instanceof Response) return auth;
  return Response.json(serializeSelf(auth.user));
}
