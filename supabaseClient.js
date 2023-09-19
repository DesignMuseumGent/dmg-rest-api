import { createClient } from '@supabase/supabase-js'

import * as dotenv from 'dotenv'
dotenv.config()

const SUPABASE_URL = "https://nrjxejxbxniijbmquudy.supabase.co"
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yanhlanhieG5paWpibXF1dWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzQzMDU2NDQsImV4cCI6MTk4OTg4MTY0NH0.tW3zAV2znP6aXpRD0MZHSH4Q82H4_VYGAIWGhzVyAk8"

//const SUPABASE_URL = process.env.SUPABASE_URL
//const SUPABASE_KEY = process.env.SUPABASE_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
