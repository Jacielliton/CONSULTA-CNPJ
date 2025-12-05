"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Verifica cookie para exibir botão admin
    const checkAdmin = () => {
      const adminCookie = document.cookie.split('; ').find(row => row.startsWith('is_admin='));
      if (adminCookie && adminCookie.split('=')[1] === 'true') {
        setIsAdmin(true);
      }
    };
    checkAdmin();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 relative">
      
      {/* Botão Admin (Só aparece se logado como Admin) */}
      {isAdmin && (
        <div className="absolute top-4 right-4 z-10">
          <Link 
            href="/admin" 
            className="flex items-center gap-2 text-gray-500 hover:text-blue-700 font-medium transition px-3 py-2 rounded hover:bg-gray-100"
          >
            ⚙️ Painel Admin
          </Link>
        </div>
      )}

      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-blue-900 mb-4">Plataforma de Inteligência</h1>
        <p className="text-gray-600 max-w-xl mx-auto">
          Central unificada para consulta de empresas (CNPJ) e monitoramento de licitações públicas no estado do Maranhão.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full">
        
        {/* CARD 1: BUSCA SIMPLES */}
        <Link href="/consulta-simples" className="group">
          <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border border-gray-200 transition-all transform hover:-translate-y-1 h-full flex flex-col">
            <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6 text-2xl">
              🔍
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-3 group-hover:text-blue-600 transition">Consulta CNPJ Rápida</h2>
            <p className="text-gray-500 text-sm flex-grow">
              Pesquise empresas por nome, razão social ou número do CNPJ. Ideal para verificações rápidas de status cadastral.
            </p>
            <span className="text-blue-600 font-semibold text-sm mt-6 flex items-center gap-2">
              Acessar Ferramenta →
            </span>
          </div>
        </Link>

        {/* CARD 2: BUSCA AVANÇADA */}
        <Link href="/pesquisa-avancada" className="group">
          <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border border-gray-200 transition-all transform hover:-translate-y-1 h-full flex flex-col">
            <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center mb-6 text-2xl">
              🔬
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-3 group-hover:text-purple-600 transition">Consulta Avançada</h2>
            <p className="text-gray-500 text-sm flex-grow">
              Filtros detalhados por Capital Social, Cidade, Situação Cadastral e CNAE. Exportação completa para Excel/CSV.
            </p>
            <span className="text-purple-600 font-semibold text-sm mt-6 flex items-center gap-2">
              Acessar Ferramenta →
            </span>
          </div>
        </Link>

        {/* CARD 3: LICITAÇÕES */}
        <Link href="/licitacoes" className="group">
          <div className="bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl border border-gray-200 transition-all transform hover:-translate-y-1 h-full flex flex-col">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-6 text-2xl">
              📜
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-3 group-hover:text-emerald-600 transition">Monitor de Licitações</h2>
            <p className="text-gray-500 text-sm flex-grow">
              Acompanhe pregões e editais em tempo real direto do Mural do TCE-MA e Diário Oficial da FAMEM.
            </p>
            <span className="text-emerald-600 font-semibold text-sm mt-6 flex items-center gap-2">
              Acessar Ferramenta →
            </span>
          </div>
        </Link>

      </div>
    </div>
  );
}