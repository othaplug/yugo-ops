"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AppRole } from "@/lib/auth/check-role";

interface UserRoleState {
  role: AppRole;
  loading: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isStaff: boolean;
}

const ROLE_LEVEL: Record<string, number> = {
  owner: 100,
  admin: 80,
  manager: 60,
  dispatcher: 50,
  coordinator: 40,
  viewer: 30,
  crew: 20,
  partner: 10,
  client: 5,
};

export function useUserRole(): UserRoleState {
  const [role, setRole] = useState<AppRole>("viewer");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setLoading(false);
        return;
      }
      supabase
        .from("platform_users")
        .select("role")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.role) setRole(data.role as AppRole);
          setLoading(false);
        });
    });
  }, []);

  const level = ROLE_LEVEL[role] ?? 0;

  return {
    role,
    loading,
    isOwner: level >= ROLE_LEVEL.owner,
    isAdmin: level >= ROLE_LEVEL.admin,
    isStaff: level >= ROLE_LEVEL.coordinator,
  };
}
