export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      action_proposals: {
        Row: {
          applied_plan_id: string | null
          approval_key: string | null
          created_at: string
          decided_at: string | null
          expires_at: string
          feasible: boolean
          id: string
          input_hash: string
          kind: string
          owner_id: string
          payload: Json
          payload_hash: string
          run_id: string | null
          scenario: string
          schema_version: number
          status: string
        }
        Insert: {
          applied_plan_id?: string | null
          approval_key?: string | null
          created_at?: string
          decided_at?: string | null
          expires_at: string
          feasible: boolean
          id?: string
          input_hash: string
          kind?: string
          owner_id: string
          payload: Json
          payload_hash: string
          run_id?: string | null
          scenario: string
          schema_version?: number
          status?: string
        }
        Update: {
          applied_plan_id?: string | null
          approval_key?: string | null
          created_at?: string
          decided_at?: string | null
          expires_at?: string
          feasible?: boolean
          id?: string
          input_hash?: string
          kind?: string
          owner_id?: string
          payload?: Json
          payload_hash?: string
          run_id?: string | null
          scenario?: string
          schema_version?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_proposals_run_id_owner_id_fkey"
            columns: ["run_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "proposals_applied_plan_fk"
            columns: ["applied_plan_id"]
            isOneToOne: true
            referencedRelation: "study_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          citations: Json
          completed_at: string | null
          course_id: string | null
          created_at: string
          error_code: string | null
          fallback_from: string | null
          fallback_reason: string | null
          id: string
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          owner_id: string
          request_text: string
          status: string
          summary: string | null
          tool_events: Json
        }
        Insert: {
          citations?: Json
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          error_code?: string | null
          fallback_from?: string | null
          fallback_reason?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          owner_id: string
          request_text: string
          status?: string
          summary?: string | null
          tool_events?: Json
        }
        Update: {
          citations?: Json
          completed_at?: string | null
          course_id?: string | null
          created_at?: string
          error_code?: string | null
          fallback_from?: string | null
          fallback_reason?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          owner_id?: string
          request_text?: string
          status?: string
          summary?: string | null
          tool_events?: Json
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_course_id_owner_id_fkey"
            columns: ["course_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      assignment_checklist_items: {
        Row: {
          assignment_id: string
          created_at: string
          document_id: string | null
          done: boolean
          id: string
          kind: string
          owner_id: string
          page: number | null
          position: number
          text: string
          weight: number | null
        }
        Insert: {
          assignment_id: string
          created_at?: string
          document_id?: string | null
          done?: boolean
          id?: string
          kind: string
          owner_id?: string
          page?: number | null
          position: number
          text: string
          weight?: number | null
        }
        Update: {
          assignment_id?: string
          created_at?: string
          document_id?: string | null
          done?: boolean
          id?: string
          kind?: string
          owner_id?: string
          page?: number | null
          position?: number
          text?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_checklist_items_assignment_id_owner_id_fkey"
            columns: ["assignment_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "assignment_checklist_items_document_id_owner_id_fkey"
            columns: ["document_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      assignments: {
        Row: {
          course_id: string
          created_at: string
          due_at: string
          estimated_minutes: number
          id: string
          notes: string
          owner_id: string
          required: boolean
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          due_at: string
          estimated_minutes?: number
          id?: string
          notes?: string
          owner_id?: string
          required?: boolean
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          due_at?: string
          estimated_minutes?: number
          id?: string
          notes?: string
          owner_id?: string
          required?: boolean
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_course_id_owner_id_fkey"
            columns: ["course_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      calendar_feeds: {
        Row: {
          created_at: string
          owner_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          owner_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          owner_id?: string
          token_hash?: string
        }
        Relationships: []
      }
      copilot_memories: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          source: string
          status: string
          text: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id?: string
          source?: string
          status?: string
          text: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          source?: string
          status?: string
          text?: string
          updated_at?: string
        }
        Relationships: []
      }
      course_prerequisites: {
        Row: {
          course_id: string
          created_at: string
          owner_id: string
          requires_course_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          owner_id?: string
          requires_course_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          owner_id?: string
          requires_course_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_prerequisites_course_id_owner_id_fkey"
            columns: ["course_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "course_prerequisites_requires_course_id_owner_id_fkey"
            columns: ["requires_course_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          description: string
          id: string
          owner_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          owner_id?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          owner_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          content_tsv: unknown
          course_id: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          owner_id: string
          page_end: number
          page_start: number
        }
        Insert: {
          chunk_index: number
          content: string
          content_tsv?: unknown
          course_id: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          owner_id: string
          page_end: number
          page_start: number
        }
        Update: {
          chunk_index?: number
          content?: string
          content_tsv?: unknown
          course_id?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          owner_id?: string
          page_end?: number
          page_start?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_course_id_owner_id_fkey"
            columns: ["course_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "document_chunks_document_id_owner_id_fkey"
            columns: ["document_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      documents: {
        Row: {
          chunk_count: number | null
          course_id: string
          created_at: string
          embedding_model: string | null
          error_code: string | null
          filename: string
          id: string
          owner_id: string
          page_count: number | null
          processed_at: string | null
          processing_started_at: string | null
          sha256: string | null
          size_bytes: number
          status: string
          storage_path: string | null
          updated_at: string
        }
        Insert: {
          chunk_count?: number | null
          course_id: string
          created_at?: string
          embedding_model?: string | null
          error_code?: string | null
          filename: string
          id?: string
          owner_id?: string
          page_count?: number | null
          processed_at?: string | null
          processing_started_at?: string | null
          sha256?: string | null
          size_bytes: number
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Update: {
          chunk_count?: number | null
          course_id?: string
          created_at?: string
          embedding_model?: string | null
          error_code?: string | null
          filename?: string
          id?: string
          owner_id?: string
          page_count?: number | null
          processed_at?: string | null
          processing_started_at?: string | null
          sha256?: string | null
          size_bytes?: number
          status?: string
          storage_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_course_id_owner_id_fkey"
            columns: ["course_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          kind: string
          owner_id: string
          page: string | null
          rating: number | null
          ref: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          kind: string
          owner_id?: string
          page?: string | null
          rating?: number | null
          ref?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          kind?: string
          owner_id?: string
          page?: string | null
          rating?: number | null
          ref?: string | null
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          completed: boolean
          created_at: string
          ended_at: string
          focused_minutes: number
          id: string
          owner_id: string
          planned_minutes: number
          started_at: string
          task_id: string | null
        }
        Insert: {
          completed?: boolean
          created_at?: string
          ended_at?: string
          focused_minutes: number
          id?: string
          owner_id?: string
          planned_minutes: number
          started_at: string
          task_id?: string | null
        }
        Update: {
          completed?: boolean
          created_at?: string
          ended_at?: string
          focused_minutes?: number
          id?: string
          owner_id?: string
          planned_minutes?: number
          started_at?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "focus_sessions_task_id_owner_id_fkey"
            columns: ["task_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "study_tasks"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      mcp_tokens: {
        Row: {
          created_at: string
          last_used_at: string | null
          owner_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          last_used_at?: string | null
          owner_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          last_used_at?: string | null
          owner_id?: string
          token_hash?: string
        }
        Relationships: []
      }
      mcp_usage: {
        Row: {
          count: number
          owner_id: string
          window_start: string
        }
        Insert: {
          count?: number
          owner_id: string
          window_start?: string
        }
        Update: {
          count?: number
          owner_id?: string
          window_start?: string
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          daily_digest: boolean
          last_sent_on: string | null
          missed_alert: boolean
          owner_id: string
          updated_at: string
        }
        Insert: {
          daily_digest?: boolean
          last_sent_on?: string | null
          missed_alert?: boolean
          owner_id?: string
          updated_at?: string
        }
        Update: {
          daily_digest?: boolean
          last_sent_on?: string | null
          missed_alert?: boolean
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      ops_flags: {
        Row: {
          ai_enabled: boolean
          daily_token_budget: number
          id: number
          note: string | null
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          daily_token_budget?: number
          id?: number
          note?: string | null
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          daily_token_budget?: number
          id?: number
          note?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          onboarded_at: string | null
          study_start_time: string
          timezone: string
          updated_at: string
          weekly_minutes: number[]
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          onboarded_at?: string | null
          study_start_time?: string
          timezone?: string
          updated_at?: string
          weekly_minutes?: number[]
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          onboarded_at?: string | null
          study_start_time?: string
          timezone?: string
          updated_at?: string
          weekly_minutes?: number[]
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answers: Json
          created_at: string
          id: string
          owner_id: string
          quiz_id: string
          results: Json
          score_percent: number
        }
        Insert: {
          answers: Json
          created_at?: string
          id?: string
          owner_id: string
          quiz_id: string
          results: Json
          score_percent: number
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          owner_id?: string
          quiz_id?: string
          results?: Json
          score_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_owner_id_fkey"
            columns: ["quiz_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      quiz_keys: {
        Row: {
          created_at: string
          keys: Json
          owner_id: string
          quiz_id: string
        }
        Insert: {
          created_at?: string
          keys: Json
          owner_id: string
          quiz_id: string
        }
        Update: {
          created_at?: string
          keys?: Json
          owner_id?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_keys_quiz_id_owner_id_fkey"
            columns: ["quiz_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      quizzes: {
        Row: {
          course_id: string
          created_at: string
          id: string
          method: string
          owner_id: string
          questions: Json
          run_id: string | null
          title: string
          topic: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          method?: string
          owner_id: string
          questions: Json
          run_id?: string | null
          title: string
          topic: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          method?: string
          owner_id?: string
          questions?: Json
          run_id?: string | null
          title?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_course_id_owner_id_fkey"
            columns: ["course_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      rate_limit_counters: {
        Row: {
          bucket: string
          hits: number
          owner_id: string
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          owner_id: string
          window_start: string
        }
        Update: {
          bucket?: string
          hits?: number
          owner_id?: string
          window_start?: string
        }
        Relationships: []
      }
      study_plans: {
        Row: {
          created_at: string
          feasibility: Json
          id: string
          owner_id: string
          proposal_id: string
          scenario: string
          status: string
          superseded_at: string | null
          title: string
        }
        Insert: {
          created_at?: string
          feasibility?: Json
          id?: string
          owner_id: string
          proposal_id: string
          scenario: string
          status?: string
          superseded_at?: string | null
          title: string
        }
        Update: {
          created_at?: string
          feasibility?: Json
          id?: string
          owner_id?: string
          proposal_id?: string
          scenario?: string
          status?: string
          superseded_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_plans_proposal_id_owner_id_fkey"
            columns: ["proposal_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "action_proposals"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      study_tasks: {
        Row: {
          active: boolean
          assignment_id: string | null
          completed_at: string | null
          course_id: string
          created_at: string
          duration_minutes: number | null
          ends_at: string
          evidence: Json
          id: string
          kind: string
          owner_id: string
          plan_id: string
          position: number
          starts_at: string
          status: string
          title: string
        }
        Insert: {
          active?: boolean
          assignment_id?: string | null
          completed_at?: string | null
          course_id: string
          created_at?: string
          duration_minutes?: number | null
          ends_at: string
          evidence?: Json
          id?: string
          kind: string
          owner_id: string
          plan_id: string
          position: number
          starts_at: string
          status?: string
          title: string
        }
        Update: {
          active?: boolean
          assignment_id?: string | null
          completed_at?: string | null
          course_id?: string
          created_at?: string
          duration_minutes?: number | null
          ends_at?: string
          evidence?: Json
          id?: string
          kind?: string
          owner_id?: string
          plan_id?: string
          position?: number
          starts_at?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_tasks_assignment_id_owner_id_fkey"
            columns: ["assignment_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "study_tasks_course_id_owner_id_fkey"
            columns: ["course_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "owner_id"]
          },
          {
            foreignKeyName: "study_tasks_plan_id_owner_id_fkey"
            columns: ["plan_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "study_plans"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      teach_back_attempts: {
        Row: {
          concepts: Json
          course_id: string
          coverage_percent: number
          created_at: string
          explanation: string
          id: string
          owner_id: string
          topic: string
        }
        Insert: {
          concepts: Json
          course_id: string
          coverage_percent: number
          created_at?: string
          explanation: string
          id?: string
          owner_id: string
          topic: string
        }
        Update: {
          concepts?: Json
          course_id?: string
          coverage_percent?: number
          created_at?: string
          explanation?: string
          id?: string
          owner_id?: string
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "teach_back_attempts_course_id_owner_id_fkey"
            columns: ["course_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      weekly_reflections: {
        Row: {
          created_at: string
          id: string
          next_focus: string
          owner_id: string
          updated_at: string
          was_hard: string
          week_start: string
          went_well: string
        }
        Insert: {
          created_at?: string
          id?: string
          next_focus?: string
          owner_id?: string
          updated_at?: string
          was_hard?: string
          week_start: string
          went_well?: string
        }
        Update: {
          created_at?: string
          id?: string
          next_focus?: string
          owner_id?: string
          updated_at?: string
          was_hard?: string
          week_start?: string
          went_well?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_proposal: {
        Args: { p_idempotency_key: string; p_proposal_id: string }
        Returns: Json
      }
      consume_mcp_quota: {
        Args: { p_limit: number; p_owner: string; p_window_seconds: number }
        Returns: boolean
      }
      consume_rate_limit: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      reject_proposal: { Args: { p_proposal_id: string }; Returns: Json }
      search_course_chunks: {
        Args: {
          p_course_id: string
          p_limit?: number
          p_query: string
          p_query_embedding?: string
        }
        Returns: {
          chunk_id: string
          content: string
          document_id: string
          filename: string
          lexical_coverage: number
          lexical_rank: number
          page_end: number
          page_start: number
          score: number
          vector_similarity: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

