"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';

export default function Dashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // 1. Verifica se está logado
    const token = Cookies.get('auth_token');
    setIsLoggedIn(!!token);

    // 2. Verifica se é admin (cookie definido no login)
    const adminCookie = Cookies.get('is_admin');
    if (adminCookie === 'true') {
      setIsAdmin(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative">
      
      {/* NAVEGAÇÃO SUPERIOR (Botões Condicionais) */}
      <div className="absolute top-6 right-6 z-10 flex gap-3">
        {isAdmin && (
          <Link 
            href="/admin" 
            className="flex items-center gap-2 text-slate-600 hover:text-blue-700 font-bold text-sm bg-white border border-slate-200 px-4 py-2 rounded-lg shadow-sm transition hover:shadow-md"
          >
            ⚙️ Painel Admin
          </Link>
        )}
        
        {!isLoggedIn ? (
          <Link 
            href="/login" 
            className="flex items-center gap-2 text-white bg-blue-600 hover:bg-blue-700 font-bold text-sm px-5 py-2 rounded-lg shadow-md transition"
          >
            Entrar
          </Link>
        ) : (
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500 bg-white px-4 py-2 rounded-lg border border-slate-100">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Conectado
          </div>
        )}
      </div>

      {/* CABEÇALHO */}
      <div className="text-center mb-16 max-w-3xl">
        <h1 className="text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">
          Plataforma de <span className="text-blue-600">Inteligência</span>
        </h1>
        <p className="text-lg text-slate-500 leading-relaxed">
          Central unificada para análise de dados empresariais (CNPJ) e monitoramento estratégico de licitações públicas no estado do Maranhão.
        </p>
      </div>

      {/* GRID DE FERRAMENTAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl w-full px-4">
        
        {/* CARD 1: BUSCA SIMPLES */}
        <Link href="/consulta-simples" className="group h-full">
          <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border border-slate-200 transition-all duration-300 transform hover:-translate-y-1 h-full flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
            
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 text-3xl shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
              🔍
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 mb-3 group-hover:text-blue-600 transition-colors">
              Consulta Rápida
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed flex-grow">
              Verificação ágil de empresas por Nome, Razão Social ou CNPJ. Ideal para validações cadastrais instantâneas.
            </p>
            
            <div className="mt-8 flex items-center text-blue-600 font-bold text-sm group-hover:gap-2 transition-all">
              Acessar Ferramenta <span>→</span>
            </div>
          </div>
        </Link>

        {/* CARD 2: BUSCA AVANÇADA */}
        <Link href="/pesquisa-avancada" className="group h-full">
          <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border border-slate-200 transition-all duration-300 transform hover:-translate-y-1 h-full flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-purple-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
            
            <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6 text-3xl shadow-inner group-hover:bg-purple-600 group-hover:text-white transition-colors duration-300">
              🔬
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 mb-3 group-hover:text-purple-600 transition-colors">
              Consulta Avançada
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed flex-grow">
              Filtros granulares por Capital Social, Localização (Cidade/UF), Status e Data. Gere relatórios completos em CSV/Excel.
            </p>
            
            <div className="mt-8 flex items-center text-purple-600 font-bold text-sm group-hover:gap-2 transition-all">
              Acessar Ferramenta <span>→</span>
            </div>
          </div>
        </Link>

        {/* CARD 3: LICITAÇÕES */}
        <Link href="/licitacoes" className="group h-full">
          <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border border-slate-200 transition-all duration-300 transform hover:-translate-y-1 h-full flex flex-col relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300"></div>
            
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 text-3xl shadow-inner group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
              📜
            </div>
            
            <h2 className="text-2xl font-bold text-slate-800 mb-3 group-hover:text-emerald-600 transition-colors">
              Licitações MA
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed flex-grow">
              Monitoramento em tempo real de pregões e editais no Mural do TCE-MA e Diário Oficial da FAMEM.
            </p>
            
            <div className="mt-8 flex items-center text-emerald-600 font-bold text-sm group-hover:gap-2 transition-all">
              Acessar Ferramenta <span>→</span>
            </div>
          </div>
        </Link>

      </div>

      {/* FOOTER SIMPLES */}
      <div className="mt-20 text-center border-t border-slate-200 pt-8 w-full max-w-4xl">
        <p className="text-slate-400 text-sm">
          © {new Date().getFullYear()} Plataforma de Dados. Todos os direitos reservados.
        </p>
      </div>

    </div>
  );
}