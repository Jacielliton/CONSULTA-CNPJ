import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Pega o token dos cookies
  const token = request.cookies.get('auth_token')?.value

  // Rotas que NÃO precisam de login (públicas)
  const publicRoutes = ['/login', '/cadastro'];
  
  // Se o usuário tentar acessar rota pública mas JÁ tiver token, manda pro Dashboard
  if (publicRoutes.includes(request.nextUrl.pathname) && token) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Se o usuário NÃO tiver token e tentar acessar rota protegida (qualquer uma que não seja publica)
  if (!publicRoutes.includes(request.nextUrl.pathname) && !token) {
    // Redireciona para login
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

// Configura em quais rotas o middleware roda
export const config = {
  matcher: [
    /*
     * Aplica em todas as rotas, EXCETO:
     * - api (rotas de API do Next)
     * - _next/static (arquivos estáticos)
     * - _next/image (imagens otimizadas)
     * - favicon.ico (ícone)
     * - public files (svg, png, etc)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg).*)',
  ],
}