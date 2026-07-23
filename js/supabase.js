// CDN을 통해 Supabase 라이브러리를 가져옵니다.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Supabase 프로젝트 대시보드에서 복사해 온 URL과 anon key
const supabaseUrl = 'https://twdvycpjpglyefqiloef.supabase.co'
const supabaseKey = 'sb_publishable_A7B6ZbGcRlVRq2YQzISo1g_0YWJ-08U'

// supabase 객체를 생성하고 외부에서 쓸 수 있게 내보냅니다(export)
export const supabase = createClient(supabaseUrl, supabaseKey)