import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = Deno.env.get("SUPABASE_URL")!
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: cors() })
    }

    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405)
    }

    const authHeader = req.headers.get("Authorization") || ""
    const jwt = authHeader.replace("Bearer ", "")

    if (!jwt) {
      return json({ error: "Missing Authorization header" }, 401)
    }

    // Verify caller JWT using admin client (service_role bypasses auth)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    const { data: { user: caller }, error: authErr } = await adminClient.auth.getUser(jwt)

    if (authErr || !caller) {
      return json({ error: "Unauthorized: " + (authErr?.message || "unknown") }, 401)
    }

    const { data: profile, error: profileErr } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single()

    if (profileErr || profile?.role !== "super_admin") {
      return json({ error: "Forbidden: only super_admin can use this function" }, 403)
    }

    const rawBody = await req.text()
    let body
    try {
      body = JSON.parse(rawBody)
    } catch (_) {
      return json({ error: "Invalid JSON body" }, 400)
    }
    const action = body._action || "create"

    if (action === "create") {
      return handleCreate(body, adminClient)
    }

    if (action === "update") {
      return handleUpdate(body, adminClient)
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (e) {
    return json({ error: "Internal error: " + (e?.message || e) }, 500)
  }
})

async function handleCreate(body, adminClient) {
  const { email, password, nama, nim, prodi, kelas, angkatan, no_hp, role, group_id } = body

  if (!email || !password || !nama || !role) {
    return json({ error: "Missing required fields: email, password, nama, role" }, 400)
  }

  const validRoles = ["user", "admin", "super_admin"]
  if (!validRoles.includes(role)) {
    return json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` }, 400)
  }

  if (password.length < 6) {
    return json({ error: "Password must be at least 6 characters" }, 400)
  }

  const { data: authUser, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nama },
  })

  if (createErr) {
    return json({ error: createErr.message }, 400)
  }

  // Trigger handle_new_user sudah insert row ke profiles(id, nama, email).
  // Kita UPDATE row tersebut dengan data tambahan.
  const { data: newProfile, error: updateErr } = await adminClient
    .from("profiles")
    .update({
      nama,
      nim: nim || null,
      prodi: prodi || null,
      kelas: kelas || null,
      angkatan: angkatan || null,
      no_hp: no_hp || null,
      role,
      group_id: group_id || null,
      status_akun: "aktif",
    })
    .eq("id", authUser.user.id)
    .select()
    .single()

  if (updateErr) {
    await adminClient.auth.admin.deleteUser(authUser.user.id)
    return json({ error: updateErr.message }, 400)
  }

  return json({ success: true, user_id: authUser.user.id, profile: newProfile })
}

async function handleUpdate(body, adminClient) {
  const { user_id, nama, nim, prodi, kelas, angkatan, no_hp, role, group_id, status_akun } = body

  if (!user_id) {
    return json({ error: "Missing required field: user_id" }, 400)
  }

  const payload = {}
  if (nama !== undefined) payload.nama = nama
  if (nim !== undefined) payload.nim = nim || null
  if (prodi !== undefined) payload.prodi = prodi || null
  if (kelas !== undefined) payload.kelas = kelas || null
  if (angkatan !== undefined) payload.angkatan = angkatan || null
  if (no_hp !== undefined) payload.no_hp = no_hp || null
  if (role !== undefined) {
    const validRoles = ["user", "admin", "super_admin"]
    if (!validRoles.includes(role)) {
      return json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` }, 400)
    }
    payload.role = role
  }
  // Only update group_id if it's a valid UUID — empty string or null means "preserve existing"
  // To explicitly remove from group, send group_id: null (not empty string)
  if (group_id !== undefined && group_id !== null && group_id !== '' && typeof group_id === 'string' && group_id.length > 0) {
    payload.group_id = group_id
  }
  if (status_akun !== undefined) {
    const validStatuses = ["pending", "aktif", "nonaktif"]
    if (!validStatuses.includes(status_akun)) {
      return json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, 400)
    }
    payload.status_akun = status_akun
  }

  if (Object.keys(payload).length === 0) {
    return json({ error: "No fields to update" }, 400)
  }

  const { data: updatedProfile, error: updateErr } = await adminClient
    .from("profiles")
    .update(payload)
    .eq("id", user_id)
    .select()
    .single()

  if (updateErr) {
    return json({ error: updateErr.message }, 400)
  }

  return json({ success: true, profile: updatedProfile })
}

function json(data, status = 200) {
  return Response.json(data, { status, headers: cors() })
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  }
}
