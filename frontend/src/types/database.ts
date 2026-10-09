
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
            "absences": {
                  Row: {
                    "created_at": string,"created_by": string | null,"ends_at": string,"id": string,"member_id": string,"note": string | null,"reason": string,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"ends_at": string,"id"?: string,"member_id": string,"note"?: string | null,"reason": string,"starts_at": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"ends_at"?: string,"id"?: string,"member_id"?: string,"note"?: string | null,"reason"?: string,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "absences_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "absences_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "team_members"
      referencedColumns: ["id"]
    }
                  ]
                },"attendances": {
                  Row: {
                    "created_at": string,"event_id": string,"id": string,"member_id": string,"reason": string | null,"reason_note": string | null,"source_absence_id": string | null,"status": Database["public"]['Enums']["attendance_status"],"updated_at": string,"updated_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_id": string,"id"?: string,"member_id": string,"reason"?: string | null,"reason_note"?: string | null,"source_absence_id"?: string | null,"status": Database["public"]['Enums']["attendance_status"],"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string,"id"?: string,"member_id"?: string,"reason"?: string | null,"reason_note"?: string | null,"source_absence_id"?: string | null,"status"?: Database["public"]['Enums']["attendance_status"],"updated_at"?: string,"updated_by"?: string | null
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
      foreignKeyName: "attendances_source_absence_id_fkey"
      columns: ["source_absence_id"]
isOneToOne: false
      referencedRelation: "absences"
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
                    "created_at": string,"created_by": string | null,"id": string,"name": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"timezone"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"timezone"?: string
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
                },"drill_groups": {
                  Row: {
                    "color": string,"created_at": string,"event_drill_id": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color": string,"created_at"?: string,"event_drill_id": string,"id"?: string,"name": string
                  }
                  Update: {
                    "color"?: string,"created_at"?: string,"event_drill_id"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "drill_groups_event_drill_id_fkey"
      columns: ["event_drill_id"]
isOneToOne: false
      referencedRelation: "event_drills"
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
                    "booking_id": string | null,"cancel_reason": string | null,"competition": string | null,"created_at": string,"created_by": string | null,"ends_at": string | null,"id": string,"is_cancelled": boolean,"is_home": boolean | null,"location": string | null,"meet_at": string | null,"meet_location": string | null,"notes": string | null,"opponent": string | null,"plan_published_at": string | null,"plan_status": Database["public"]['Enums']["plan_status"],"reminder_sent_at": string | null,"response_deadline": string | null,"series_id": string | null,"starts_at": string,"team_id": string,"type": Database["public"]['Enums']["event_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id"?: string | null,"cancel_reason"?: string | null,"competition"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"id"?: string,"is_cancelled"?: boolean,"is_home"?: boolean | null,"location"?: string | null,"meet_at"?: string | null,"meet_location"?: string | null,"notes"?: string | null,"opponent"?: string | null,"plan_published_at"?: string | null,"plan_status"?: Database["public"]['Enums']["plan_status"],"reminder_sent_at"?: string | null,"response_deadline"?: string | null,"series_id"?: string | null,"starts_at": string,"team_id": string,"type": Database["public"]['Enums']["event_type"]
                  }
                  Update: {
                    "booking_id"?: string | null,"cancel_reason"?: string | null,"competition"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"id"?: string,"is_cancelled"?: boolean,"is_home"?: boolean | null,"location"?: string | null,"meet_at"?: string | null,"meet_location"?: string | null,"notes"?: string | null,"opponent"?: string | null,"plan_published_at"?: string | null,"plan_status"?: Database["public"]['Enums']["plan_status"],"reminder_sent_at"?: string | null,"response_deadline"?: string | null,"series_id"?: string | null,"starts_at"?: string,"team_id"?: string,"type"?: Database["public"]['Enums']["event_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "slot_bookings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
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
                },"group_assignments": {
                  Row: {
                    "created_at": string,"group_id": string,"id": string,"member_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"group_id": string,"id"?: string,"member_id": string
                  }
                  Update: {
                    "created_at"?: string,"group_id"?: string,"id"?: string,"member_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_assignments_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "drill_groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_assignments_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "team_members"
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
                },"notification_outbox": {
                  Row: {
                    "actor_id": string | null,"created_at": string,"event_id": string | null,"id": number,"kind": string,"payload": NonNullable<Json>,"processed_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"created_at"?: string,"event_id"?: string | null,"id"?: never,"kind": string,"payload"?: NonNullable<Json>,"processed_at"?: string | null
                  }
                  Update: {
                    "actor_id"?: string | null,"created_at"?: string,"event_id"?: string | null,"id"?: never,"kind"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_outbox_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"pitch_slots": {
                  Row: {
                    "club_id": string,"created_at": string,"end_time": string,"id": string,"pitch_id": string,"start_time": string,"valid_from": string,"valid_until": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"end_time": string,"id"?: string,"pitch_id": string,"start_time": string,"valid_from": string,"valid_until": string,"weekday": number
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"end_time"?: string,"id"?: string,"pitch_id"?: string,"start_time"?: string,"valid_from"?: string,"valid_until"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "pitch_slots_pitch_id_club_id_fkey"
      columns: ["pitch_id","club_id"]
isOneToOne: false
      referencedRelation: "pitches"
      referencedColumns: ["id","club_id"]
    }
                  ]
                },"pitches": {
                  Row: {
                    "club_id": string,"created_at": string,"id": string,"name": string,"sort_order": number,"splittable": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"id"?: string,"name": string,"sort_order"?: number,"splittable"?: boolean
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"id"?: string,"name"?: string,"sort_order"?: number,"splittable"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "pitches_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
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
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"locale": string,"p256dh": string,"user_agent": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"locale"?: string,"p256dh": string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"locale"?: string,"p256dh"?: string,"user_agent"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"slot_booking_exceptions": {
                  Row: {
                    "booking_id": string,"date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booking_id": string,"date": string
                  }
                  Update: {
                    "booking_id"?: string,"date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "slot_booking_exceptions_booking_id_fkey"
      columns: ["booking_id"]
isOneToOne: false
      referencedRelation: "slot_bookings"
      referencedColumns: ["id"]
    }
                  ]
                },"slot_bookings": {
                  Row: {
                    "club_id": string,"created_at": string,"created_by": string | null,"id": string,"part": Database["public"]['Enums']["pitch_part"],"slot_id": string,"team_id": string,"valid_from": string,"valid_until": string
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"part": Database["public"]['Enums']["pitch_part"],"slot_id": string,"team_id": string,"valid_from": string,"valid_until": string
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"part"?: Database["public"]['Enums']["pitch_part"],"slot_id"?: string,"team_id"?: string,"valid_from"?: string,"valid_until"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "slot_bookings_club_id_fkey"
      columns: ["club_id"]
isOneToOne: false
      referencedRelation: "clubs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "slot_bookings_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "slot_bookings_slot_id_fkey"
      columns: ["slot_id"]
isOneToOne: false
      referencedRelation: "pitch_slots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "slot_bookings_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_invites": {
                  Row: {
                    "created_at": string,"created_by": string | null,"expires_at": string,"id": string,"revoked_at": string | null,"role": Database["public"]['Enums']["team_role"],"team_id": string,"token": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"revoked_at"?: string | null,"role": Database["public"]['Enums']["team_role"],"team_id": string,"token"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["team_role"],"team_id"?: string,"token"?: string
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
                    "club_id": string,"created_at": string,"created_by": string | null,"id": string,"name": string,"season": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "club_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"season"?: string | null
                  }
                  Update: {
                    "club_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"season"?: string | null
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
"apply_absence":
{ Args: { "p_absence_id": string,"p_include_closed": boolean }; Returns: number
                           },
"book_slot":
{ Args: { "p_from": string,"p_part": Database["public"]['Enums']["pitch_part"],"p_slot_id": string,"p_team_id": string,"p_until"?: string }; Returns: Json
                           },
"booking_club_id":
{ Args: { "p_booking_id": string }; Returns: string
                           },
"claim_push_messages":
{ Args: { "p_limit"?: number }; Returns: {
              "auth": string,"endpoint": string,"event_id": string,"event_type": Database["public"]['Enums']["event_type"],"is_home": boolean,"kind": string,"locale": string,"location": string,"opponent": string,"outbox_id": number,"p256dh": string,"payload": Json,"starts_at": string,"subscription_id": string,"team_name": string
            }[]
                           },
"club_team_names":
{ Args: { "p_club_id": string }; Returns: {
              "id": string,"name": string
            }[]
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
"create_absences":
{ Args: { "p_ends_at": string,"p_member_ids": (string)[],"p_note"?: string,"p_reason": string,"p_starts_at": string }; Returns: number
                           },
"create_club":
{ Args: { "p_name": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"id": string,
"name": string,
"timezone": string
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
"delete_absence":
{ Args: { "p_absence_id": string }; Returns: undefined
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"drill_group_event_id":
{ Args: { "p_group_id": string }; Returns: string
                           },
"drill_video_path_valid":
{ Args: { "p_name": string }; Returns: boolean
                           },
"drill_video_team_id":
{ Args: { "p_name": string }; Returns: string
                           },
"end_slot_booking":
{ Args: { "p_booking_id": string,"p_from": string }; Returns: undefined
                           },
"enqueue_nomination":
{ Args: { "p_event_id": string,"p_member_ids": (string)[] }; Returns: undefined
                           },
"enqueue_series_notification":
{ Args: { "p_count": number,"p_first_event": string,"p_weekday": number }; Returns: undefined
                           },
"event_drill_event_id":
{ Args: { "p_event_drill_id": string }; Returns: string
                           },
"event_open_for_responses":
{ Args: { "p_event_id": string }; Returns: boolean
                           },
"event_plan_published":
{ Args: { "p_event_id": string }; Returns: boolean
                           },
"event_team_id":
{ Args: { "p_event_id": string }; Returns: string
                           },
"export_my_data":
{ Args: Record<PropertyKey, never>; Returns: Json
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
"release_slot_date":
{ Args: { "p_booking_id": string,"p_date": string }; Returns: undefined
                           },
"reorder_event_drills":
{ Args: { "p_event_id": string,"p_ids": (string)[] }; Returns: undefined
                           },
"request_test_push":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"save_push_subscription":
{ Args: { "p_auth": string,"p_endpoint": string,"p_locale"?: string,"p_p256dh": string,"p_user_agent"?: string }; Returns: undefined
                           },
"set_attendance":
{ Args: { "p_event_id": string,"p_member_id": string,"p_reason"?: string,"p_reason_note"?: string,"p_status": Database["public"]['Enums']["attendance_status"] }; Returns: {
              "created_at": string,
"event_id": string,
"id": string,
"member_id": string,
"reason": string | null,
"reason_note": string | null,
"source_absence_id": string | null,
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
"set_drill_groups":
{ Args: { "p_event_drill_id": string,"p_groups": Json }; Returns: undefined
                           },
"set_match_squad":
{ Args: { "p_entries": Json,"p_event_id": string }; Returns: undefined
                           },
"shares_club_with":
{ Args: { "p_user_id": string }; Returns: boolean
                           },
"team_club_id":
{ Args: { "p_team_id": string }; Returns: string
                           },
"team_member_stats":
{ Args: { "p_from": string,"p_team_id": string,"p_to": string }; Returns: {
              "answered": number,"bench": number,"decline_reasons": Json,"display_name": string,"events_total": number,"matches_total": number,"matches_yes": number,"member_id": string,"reserve": number,"role": Database["public"]['Enums']["team_role"],"starter": number,"training_minutes": number,"trainings_maybe": number,"trainings_no": number,"trainings_total": number,"trainings_yes": number,"user_id": string
            }[]
                           },
"team_training_attendance":
{ Args: { "p_from": string,"p_team_id": string,"p_to": string }; Returns: {
              "event_id": string,"maybe_count": number,"no_count": number,"players": number,"starts_at": string,"yes_count": number
            }[]
                           }
          }
          Enums: {
            "attendance_status": "yes"|"no"|"maybe","club_role": "admin"|"member","event_type": "training"|"match","member_status": "active"|"injured"|"inactive","pitch_part": "full"|"a"|"b","plan_status": "draft"|"published","squad_role": "starter"|"bench"|"reserve","team_role": "coach"|"player"
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
            "attendance_status": ["yes", "no", "maybe"],"club_role": ["admin", "member"],"event_type": ["training", "match"],"member_status": ["active", "injured", "inactive"],"pitch_part": ["full", "a", "b"],"plan_status": ["draft", "published"],"squad_role": ["starter", "bench", "reserve"],"team_role": ["coach", "player"]
          }
        }
} as const
