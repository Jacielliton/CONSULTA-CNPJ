"use client";
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import Cookies from 'js-cookie';
import { useEffect, useState } from 'react';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState<string | null>(null);

  // Verifica se está logado ao carregar
  useEffect(() => {
    const user = Cookies.get('user_name');
    if (user) setUserName(user);
  }, [pathname]);

  const handleLogout = () => {
    Cookies.remove('auth_token');
    Cookies.remove('user_name');
    setUserName(null);
    router.push('/login');
  };

  // Não exibe header nas páginas de auth
  if (pathname === '/login' || pathname === '/cadastro') return null;

  return (
    <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
      <div className="flex items-center gap-8">
        <Link href="/" className="text-xl font-extrabold text-blue-800 tracking-tight flex items-center gap-2">
          🚀 Plataforma<span className="text-gray-600">CNPJ</span>
        </Link>
        
        {userName && (
          <nav className="hidden md:flex gap-6 text-sm font-medium text-gray-600">
            <Link href="/" className={`hover:text-blue-600 ${pathname === '/' ? 'text-blue-600' : ''}`}>Dashboard</Link>
            <Link href="/consulta-simples" className={`hover:text-blue-600 ${pathname.includes('consulta') ? 'text-blue-600' : ''}`}>Consulta Simples</Link>
            <Link href="/pesquisa-avancada" className={`hover:text-blue-600 ${pathname.includes('pesquisa') ? 'text-blue-600' : ''}`}>Avançada</Link>
            <Link href="/licitacoes" className={`hover:text-blue-600 ${pathname.includes('licitacoes') ? 'text-blue-600' : ''}`}>Licitações</Link>
          </nav>
        )}
      </div>

      <div className="flex items-center gap-4">
        {userName ? (
          <>
            <span className="text-sm text-gray-500 hidden sm:inline">Olá, <strong>{userName}</strong></span>
            <button 
              onClick={handleLogout}
              className="text-sm text-red-600 hover:text-red-800 font-medium border border-red-200 px-3 py-1 rounded hover:bg-red-50 transition"
            >
              Sair
            </button>
          </>
        ) : (
          <Link href="/login" className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-blue-700">
            Entrar
          </Link>
        )}
      </div>
    </header>
  );
}