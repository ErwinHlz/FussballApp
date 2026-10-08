
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "attendances": {
                  Row: {
                    "created_at": string,"event_id": string,"id": string,"member_id": string,"reason": string | null,"reason_note": string | null,"status": Database["public"]['Enums']["attendance_status"],"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: string,"member_id": string,"reason"?: string | null,"reason_note"?: string | null,"status": Database["public"]['Enums']["attendance_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: string,"member_id"?: string,"reason"?: string | null,"reason_note"?: string | null,"status"?: Database["public"]['Enums']["attendance_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendances_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendances_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendances_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"club_members": {
                  Row: {
                    "club_id": string,"created_at": string,"id": string,"role": Database["public"]['Enums']["club_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["club_role"],"user_id": string
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"id"?: string,"role"?: Database["public"]['Enums']["club_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "club_members_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "club_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"clubs": {
                  Row: {
                    "created_at": string,"created_by": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clubs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"drills": {
                  Row: {
                    "animation": Json | null,"category": string,"copied_from": string | null,"created_at": string,"created_by": string | null,"description": string,"duration_min": number | null,"equipment": (string)[],"id": string,"max_players": number | null,"min_players": number | null,"team_id": string | null,"title": string,"updated_at": string,"video_path": string | null,"video_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "animation"?: Json | null,"category": string,"copied_from"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"duration_min"?: number | null,"equipment"?: (string)[],"id"?: string,"max_players"?: number | null,"min_players"?: number | null,"team_id"?: string | null,"title": string,"updated_at"?: string,"video_path"?: string | null,"video_url"?: string | null
                  }
                  Update: {
                    "animation"?: Json | null,"category"?: string,"copied_from"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"duration_min"?: number | null,"equipment"?: (string)[],"id"?: string,"max_players"?: number | null,"min_players"?: number | null,"team_id"?: string | null,"title"?: string,"updated_at"?: string,"video_path"?: string | null,"video_url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "drills_copied_from_fkey"
      columns: ["copied_from"]
isOneToOne: false
      referencedRelation: "drills"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "drills_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "drills_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"event_drills": {
                  Row: {
                    "coach_notes": string | null,"created_at": string,"drill_id": string,"duration_min": number | null,"event_id": string,"id": string,"position": number
                  }
                  ComputedFields: never
                  Insert: {
                    "coach_notes"?: string | null,"created_at"?: string,"drill_id": string,"duration_min"?: number | null,"event_id": string,"id"?: string,"position"?: number
                  }
                  Update: {
                    "coach_notes"?: string | null,"created_at"?: string,"drill_id"?: string,"duration_min"?: number | null,"event_id"?: string,"id"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_drills_drill_id_fkey"
      columns: ["drill_id"]
isOneToOne: false
      referencedRelation: "drills"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_drills_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"event_series": {
                  Row: {
                    "created_at": string,"duration_min": number,"id": string,"location": string | null,"start_time": string,"team_id": string,"type": Database["public"]['Enums']["event_type"],"valid_from": string,"valid_until": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"duration_min": number,"id"?: string,"location"?: string | null,"start_time": string,"team_id": string,"type"?: Database["public"]['Enums']["event_type"],"valid_from": string,"valid_until": string,"weekday": number
                  }
                  Update: {
                    "created_at"?: string,"duration_min"?: number,"id"?: string,"location"?: string | null,"start_time"?: string,"team_id"?: string,"type"?: Database["public"]['Enums']["event_type"],"valid_from"?: string,"valid_until"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_series_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "cancel_reason": string | null,"competition": string | null,"created_at": string,"ends_at": string | null,"id": string,"is_cancelled": boolean,"is_home": boolean | null,"location": string | null,"meet_at": string | null,"meet_location": string | null,"notes": string | null,"opponent": string | null,"plan_published_at": string | null,"plan_status": Database["public"]['Enums']["plan_status"],"response_deadline": string | null,"series_id": string | null,"starts_at": string,"team_id": string,"type": Database["public"]['Enums']["event_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "cancel_reason"?: string | null,"competition"?: string | null,"created_at"?: string,"ends_at"?: string | null,"id"?: string,"is_cancelled"?: boolean,"is_home"?: boolean | null,"location"?: string | null,"meet_at"?: string | null,"meet_location"?: string | null,"notes"?: string | null,"opponent"?: string | null,"plan_published_at"?: string | null,"plan_status"?: Database["public"]['Enums']["plan_status"],"response_deadline"?: string | null,"series_id"?: string | null,"starts_at": string,"team_id": string,"type": Database["public"]['Enums']["event_type"]
                  }
                  Update: {
                    "cancel_reason"?: string | null,"competition"?: string | null,"created_at"?: string,"ends_at"?: string | null,"id"?: string,"is_cancelled"?: boolean,"is_home"?: boolean | null,"location"?: string | null,"meet_at"?: string | null,"meet_location"?: string | null,"notes"?: string | null,"opponent"?: string | null,"plan_published_at"?: string | null,"plan_status"?: Database["public"]['Enums']["plan_status"],"response_deadline"?: string | null,"series_id"?: string | null,"starts_at"?: string,"team_id"?: string,"type"?: Database["public"]['Enums']["event_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_series_id_fkey"
      columns: ["series_id"]
isOneToOne: false
      referencedRelation: "event_series"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"match_squad": {
                  Row: {
                    "created_at": string,"event_id": string,"id": string,"member_id": string,"role": Database["public"]['Enums']["squad_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: string,"member_id": string,"role": Database["public"]['Enums']["squad_role"]
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: string,"member_id"?: string,"role"?: Database["public"]['Enums']["squad_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_squad_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_squad_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string,"id": string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"team_invites": {
                  Row: {
                    "created_at": string,"created_by": string,"expires_at": string,"id": string,"revoked_at": string | null,"role": Database["public"]['Enums']["team_role"],"team_id": string,"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string,"expires_at"?: string,"id"?: string,"revoked_at"?: string | null,"role": Database["public"]['Enums']["team_role"],"team_id": string,"token"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"expires_at"?: string,"id"?: string,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["team_role"],"team_id"?: string,"token"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_invites_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_members": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string,"positions": (string)[],"role": Database["public"]['Enums']["team_role"],"shirt_number": number | null,"status": Database["public"]['Enums']["member_status"],"team_id": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"id"?: string,"positions"?: (string)[],"role"?: Database["public"]['Enums']["team_role"],"shirt_number"?: number | null,"status"?: Database["public"]['Enums']["member_status"],"team_id": string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string,"positions"?: (string)[],"role"?: Database["public"]['Enums']["team_role"],"shirt_number"?: number | null,"status"?: Database["public"]['Enums']["member_status"],"team_id"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_members_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "club_id": string,"created_at": string,"created_by": string,"id": string,"name": string,"season": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"created_by"?: string,"id"?: string,"name": string,"season"?: string | null
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"created_by"?: string,"id"?: string,"name"?: string,"season"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "teams_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_team_invite":
{ Args: { "p_token": string }; Returns: string
                           },
"copy_drill":
{ Args: { "p_drill_id": string,"p_team_id": string }; Returns: {
              "animation": Json | null,
"category": string,
"copied_from": string | null,
"created_at": string,
"created_by": string | null,
"description": string,
"duration_min": number | null,
"equipment": (string)[],
"id": string,
"max_players": number | null,
"min_players": number | null,
"team_id": string | null,
"title": string,
"updated_at": string,
"video_path": string | null,
"video_url": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "drills"
        isOneToOne: true
        isSetofReturn: false
      } },
"copy_event_plan":
{ Args: { "p_source_event_id": string,"p_target_event_id": string }; Returns: number
                           },
"create_club":
{ Args: { "p_name": string }; Returns: {
              "created_at": string,
"created_by": string,
"id": string,
"name": string
            }
                          SetofOptions: {
        from: "*"
        to: "clubs"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_training_series":
{ Args: { "p_deadline_hours"?: number,"p_duration_min": number,"p_location": string,"p_start_time": string,"p_starts_at": (string)[],"p_team_id": string,"p_valid_from": string,"p_valid_until": string,"p_weekday": number }; Returns: {
              "created_at": string,
"duration_min": number,
"id": string,
"location": string | null,
"start_time": string,
"team_id": string,
"type": Database["public"]['Enums']["event_type"],
"valid_from": string,
"valid_until": string,
"weekday": number
            }
                          SetofOptions: {
        from: "*"
        to: "event_series"
        isOneToOne: true
        isSetofReturn: false
      } },
"event_open_for_responses":
{ Args: { "p_event_id": string }; Returns: boolean
                           },
"event_plan_published":
{ Args: { "p_event_id": string }; Returns: boolean
                           },
"event_team_id":
{ Args: { "p_event_id": string }; Returns: string
                           },
"get_team_invite":
{ Args: { "p_token": string }; Returns: {
              "club_name": string,"expires_at": string,"role": Database["public"]['Enums']["team_role"],"status": string,"team_name": string,"team_season": string
            }[]
                           },
"is_club_admin":
{ Args: { "p_club_id": string }; Returns: boolean
                           },
"is_club_member":
{ Args: { "p_club_id": string }; Returns: boolean
                           },
"is_own_member":
{ Args: { "p_member_id": string }; Returns: boolean
                           },
"is_team_coach":
{ Args: { "p_team_id": string }; Returns: boolean
                           },
"is_team_member":
{ Args: { "p_team_id": string }; Returns: boolean
                           },
"is_training_event":
{ Args: { "p_event_id": string }; Returns: boolean
                           },
"link_team_member":
{ Args: { "p_account_member_id": string,"p_manual_member_id": string }; Returns: {
              "created_at": string,
"display_name": string,
"id": string,
"positions": (string)[],
"role": Database["public"]['Enums']["team_role"],
"shirt_number": number | null,
"status": Database["public"]['Enums']["member_status"],
"team_id": string,
"user_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "team_members"
        isOneToOne: true
        isSetofReturn: false
      } },
"my_clubs":
{ Args: Record<PropertyKey, never>; Returns: {
              "club_id": string,"club_name": string,"role": Database["public"]['Enums']["club_role"]
            }[]
                           },
"my_teams":
{ Args: Record<PropertyKey, never>; Returns: {
              "club_id": string,"club_name": string,"is_club_admin": boolean,"team_id": string,"team_name": string,"team_role": Database["public"]['Enums']["team_role"],"team_season": string
            }[]
                           },
"reorder_event_drills":
{ Args: { "p_event_id": string,"p_ids": (string)[] }; Returns: undefined
                           },
"set_attendance":
{ Args: { "p_event_id": string,"p_member_id": string,"p_reason"?: string,"p_reason_note"?: string,"p_status": Database["public"]['Enums']["attendance_status"] }; Returns: {
              "created_at": string,
"event_id": string,
"id": string,
"member_id": string,
"reason": string | null,
"reason_note": string | null,
"status": Database["public"]['Enums']["attendance_status"],
"updated_at": string,
"updated_by": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "attendances"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_club_member_role":
{ Args: { "p_club_id": string,"p_role": Database["public"]['Enums']["club_role"],"p_user_id": string }; Returns: undefined
                           },
"set_match_squad":
{ Args: { "p_entries": Json,"p_event_id": string }; Returns: undefined
                           },
"shares_club_with":
{ Args: { "p_user_id": string }; Returns: boolean
                           },
"team_club_id":
{ Args: { "p_team_id": string }; Returns: string
                           }
          }
          Enums: {
            "attendance_status": "yes"|"no"|"maybe","club_role": "admin"|"member","event_type": "training"|"match","member_status": "active"|"injured"|"inactive","plan_status": "draft"|"published","squad_role": "starter"|"bench"|"reserve","team_role": "coach"|"player"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "attendance_status": ["yes", "no", "maybe"],"club_role": ["admin", "member"],"event_type": ["training", "match"],"member_status": ["active", "injured", "inactive"],"plan_status": ["draft", "published"],"squad_role": ["starter", "bench", "reserve"],"team_role": ["coach", "player"]
          }
        }
} as const
