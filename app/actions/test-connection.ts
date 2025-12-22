"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function testConnection() {
  try {
    const supabase = createAdminClient();

    // Probar inserción básica
    const { data, error } = await supabase
      .from("users")
      .insert({ name: "Test User" })
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: error.message,
        details: error,
      };
    }

    // Limpiar el usuario de prueba
    if (data) {
      await supabase.from("users").delete().eq("id", data.id);
    }

    return {
      success: true,
      message: "Connection successful!",
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
}
