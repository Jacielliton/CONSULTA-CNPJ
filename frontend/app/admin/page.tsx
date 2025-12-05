"use client";
import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";
import Link from "next/link"; // Importar Link

export default function AdminPanel() {
  const router = useRouter();
  const [stats, setStats] = useState({ 
    postgres_empresas: 0, 
    postgres_tamanho: "Carregando...",
    elastic_empresas: 0,
    elastic_status: "Verificando..."
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [osTab, setOsTab] = useState<'windows' | 'linux'>('linux');

  // Função auxiliar para fazer fetch autenticado
  const authFetch = async (url: string, options: any = {}) => {
    const token = Cookies.get("auth_token");
    if (!token) {
      router.push("/login");
      throw new Error("Não autenticado");
    }

    const headers = {
      ...options.headers,
      "Authorization": `Bearer ${token}`
    };

    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
      router.push("/login"); 
      throw new Error("Acesso negado");
    }
    return res;
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await authFetch(`${apiUrl}/admin/stats`);
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  const executarAcao = async (acao: string, metodo = "POST") => {
    if (acao === "limpar" && !confirm("ATENÇÃO: Essa ação apaga TODOS os dados do banco e da busca! Tem certeza?")) return;
    
    setLoading(true);
    setMsg("Processando comando...");
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await authFetch(`${apiUrl}/admin/${acao}`, { method: metodo });
      const data = await res.json();
      setMsg(data.status || data.message || "Comando enviado!");
      
      if (acao === "limpar") setTimeout(fetchStats, 2000);
      
    } catch (error: any) {
      setMsg(error.message || "Erro ao comunicar com servidor.");
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(""), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-900">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8 border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">Painel de Controle</h1>
            <p className="text-gray-500 text-sm mt-1">Administração do Sistema de Dados</p>
          </div>
          <a href="/" className="text-sm font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-4 py-2 rounded-lg transition">
            ← Voltar para Busca
          </a>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-blue-500">
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">PostgreSQL</h3>
            <p className="text-3xl font-bold text-gray-800">
              {stats.postgres_empresas ? Number(stats.postgres_empresas).toLocaleString() : 0}
            </p>
            <span className="text-xs text-gray-400 font-medium">Registros Base</span>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-green-500">
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Elasticsearch</h3>
            <p className="text-3xl font-bold text-gray-800">
              {stats.elastic_empresas ? Number(stats.elastic_empresas).toLocaleString() : 0}
            </p>
             <span className="text-xs text-gray-400 font-medium">Disponíveis Busca</span>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-purple-500">
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Disco</h3>
            <p className="text-2xl font-bold text-gray-800 mt-1">{stats.postgres_tamanho}</p>
            <span className="text-xs text-gray-400 font-medium">Tamanho DB</span>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-orange-500">
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Elastic Status</h3>
            <p className={`text-2xl font-bold mt-1 ${stats.elastic_status?.includes("Online") ? "text-green-600" : "text-red-600"}`}>
              {stats.elastic_status}
            </p>
          </div>

        </div>

        {/* Mensagem de Feedback */}
        {msg && (
          <div className="bg-blue-600 text-white px-6 py-3 rounded-lg mb-8 shadow-lg font-medium animate-pulse flex items-center gap-2">
            <span className="text-xl">ℹ️</span> {msg}
          </div>
        )}

        {/* --- ÁREA DE GESTÃO DE USUÁRIOS (NOVO) --- */}
        <div className="mb-8">
          <Link href="/admin/users" className="block group">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center justify-between hover:border-blue-400 hover:shadow-md transition">
              <div className="flex items-center gap-4">
                <div className="bg-purple-100 text-purple-600 p-3 rounded-lg text-2xl group-hover:bg-purple-600 group-hover:text-white transition">
                  👥
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 group-hover:text-blue-700 transition">Gerenciar Usuários</h2>
                  <p className="text-gray-500 text-sm">Visualizar lista de clientes cadastrados e gerenciar acessos.</p>
                </div>
              </div>
              <span className="text-blue-600 font-bold text-sm bg-blue-50 px-4 py-2 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition">
                Acessar →
              </span>
            </div>
          </Link>
        </div>

        {/* Ações Técnicas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          
          {/* Manutenção de Dados */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold mb-6 border-b pb-2 flex items-center gap-2 text-gray-700">
              🛠️ Manutenção Técnica
            </h2>
            <div className="space-y-4">
              
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">Atualizar Tudo</h3>
                  <p className="text-xs text-gray-500">Download + Importação + Elastic</p>
                </div>
                <button 
                  onClick={() => executarAcao("atualizar")} 
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-xs font-bold transition disabled:opacity-50"
                >
                  Iniciar Auto
                </button>
              </div>

              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">Sincronizar Elastic</h3>
                  <p className="text-xs text-gray-500">Copia do Postgres p/ Elastic</p>
                </div>
                <button 
                  onClick={() => executarAcao("sincronizar_elastic")} 
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-xs font-bold transition disabled:opacity-50"
                >
                  Sincronizar
                </button>
              </div>

              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">Otimizar Banco</h3>
                  <p className="text-xs text-gray-500">Cria índices no Postgres</p>
                </div>
                <button 
                  onClick={() => executarAcao("otimizar")}
                  disabled={loading} 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-xs font-bold transition disabled:opacity-50"
                >
                  Otimizar
                </button>
              </div>

            </div>
          </div>

          {/* Zona de Perigo e Backup */}
          <div className="space-y-6">
            
            {/* Backup */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
               <h2 className="text-lg font-bold mb-4 text-gray-700">💾 Backup</h2>
               <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-gray-800 text-sm">Exportar CSV</h3>
                    <p className="text-xs text-gray-500">Salva tabelas na pasta de backups.</p>
                  </div>
                  <button 
                     onClick={() => executarAcao("backup")}
                     disabled={loading}
                     className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-xs font-bold transition disabled:opacity-50"
                  >
                    Gerar Backup
                  </button>
                </div>
            </div>

            {/* Zona de Perigo */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 border-l-4 border-l-red-500">
              <h2 className="text-lg font-bold mb-4 text-red-600">⛔ Zona de Perigo</h2>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-red-700 text-sm">Limpar Tudo</h3>
                  <p className="text-xs text-gray-500">Apaga Postgres E Elastic.</p>
                </div>
                <button 
                   onClick={() => executarAcao("limpar", "DELETE")}
                   disabled={loading}
                   className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-xs font-bold transition disabled:opacity-50"
                >
                  APAGAR TUDO
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* --- TUTORIAL MANUAL --- */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
            <h2 className="text-lg font-bold flex items-center gap-2 text-gray-700">
              💻 Comandos Manuais (Terminal)
            </h2>
            <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
              <button onClick={() => setOsTab('windows')} className={`px-3 py-1 text-xs font-bold rounded-md transition ${osTab === 'windows' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Windows</button>
              <button onClick={() => setOsTab('linux')} className={`px-3 py-1 text-xs font-bold rounded-md transition ${osTab === 'linux' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Linux (VPS)</button>
            </div>
          </div>
          
          <div className="bg-gray-900 text-gray-300 p-5 rounded-lg font-mono text-xs overflow-x-auto border border-gray-700 shadow-inner leading-relaxed">
            <div className="mb-4">
              <p className="text-gray-500 mb-1"># 1. Ativar Ambiente</p>
              {osTab === 'windows' ? <p className="text-green-400 select-all">.\venv\Scripts\Activate.ps1</p> : <p className="text-green-400 select-all">source venv/bin/activate</p>}
            </div>
            <div className="pt-2 border-t border-gray-700">
              <p className="text-yellow-500 font-bold mb-2">--- ATUALIZAÇÃO COMPLETA ---</p>
              {osTab === 'linux' ? (
                <p className="text-green-400 select-all font-bold border-l-4 border-green-600 pl-2">screen -S update && python etl_download.py && python etl_import.py && python etl_sync_es.py</p>
              ) : (
                <p className="text-green-400 select-all font-bold border-l-4 border-green-600 pl-2">python etl_download.py ; python etl_import.py ; python etl_sync_es.py</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}