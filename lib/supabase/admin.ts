import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Cliente administrativo que bypasea RLS
// SOLO usar en Server Actions, NUNCA en el cliente
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
