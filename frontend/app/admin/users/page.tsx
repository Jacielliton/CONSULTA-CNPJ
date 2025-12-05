"use client";
import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Configuração de API
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function UsersPanel() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Função de Fetch Autenticado
  const authFetch = async (url: string, options: any = {}) => {
    const token = Cookies.get("auth_token");
    if (!token) { router.push("/login"); throw new Error("Sem token"); }
    
    const headers = { ...options.headers, "Authorization": `Bearer ${token}` };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 || res.status === 403) { router.push("/login"); throw new Error("Negado"); }
    return res;
  };

  const fetchUsers = async () => {
    try {
      const res = await authFetch(`${API_BASE}/admin/users`);
      const data = await res.json();
      setUsers(data.users || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir o usuário "${nome}"?`)) return;
    
    try {
      await authFetch(`${API_BASE}/admin/users/${id}`, { method: 'DELETE' });
      // Atualiza a lista localmente
      setUsers(users.filter(u => u.id !== id));
    } catch (e) {
      alert("Erro ao excluir usuário.");
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-900">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8 border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">Gestão de Usuários</h1>
            <p className="text-gray-500 text-sm mt-1">Controle de acesso e clientes</p>
          </div>
          <Link href="/admin" className="text-sm font-semibold text-gray-600 hover:text-blue-600 bg-white border border-gray-300 px-4 py-2 rounded-lg transition">
            ← Voltar ao Painel
          </Link>
        </div>

        {/* Tabela */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500 animate-pulse">Carregando usuários...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 border-b border-gray-200 uppercase text-xs font-bold text-gray-500">
                  <tr>
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">Nome / Email</th>
                    <th className="px-6 py-4">Contato</th>
                    <th className="px-6 py-4">Cadastro</th>
                    <th className="px-6 py-4 text-center">Permissão</th>
                    <th className="px-6 py-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-blue-50/30 transition">
                      <td className="px-6 py-4 font-mono text-xs text-gray-400">#{user.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{user.nome}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {user.contato || "-"}
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-xs">
                        {user.data_criacao}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {user.is_admin ? (
                          <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold border border-purple-200">
                            ADMIN
                          </span>
                        ) : (
                          <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold border border-gray-200">
                            CLIENTE
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!user.is_admin && (
                          <button 
                            onClick={() => handleDelete(user.id, user.nome)}
                            className="text-red-500 hover:text-red-700 font-bold text-xs hover:underline bg-red-50 px-3 py-1.5 rounded border border-red-100 transition"
                          >
                            Excluir
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">Nenhum usuário encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}