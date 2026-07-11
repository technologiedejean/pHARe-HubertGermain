// >>> Ce fichier REMPLACE : app/page.tsx <<<
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    async function redirect() {
      const { data: { user } } = await supabase.auth.getUser();
      router.replace(user ? "/dashboard" : "/login");
    }
    redirect();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FBFBFD]">
      <span className="text-[#6C6A80]">Chargement…</span>
    </div>
  );
}