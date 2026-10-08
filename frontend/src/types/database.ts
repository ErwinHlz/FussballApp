
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
            "club_members": {
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
"is_team_coach":
{ Args: { "p_team_id": string }; Returns: boolean
                           },
"is_team_member":
{ Args: { "p_team_id": string }; Returns: boolean
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
"set_club_member_role":
{ Args: { "p_club_id": string,"p_role": Database["public"]['Enums']["club_role"],"p_user_id": string }; Returns: undefined
                           },
"shares_club_with":
{ Args: { "p_user_id": string }; Returns: boolean
                           },
"team_club_id":
{ Args: { "p_team_id": string }; Returns: string
                           }
          }
          Enums: {
            "club_role": "admin"|"member","member_status": "active"|"injured"|"inactive","team_role": "coach"|"player"
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
            "club_role": ["admin", "member"],"member_status": ["active", "injured", "inactive"],"team_role": ["coach", "player"]
          }
        }
} as const
