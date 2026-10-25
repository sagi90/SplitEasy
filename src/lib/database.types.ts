/**
 * Generated-style database types for the SplitEasy schema. Kept in sync with
 * the SQL migrations under /supabase/migrations.
 */

export type Role = "owner" | "member";
export type MemberStatus = "active" | "inactive";
export type SplitMode = "equal" | "exact" | "percentage" | "weight";
export type JoinRequestStatus = "pending" | "approved" | "rejected";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          preferred_locale: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          preferred_locale?: string;
        };
        Update: {
          display_name?: string | null;
          preferred_locale?: string;
        };
        Relationships: [];
      };
      groups: {
        Row: {
          id: string;
          name: string;
          emoji: string | null;
          description: string | null;
          default_currency: string;
          owner_user_id: string;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          emoji?: string | null;
          description?: string | null;
          default_currency?: string;
          owner_user_id: string;
        };
        Update: {
          name?: string;
          emoji?: string | null;
          description?: string | null;
          default_currency?: string;
          is_archived?: boolean;
        };
        Relationships: [];
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          user_id: string | null;
          display_name: string;
          role: Role;
          status: MemberStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          user_id?: string | null;
          display_name: string;
          role?: Role;
          status?: MemberStatus;
        };
        Update: {
          display_name?: string;
          role?: Role;
          status?: MemberStatus;
          user_id?: string | null;
        };
        Relationships: [];
      };
      group_invites: {
        Row: {
          id: string;
          group_id: string;
          token_hash: string;
          created_by_user_id: string;
          expires_at: string | null;
          revoked_at: string | null;
          max_uses: number | null;
          use_count: number;
          requires_approval: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          token_hash: string;
          created_by_user_id: string;
          expires_at?: string | null;
          max_uses?: number | null;
          requires_approval?: boolean;
        };
        Update: {
          revoked_at?: string | null;
          use_count?: number;
        };
        Relationships: [];
      };
      group_join_requests: {
        Row: {
          id: string;
          group_id: string;
          requesting_user_id: string;
          invite_id: string | null;
          requested_display_name: string;
          status: JoinRequestStatus;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          group_id: string;
          requesting_user_id: string;
          invite_id?: string | null;
          requested_display_name: string;
        };
        Update: {
          status?: JoinRequestStatus;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      placeholder_claims: {
        Row: {
          id: string;
          group_id: string;
          member_id: string;
          token_hash: string;
          created_by_user_id: string;
          expires_at: string | null;
          consumed_at: string | null;
          created_at: string;
        };
        Insert: {
          group_id: string;
          member_id: string;
          token_hash: string;
          created_by_user_id: string;
          expires_at?: string | null;
        };
        Update: {
          consumed_at?: string | null;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          group_id: string;
          description: string;
          amount_minor: number;
          currency: string;
          expense_date: string;
          category: string | null;
          created_by_user_id: string;
          version: number;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          group_id: string;
          description: string;
          amount_minor: number;
          currency: string;
          expense_date: string;
          category?: string | null;
          created_by_user_id: string;
        };
        Update: {
          description?: string;
          amount_minor?: number;
          currency?: string;
          expense_date?: string;
          category?: string | null;
          version?: number;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      expense_payers: {
        Row: {
          id: string;
          expense_id: string;
          member_id: string;
          amount_minor: number;
        };
        Insert: {
          expense_id: string;
          member_id: string;
          amount_minor: number;
        };
        Update: { amount_minor?: number };
        Relationships: [
          {
            foreignKeyName: "expense_payers_expense_id_fkey";
            columns: ["expense_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
        ];
      };
      expense_splits: {
        Row: {
          id: string;
          expense_id: string;
          member_id: string;
          amount_minor: number;
          split_mode: SplitMode;
          weight_decimal: number | null;
        };
        Insert: {
          expense_id: string;
          member_id: string;
          amount_minor: number;
          split_mode: SplitMode;
          weight_decimal?: number | null;
        };
        Update: { amount_minor?: number };
        Relationships: [
          {
            foreignKeyName: "expense_splits_expense_id_fkey";
            columns: ["expense_id"];
            isOneToOne: false;
            referencedRelation: "expenses";
            referencedColumns: ["id"];
          },
        ];
      };
      settlements: {
        Row: {
          id: string;
          group_id: string;
          from_member_id: string;
          to_member_id: string;
          amount_minor: number;
          currency: string;
          settled_at: string;
          note: string | null;
          created_by_user_id: string;
          deleted_at: string | null;
          created_at: string;
        };
        Insert: {
          group_id: string;
          from_member_id: string;
          to_member_id: string;
          amount_minor: number;
          currency: string;
          note?: string | null;
          created_by_user_id: string;
        };
        Update: { deleted_at?: string | null };
        Relationships: [];
      };
      audit_events: {
        Row: {
          id: string;
          group_id: string;
          actor_user_id: string | null;
          entity_type: string;
          entity_id: string;
          action: string;
          before_json: unknown | null;
          after_json: unknown | null;
          created_at: string;
        };
        Insert: {
          group_id: string;
          actor_user_id?: string | null;
          entity_type: string;
          entity_id: string;
          action: string;
          before_json?: unknown | null;
          after_json?: unknown | null;
        };
        Update: { [_ in never]: never };
        Relationships: [];
      };
    };
    Functions: {
      create_group_with_owner: {
        Args: {
          p_name: string;
          p_display_name: string;
          p_currency: string;
          p_emoji: string | null;
        };
        Returns: { group_id: string; member_id: string }[];
      };
      accept_invite: {
        Args: { p_token_hash: string; p_display_name: string };
        Returns: {
          group_id: string;
          member_id: string;
          status: string;
        }[];
      };
      consume_placeholder_claim: {
        Args: { p_token_hash: string };
        Returns: { group_id: string; member_id: string }[];
      };
      save_expense: {
        Args: {
          p_expense_id: string | null;
          p_group_id: string;
          p_description: string;
          p_amount_minor: number;
          p_currency: string;
          p_expense_date: string;
          p_category: string | null;
          p_payers: unknown;
          p_splits: unknown;
          p_expected_version: number | null;
        };
        Returns: { expense_id: string; version: number }[];
      };
      soft_delete_expense: {
        Args: { p_expense_id: string };
        Returns: undefined;
      };
      record_settlement: {
        Args: {
          p_group_id: string;
          p_from_member_id: string;
          p_to_member_id: string;
          p_amount_minor: number;
          p_currency: string;
          p_note: string | null;
        };
        Returns: string;
      };
      remove_member: {
        Args: { p_member_id: string };
        Returns: undefined;
      };
      resolve_join_request: {
        Args: { p_request_id: string; p_approve: boolean };
        Returns: undefined;
      };
      upsert_profile: {
        Args: { p_display_name: string; p_locale: string };
        Returns: undefined;
      };
      peek_invite: {
        Args: { p_token_hash: string };
        Returns: {
          group_name: string | null;
          group_emoji: string | null;
          requires_approval: boolean;
          valid: boolean;
        }[];
      };
      peek_claim: {
        Args: { p_token_hash: string };
        Returns: {
          group_name: string | null;
          member_name: string | null;
          valid: boolean;
        }[];
      };
    };
    Views: { [_ in never]: never };
    Enums: {
      member_role: Role;
      member_status: MemberStatus;
      split_mode: SplitMode;
      join_request_status: JoinRequestStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
