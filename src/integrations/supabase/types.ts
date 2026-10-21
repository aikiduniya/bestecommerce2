export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: number
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: number
        }
        Relationships: []
      }
      addresses: {
        Row: {
          city: string
          country: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          line1: string
          line2: string | null
          phone: string | null
          postal: string | null
          state: string | null
          user_id: string
        }
        Insert: {
          city: string
          country: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          line1: string
          line2?: string | null
          phone?: string | null
          postal?: string | null
          state?: string | null
          user_id: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          line1?: string
          line2?: string | null
          phone?: string | null
          postal?: string | null
          state?: string | null
          user_id?: string
        }
        Relationships: []
      }
      automatic_discounts: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          kind: string
          name: string
          priority: number
          scope: string
          starts_at: string | null
          target_id: string | null
          value: number
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind: string
          name: string
          priority?: number
          scope?: string
          starts_at?: string | null
          target_id?: string | null
          value: number
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          priority?: number
          scope?: string
          starts_at?: string | null
          target_id?: string | null
          value?: number
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author: string | null
          body: string
          cover_image: string | null
          created_at: string
          excerpt: string | null
          id: string
          is_published: boolean
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          body?: string
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          body?: string
          cover_image?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      cart_snapshots: {
        Row: {
          email: string
          id: string
          items: Json
          recovered_order_id: string | null
          subtotal: number
          updated_at: string
          user_id: string
        }
        Insert: {
          email: string
          id?: string
          items?: Json
          recovered_order_id?: string | null
          subtotal?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          email?: string
          id?: string
          items?: Json
          recovered_order_id?: string | null
          subtotal?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          show_on_home: boolean
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          show_on_home?: boolean
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          show_on_home?: boolean
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      content_translations: {
        Row: {
          entity_id: string
          entity_type: string
          fields: Json
          id: string
          lang: string
          updated_at: string
        }
        Insert: {
          entity_id: string
          entity_type: string
          fields?: Json
          id?: string
          lang: string
          updated_at?: string
        }
        Update: {
          entity_id?: string
          entity_type?: string
          fields?: Json
          id?: string
          lang?: string
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          kind: string
          max_uses: number | null
          min_subtotal: number | null
          per_user_limit: number | null
          starts_at: string | null
          used_count: number
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          max_uses?: number | null
          min_subtotal?: number | null
          per_user_limit?: number | null
          starts_at?: string | null
          used_count?: number
          value?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          max_uses?: number | null
          min_subtotal?: number | null
          per_user_limit?: number | null
          starts_at?: string | null
          used_count?: number
          value?: number
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          attempts: number
          created_at: string
          error: string | null
          event: string | null
          id: number
          last_attempt_at: string | null
          payload: Json
          recipient_email: string
          status: string
          subject: string
          template_key: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          error?: string | null
          event?: string | null
          id?: never
          last_attempt_at?: string | null
          payload?: Json
          recipient_email: string
          status: string
          subject: string
          template_key?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          error?: string | null
          event?: string | null
          id?: never
          last_attempt_at?: string | null
          payload?: Json
          recipient_email?: string
          status?: string
          subject?: string
          template_key?: string | null
        }
        Relationships: []
      }
      email_settings: {
        Row: {
          brand_color: string | null
          brand_logo_url: string | null
          delivery_enabled: boolean
          footer_text: string | null
          id: number
          provider: string
          provider_config: Json
          reply_to: string | null
          sender_email: string
          sender_name: string
          updated_at: string
        }
        Insert: {
          brand_color?: string | null
          brand_logo_url?: string | null
          delivery_enabled?: boolean
          footer_text?: string | null
          id?: number
          provider?: string
          provider_config?: Json
          reply_to?: string | null
          sender_email?: string
          sender_name?: string
          updated_at?: string
        }
        Update: {
          brand_color?: string | null
          brand_logo_url?: string | null
          delivery_enabled?: boolean
          footer_text?: string | null
          id?: number
          provider?: string
          provider_config?: Json
          reply_to?: string | null
          sender_email?: string
          sender_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          is_enabled: boolean
          key: string
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          key: string
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          key?: string
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      gift_cards: {
        Row: {
          balance: number
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          initial_balance: number
          is_active: boolean
          note: string | null
        }
        Insert: {
          balance: number
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          initial_balance: number
          is_active?: boolean
          note?: string | null
        }
        Update: {
          balance?: number
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          initial_balance?: number
          is_active?: boolean
          note?: string | null
        }
        Relationships: []
      }
      homepage_sections: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_enabled: boolean
          sort_order: number
          subtitle: string | null
          title: string | null
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          created_at: string
          id: number
          kind: string
          note: string | null
          order_id: string | null
          points: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          kind: string
          note?: string | null
          order_id?: string | null
          points: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          kind?: string
          note?: string | null
          order_id?: string | null
          points?: number
          user_id?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          created_at: string
          created_by: string | null
          filename: string | null
          id: string
          mime_type: string | null
          path: string
          size_bytes: number | null
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          filename?: string | null
          id?: string
          mime_type?: string | null
          path: string
          size_bytes?: number | null
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          filename?: string | null
          id?: string
          mime_type?: string | null
          path?: string
          size_bytes?: number | null
          url?: string
        }
        Relationships: []
      }
      navigation_menus: {
        Row: {
          handle: string
          id: string
          items: Json
          updated_at: string
        }
        Insert: {
          handle: string
          id?: string
          items?: Json
          updated_at?: string
        }
        Update: {
          handle?: string
          id?: string
          items?: Json
          updated_at?: string
        }
        Relationships: []
      }
      notification_rules: {
        Row: {
          created_at: string
          event: string
          id: string
          is_enabled: boolean
          recipient: string
          template_key: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          is_enabled?: boolean
          recipient?: string
          template_key?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          is_enabled?: boolean
          recipient?: string
          template_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_template_key_fkey"
            columns: ["template_key"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["key"]
          },
        ]
      }
      order_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: number
          kind: string
          message: string
          order_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: never
          kind?: string
          message: string
          order_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: never
          kind?: string
          message?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: number
          order_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: never
          order_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: never
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          auto_discount_name: string | null
          auto_discount_total: number
          cod_collected_at: string | null
          cod_confirmed_at: string | null
          coupon_code: string | null
          created_at: string
          currency: string
          customer_email: string
          customer_name: string
          customer_phone: string | null
          discount_total: number
          fulfillment_status: string
          gift_card_applied: number
          gift_card_code: string | null
          guest_token: string | null
          id: string
          items: Json
          notes: string | null
          order_number: number
          payment_fee: number
          payment_method: string
          payment_status: string
          points_discount: number
          points_redeemed: number
          shipping_address: Json
          shipping_total: number
          shipping_zone_id: string | null
          status: string
          stock_restored: boolean
          subtotal: number
          tax_total: number
          total: number
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          auto_discount_name?: string | null
          auto_discount_total?: number
          cod_collected_at?: string | null
          cod_confirmed_at?: string | null
          coupon_code?: string | null
          created_at?: string
          currency?: string
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          discount_total?: number
          fulfillment_status?: string
          gift_card_applied?: number
          gift_card_code?: string | null
          guest_token?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_number?: never
          payment_fee?: number
          payment_method?: string
          payment_status?: string
          points_discount?: number
          points_redeemed?: number
          shipping_address?: Json
          shipping_total?: number
          shipping_zone_id?: string | null
          status?: string
          stock_restored?: boolean
          subtotal?: number
          tax_total?: number
          total?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          auto_discount_name?: string | null
          auto_discount_total?: number
          cod_collected_at?: string | null
          cod_confirmed_at?: string | null
          coupon_code?: string | null
          created_at?: string
          currency?: string
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          discount_total?: number
          fulfillment_status?: string
          gift_card_applied?: number
          gift_card_code?: string | null
          guest_token?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_number?: never
          payment_fee?: number
          payment_method?: string
          payment_status?: string
          points_discount?: number
          points_redeemed?: number
          shipping_address?: Json
          shipping_total?: number
          shipping_zone_id?: string | null
          status?: string
          stock_restored?: boolean
          subtotal?: number
          tax_total?: number
          total?: number
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_shipping_zone_id_fkey"
            columns: ["shipping_zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          body: string
          created_at: string
          id: string
          is_published: boolean
          seo_description: string | null
          seo_title: string | null
          show_in_footer: boolean
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          is_published?: boolean
          seo_description?: string | null
          seo_title?: string | null
          show_in_footer?: boolean
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_published?: boolean
          seo_description?: string | null
          seo_title?: string | null
          show_in_footer?: boolean
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_collections: {
        Row: {
          collection_id: string
          product_id: string
        }
        Insert: {
          collection_id: string
          product_id: string
        }
        Update: {
          collection_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_collections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_collections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_costs: {
        Row: {
          cost_price: number | null
          product_id: string
          updated_at: string
        }
        Insert: {
          cost_price?: number | null
          product_id: string
          updated_at?: string
        }
        Update: {
          cost_price?: number | null
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          author_name: string
          created_at: string
          id: string
          product_id: string
          question: string
          status: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          author_name: string
          created_at?: string
          id?: string
          product_id: string
          question: string
          status?: string
          user_id: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          author_name?: string
          created_at?: string
          id?: string
          product_id?: string
          question?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_questions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          compare_at_price: number | null
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          options: Json
          price: number | null
          product_id: string
          sale_price: number | null
          sku: string | null
          sort_order: number
          stock: number
        }
        Insert: {
          compare_at_price?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          options?: Json
          price?: number | null
          product_id: string
          sale_price?: number | null
          sku?: string | null
          sort_order?: number
          stock?: number
        }
        Update: {
          compare_at_price?: number | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          options?: Json
          price?: number | null
          product_id?: string
          sale_price?: number | null
          sku?: string | null
          sort_order?: number
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand_id: string | null
          category_id: string | null
          cod_allowed: boolean
          compare_at_price: number | null
          cost_price: number | null
          created_at: string
          description: string | null
          id: string
          images: string[]
          is_featured: boolean
          low_stock_threshold: number
          name: string
          options: Json
          price: number
          related_ids: string[]
          sale_ends_at: string | null
          sale_price: number | null
          sale_starts_at: string | null
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
          sku: string | null
          slug: string
          specifications: Json
          status: string
          stock: number
          tags: string[]
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          barcode?: string | null
          brand_id?: string | null
          category_id?: string | null
          cod_allowed?: boolean
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[]
          is_featured?: boolean
          low_stock_threshold?: number
          name: string
          options?: Json
          price?: number
          related_ids?: string[]
          sale_ends_at?: string | null
          sale_price?: number | null
          sale_starts_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku?: string | null
          slug: string
          specifications?: Json
          status?: string
          stock?: number
          tags?: string[]
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          barcode?: string | null
          brand_id?: string | null
          category_id?: string | null
          cod_allowed?: boolean
          compare_at_price?: number | null
          cost_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          images?: string[]
          is_featured?: boolean
          low_stock_threshold?: number
          name?: string
          options?: Json
          price?: number
          related_ids?: string[]
          sale_ends_at?: string | null
          sale_price?: number | null
          sale_starts_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          sku?: string | null
          slug?: string
          specifications?: Json
          status?: string
          stock?: number
          tags?: string[]
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      redirects: {
        Row: {
          created_at: string
          from_path: string
          hits: number
          id: string
          is_active: boolean
          status_code: number
          to_path: string
        }
        Insert: {
          created_at?: string
          from_path: string
          hits?: number
          id?: string
          is_active?: boolean
          status_code?: number
          to_path: string
        }
        Update: {
          created_at?: string
          from_path?: string
          hits?: number
          id?: string
          is_active?: boolean
          status_code?: number
          to_path?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_uses: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          referee_id: string
          referrer_id: string
          rewarded: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          referee_id: string
          referrer_id: string
          rewarded?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          referee_id?: string
          referrer_id?: string
          rewarded?: boolean
        }
        Relationships: []
      }
      return_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          email: string
          id: string
          items: Json
          order_id: string
          reason: string
          restocked: boolean
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          email: string
          id?: string
          items?: Json
          order_id: string
          reason: string
          restocked?: boolean
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          email?: string
          id?: string
          items?: Json
          order_id?: string
          reason?: string
          restocked?: boolean
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_name: string
          body: string
          created_at: string
          id: string
          product_id: string
          rating: number
          status: string
          title: string | null
          user_id: string
          verified_purchase: boolean
        }
        Insert: {
          author_name: string
          body: string
          created_at?: string
          id?: string
          product_id: string
          rating: number
          status?: string
          title?: string | null
          user_id: string
          verified_purchase?: boolean
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          product_id?: string
          rating?: number
          status?: string
          title?: string | null
          user_id?: string
          verified_purchase?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_zones: {
        Row: {
          countries: string[]
          created_at: string
          estimated_days: string | null
          free_over: number | null
          id: string
          is_active: boolean
          name: string
          rate: number
          sort_order: number
        }
        Insert: {
          countries?: string[]
          created_at?: string
          estimated_days?: string | null
          free_over?: number | null
          id?: string
          is_active?: boolean
          name: string
          rate?: number
          sort_order?: number
        }
        Update: {
          countries?: string[]
          created_at?: string
          estimated_days?: string | null
          free_over?: number | null
          id?: string
          is_active?: boolean
          name?: string
          rate?: number
          sort_order?: number
        }
        Relationships: []
      }
      staff_members: {
        Row: {
          created_at: string
          email: string
          is_active: boolean
          staff_role_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          is_active?: boolean
          staff_role_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          is_active?: boolean
          staff_role_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_staff_role_id_fkey"
            columns: ["staff_role_id"]
            isOneToOne: false
            referencedRelation: "staff_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_roles: {
        Row: {
          created_at: string
          id: string
          name: string
          permissions: string[]
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          permissions?: string[]
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          permissions?: string[]
        }
        Relationships: []
      }
      stock_alerts: {
        Row: {
          created_at: string
          email: string
          id: string
          notified_at: string | null
          product_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notified_at?: string | null
          product_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notified_at?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          accent_color: string | null
          announcement: string | null
          announcement_enabled: boolean
          bing_site_verification: string | null
          cod_countries: string[]
          cod_enabled: boolean
          cod_excluded_zones: string[]
          cod_fee: number
          cod_max_order: number | null
          cod_min_order: number | null
          cod_requires_confirmation: boolean
          cookie_consent_enabled: boolean
          cookie_consent_text: string
          currencies: Json
          currency: string
          favicon_url: string | null
          font_body: string
          font_display: string
          ga4_id: string | null
          google_site_verification: string | null
          gtm_id: string | null
          hero_cta: string | null
          hero_eyebrow: string | null
          hero_image_url: string | null
          id: number
          languages: Json
          llms_txt: string | null
          logo_url: string | null
          loyalty_earn_rate: number
          loyalty_enabled: boolean
          loyalty_min_redeem: number
          loyalty_redeem_value: number
          maintenance_mode: boolean
          merchant_center_id: string | null
          meta_pixel_id: string | null
          og_image_url: string | null
          primary_color: string | null
          referral_enabled: boolean
          referral_reward_points: number
          reviews_enabled: boolean
          reviews_require_approval: boolean
          robots_txt: string | null
          seo_description: string | null
          seo_title: string | null
          store_name: string
          stripe_enabled: boolean
          support_email: string | null
          support_phone: string | null
          tagline: string | null
          tax_enabled: boolean
          tax_inclusive: boolean
          tax_label: string
          translations: Json
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          announcement?: string | null
          announcement_enabled?: boolean
          bing_site_verification?: string | null
          cod_countries?: string[]
          cod_enabled?: boolean
          cod_excluded_zones?: string[]
          cod_fee?: number
          cod_max_order?: number | null
          cod_min_order?: number | null
          cod_requires_confirmation?: boolean
          cookie_consent_enabled?: boolean
          cookie_consent_text?: string
          currencies?: Json
          currency?: string
          favicon_url?: string | null
          font_body?: string
          font_display?: string
          ga4_id?: string | null
          google_site_verification?: string | null
          gtm_id?: string | null
          hero_cta?: string | null
          hero_eyebrow?: string | null
          hero_image_url?: string | null
          id?: number
          languages?: Json
          llms_txt?: string | null
          logo_url?: string | null
          loyalty_earn_rate?: number
          loyalty_enabled?: boolean
          loyalty_min_redeem?: number
          loyalty_redeem_value?: number
          maintenance_mode?: boolean
          merchant_center_id?: string | null
          meta_pixel_id?: string | null
          og_image_url?: string | null
          primary_color?: string | null
          referral_enabled?: boolean
          referral_reward_points?: number
          reviews_enabled?: boolean
          reviews_require_approval?: boolean
          robots_txt?: string | null
          seo_description?: string | null
          seo_title?: string | null
          store_name?: string
          stripe_enabled?: boolean
          support_email?: string | null
          support_phone?: string | null
          tagline?: string | null
          tax_enabled?: boolean
          tax_inclusive?: boolean
          tax_label?: string
          translations?: Json
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          announcement?: string | null
          announcement_enabled?: boolean
          bing_site_verification?: string | null
          cod_countries?: string[]
          cod_enabled?: boolean
          cod_excluded_zones?: string[]
          cod_fee?: number
          cod_max_order?: number | null
          cod_min_order?: number | null
          cod_requires_confirmation?: boolean
          cookie_consent_enabled?: boolean
          cookie_consent_text?: string
          currencies?: Json
          currency?: string
          favicon_url?: string | null
          font_body?: string
          font_display?: string
          ga4_id?: string | null
          google_site_verification?: string | null
          gtm_id?: string | null
          hero_cta?: string | null
          hero_eyebrow?: string | null
          hero_image_url?: string | null
          id?: number
          languages?: Json
          llms_txt?: string | null
          logo_url?: string | null
          loyalty_earn_rate?: number
          loyalty_enabled?: boolean
          loyalty_min_redeem?: number
          loyalty_redeem_value?: number
          maintenance_mode?: boolean
          merchant_center_id?: string | null
          meta_pixel_id?: string | null
          og_image_url?: string | null
          primary_color?: string | null
          referral_enabled?: boolean
          referral_reward_points?: number
          reviews_enabled?: boolean
          reviews_require_approval?: boolean
          robots_txt?: string | null
          seo_description?: string | null
          seo_title?: string | null
          store_name?: string
          stripe_enabled?: boolean
          support_email?: string | null
          support_phone?: string | null
          tagline?: string | null
          tax_enabled?: boolean
          tax_inclusive?: boolean
          tax_label?: string
          translations?: Json
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          created_at: string
          email: string
          id: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tax_rates: {
        Row: {
          applies_to_shipping: boolean
          country: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          priority: number
          rate: number
        }
        Insert: {
          applies_to_shipping?: boolean
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          rate?: number
        }
        Update: {
          applies_to_shipping?: boolean
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          rate?: number
        }
        Relationships: []
      }
      ticket_messages: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          is_staff: boolean
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_staff?: boolean
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_staff?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_staff: {
        Args: {
          _active: boolean
          _email: string
          _role: string
          _staff_role_id: string
        }
        Returns: string
      }
      apply_referral_code: { Args: { _code: string }; Returns: boolean }
      automatic_discount: {
        Args: { _items: Json; _subtotal: number }
        Returns: Json
      }
      best_seller_ids: {
        Args: { _limit?: number }
        Returns: {
          product_id: string
        }[]
      }
      check_automatic_discount: {
        Args: { _items: Json; _subtotal: number }
        Returns: Json
      }
      check_coupon: {
        Args: { _code: string; _subtotal: number }
        Returns: Json
      }
      check_gift_card: { Args: { _code: string }; Returns: Json }
      coupon_discount: {
        Args: { _code: string; _ship: number; _subtotal: number; _uid: string }
        Returns: Json
      }
      effective_price: {
        Args: {
          _ends: string
          _price: number
          _sale_price: number
          _starts: string
          _v_price?: number
          _v_sale_price?: number
        }
        Returns: number
      }
      has_permission: {
        Args: { _perm: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      my_referral_code: { Args: never; Returns: string }
      place_order: {
        Args: {
          _address: Json
          _coupon?: string
          _customer: Json
          _gift_card?: string
          _items: Json
          _notes?: string
          _points?: number
          _zone_id: string
        }
        Returns: Json
      }
      process_return: {
        Args: { _action: string; _id: string; _note: string; _restock: boolean }
        Returns: Json
      }
      submit_return: {
        Args: {
          _email: string
          _items: Json
          _order_number: number
          _reason: string
        }
        Returns: Json
      }
      track_guest_order: {
        Args: { _email: string; _order_number: number }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "customer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff", "customer"],
    },
  },
} as const
