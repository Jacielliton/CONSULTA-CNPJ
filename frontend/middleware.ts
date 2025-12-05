import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value
  const isAdmin = request.cookies.get('is_admin')?.value === "true"
  const path = request.nextUrl.pathname

  const publicRoutes = ['/login', '/cadastro'];

  // 1. Redireciona usuário logado tentando acessar login
  if (publicRoutes.includes(path) && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // 2. Bloqueia acesso sem login
  if (!publicRoutes.includes(path) && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 3. BLOQUEIO DE ADMIN: Se tentar acessar /admin* sem ser admin
  if (path.startsWith('/admin') && !isAdmin) {
    // Redireciona usuário comum para o dashboard com aviso (opcional)
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
}