"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Cookies from "js-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// Ícones
const Icons = {
  User: () => <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Search: () => <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  Doc: () => <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Filter: () => <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
};

export default function UserDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = Cookies.get("auth_token");
    if (!token) {
      router.push("/login");
      return;
    }

    // Busca dados do usuário logado
    fetch(`${API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => {
      if (!res.ok) throw new Error("Não autorizado");
      return res.json();
    })
    .then(data => {
      setUser(data);
      setLoading(false);
    })
    .catch(() => {
      Cookies.remove("auth_token");
      router.push("/login");
    });
  }, [router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Carregando perfil...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        
        {/* Cabeçalho de Boas-vindas */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-8 flex flex-col md:flex-row items-center gap-6">
          <div className="bg-blue-50 p-4 rounded-full">
            <Icons.User />
          </div>
          <div className="text-center md:text-left flex-1">
            <h1 className="text-2xl font-bold text-gray-800">Olá, {user.nome}!</h1>
            <p className="text-gray-500 text-sm mt-1">{user.email}</p>
            
            {/* EXIBIÇÃO DE CRÉDITOS */}
            <div className="mt-3 flex items-center gap-4 justify-center md:justify-start">
               <div className="bg-slate-100 px-4 py-2 rounded-lg border border-slate-200">
                  <span className="text-xs text-gray-500 uppercase font-bold block">Saldo</span>
                  <span className="text-xl font-extrabold text-blue-700">{user.creditos} <span className="text-sm font-normal text-gray-600">créditos</span></span>
               </div>
               
               <Link href="/planos" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 transition shadow-sm">
                 + Recarregar
               </Link>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <span className="bg-blue-100 text-blue-800 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
              Plano: {user.plano_tipo?.toUpperCase() || "FREE"}
            </span>
          </div>
        </div>

        <h2 className="text-xl font-bold text-gray-800 mb-6">Acesso Rápido às Ferramentas</h2>

        {/* Grid de Ferramentas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1 */}
          <Link href="/consulta-simples" className="group">
            <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-lg border border-gray-200 transition-all hover:-translate-y-1 h-full flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-600 transition">
                <Icons.Search />
              </div>
              <h3 className="font-bold text-gray-800 mb-2">Consulta Simples</h3>
              <p className="text-sm text-gray-500">Pesquise empresas rapidamente por Nome ou CNPJ.</p>
            </div>
          </Link>

          {/* Card 2 */}
          <Link href="/pesquisa-avancada" className="group">
            <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-lg border border-gray-200 transition-all hover:-translate-y-1 h-full flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-600 transition">
                <Icons.Filter />
              </div>
              <h3 className="font-bold text-gray-800 mb-2">Pesquisa Avançada</h3>
              <p className="text-sm text-gray-500">Filtre por cidade, estado, data de abertura e situação.</p>
            </div>
          </Link>

          {/* Card 3 */}
          <Link href="/licitacoes" className="group">
            <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-lg border border-gray-200 transition-all hover:-translate-y-1 h-full flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-emerald-500 rounded-lg flex items-center justify-center mb-4 group-hover:bg-emerald-600 transition">
                <Icons.Doc />
              </div>
              <h3 className="font-bold text-gray-800 mb-2">Monitor de Licitações</h3>
              <p className="text-sm text-gray-500">Acompanhe editais do TCE-MA e Diário Oficial (FAMEM).</p>
            </div>
          </Link>

        </div>

        {/* Futura Área de Histórico/Favoritos */}
        <div className="mt-10">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Seu Histórico Recente</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="opacity-40">
              <div className="text-4xl mb-2">📂</div>
              <p className="text-gray-500">Você ainda não salvou nenhuma empresa ou licitação.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}