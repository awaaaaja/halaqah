import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '@/lib/supabase'

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/auth/LoginView.vue'),
    meta: { layout: 'auth' }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/auth/RegisterView.vue'),
    meta: { layout: 'auth' }
  },
  {
    path: '/pending',
    name: 'Pending',
    component: () => import('@/views/auth/PendingView.vue'),
    meta: { layout: 'auth' }
  },
  {
    path: '/qr-saya',
    name: 'QrSaya',
    component: () => import('@/views/user/QrSayaView.vue'),
    meta: { requiresAuth: true, role: 'user' }
  },
  {
    path: '/riwayat',
    name: 'RiwayatUser',
    component: () => import('@/views/user/RiwayatView.vue'),
    meta: { requiresAuth: true, role: 'user' }
  },
  {
    path: '/profil',
    name: 'ProfilUser',
    component: () => import('@/views/user/ProfilView.vue'),
    meta: { requiresAuth: true, role: 'user' }
  },
  {
    path: '/beranda',
    name: 'Beranda',
    component: () => import('@/views/admin/BerandaView.vue'),
    meta: { requiresAuth: true, role: 'admin' }
  },
  {
    path: '/scan-absen',
    name: 'ScanAbsen',
    component: () => import('@/views/admin/ScanAbsenView.vue'),
    meta: { requiresAuth: true, role: 'admin' }
  },
  {
    path: '/tambah-anggota',
    name: 'TambahAnggota',
    component: () => import('@/views/admin/TambahAnggotaView.vue'),
    meta: { requiresAuth: true, role: 'admin' }
  },
  {
    path: '/anggota-saya',
    name: 'AnggotaSaya',
    component: () => import('@/views/admin/AnggotaSayaView.vue'),
    meta: { requiresAuth: true, role: 'admin' }
  },
  {
    path: '/riwayat-sesi',
    name: 'RiwayatSesi',
    component: () => import('@/views/admin/RiwayatSesiView.vue'),
    meta: { requiresAuth: true, role: 'admin' }
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/super-admin/DashboardView.vue'),
    meta: { requiresAuth: true, role: 'super_admin' }
  },
  {
    path: '/dashboard/murabbi',
    name: 'KelolaMurabbi',
    component: () => import('@/views/super-admin/KelolaMurabbiView.vue'),
    meta: { requiresAuth: true, role: 'super_admin' }
  },
  {
    path: '/dashboard/kelompok',
    name: 'KelolaKelompok',
    component: () => import('@/views/super-admin/KelolaKelompokView.vue'),
    meta: { requiresAuth: true, role: 'super_admin' }
  },
  {
    path: '/dashboard/akun',
    name: 'KelolaAkun',
    component: () => import('@/views/super-admin/KelolaAkunView.vue'),
    meta: { requiresAuth: true, role: 'super_admin' }
  },
  {
    path: '/dashboard/approval',
    name: 'ApprovalAnggota',
    component: () => import('@/views/super-admin/ApprovalAnggotaView.vue'),
    meta: { requiresAuth: true, role: 'super_admin' }
  },
  {
    path: '/dashboard/laporan',
    name: 'Laporan',
    component: () => import('@/views/super-admin/LaporanView.vue'),
    meta: { requiresAuth: true, role: 'super_admin' }
  },
  {
    path: '/dashboard/pengaturan',
    name: 'Pengaturan',
    component: () => import('@/views/super-admin/PengaturanView.vue'),
    meta: { requiresAuth: true, role: 'super_admin' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, from, next) => {
  const { data: { session } } = await supabase.auth.getSession()

  if (to.meta.requiresAuth && !session) {
    return next('/login')
  }

  if (session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status_akun')
      .eq('id', session.user.id)
      .maybeSingle()

    const redirectMap = {
      user: '/qr-saya',
      admin: '/beranda',
      super_admin: '/dashboard'
    }

    if (!profile) {
      await supabase.auth.signOut()
      return next('/login')
    }

    if (profile.status_akun === 'pending') {
      if (to.path !== '/pending' && to.path !== '/login' && to.path !== '/register') {
        return next('/pending')
      }
      return next()
    }

    if (profile.status_akun === 'nonaktif') {
      await supabase.auth.signOut()
      return next('/login')
    }

    if (to.path === '/login' || to.path === '/register' || to.path === '/pending') {
      return next(redirectMap[profile.role] || '/login')
    }

    if (to.meta.role && profile.role !== to.meta.role) {
      return next(redirectMap[profile.role] || '/login')
    }
  }

  next()
})

export default router
