"use client";
import { useState } from "react";
import Cookies from "js-cookie";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function PlanosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const assinar = async (plano: string) => {
    const token = Cookies.get("auth_token");
    if (!token) return router.push("/login");

    if (!confirm(`Confirmar assinatura do plano ${plano.toUpperCase()}? (Simulação)`)) return;

    setLoading(plano);
    try {
      const res = await fetch(`${API_BASE}/api/assinar/${plano}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (res.ok) {
        alert("Sucesso! Créditos adicionados.");
        router.push("/dashboard");
      } else {
        alert("Erro ao assinar.");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-16 px-4 font-sans">
      <div className="max-w-6xl mx-auto text-center">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-4">Escolha seu Plano</h1>
        <p className="text-slate-500 mb-12 max-w-2xl mx-auto">
          Tenha acesso total à inteligência de dados, exportação em massa e monitoramento de licitações.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* MENSAL */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 hover:shadow-xl transition transform hover:-translate-y-1">
            <h3 className="text-xl font-bold text-slate-800">Mensal</h3>
            <div className="my-4">
              <span className="text-4xl font-extrabold text-slate-900">R$ 99</span>
              <span className="text-slate-500">/mês</span>
            </div>
            <p className="text-sm text-slate-500 mb-6">Para consultores individuais.</p>
            <ul className="text-left space-y-3 mb-8 text-sm text-slate-600">
              <li className="flex items-center gap-2">✅ 500 Créditos/mês</li>
              <li className="flex items-center gap-2">✅ Busca Avançada</li>
              <li className="flex items-center gap-2">✅ Licitações (TCE/FAMEM)</li>
              <li className="flex items-center gap-2">✅ Suporte por Email</li>
            </ul>
            <button 
              onClick={() => assinar("mensal")}
              disabled={loading === "mensal"}
              className="w-full py-3 px-6 rounded-lg bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 transition"
            >
              {loading === "mensal" ? "Processando..." : "Assinar Mensal"}
            </button>
          </div>

          {/* TRIMESTRAL (DESTAQUE) */}
          <div className="bg-white rounded-2xl shadow-xl border-2 border-blue-600 p-8 relative transform scale-105 z-10">
            <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">
              MAIS POPULAR
            </div>
            <h3 className="text-xl font-bold text-slate-800">Trimestral</h3>
            <div className="my-4">
              <span className="text-4xl font-extrabold text-slate-900">R$ 269</span>
              <span className="text-slate-500">/3 meses</span>
            </div>
            <p className="text-sm text-slate-500 mb-6">Economize 10%.</p>
            <ul className="text-left space-y-3 mb-8 text-sm text-slate-600">
              <li className="flex items-center gap-2">✅ <strong>2.000 Créditos</strong></li>
              <li className="flex items-center gap-2">✅ Busca Avançada + Exportação</li>
              <li className="flex items-center gap-2">✅ Monitoramento em Tempo Real</li>
              <li className="flex items-center gap-2">✅ Suporte Prioritário</li>
            </ul>
            <button 
              onClick={() => assinar("trimestral")}
              disabled={loading === "trimestral"}
              className="w-full py-3 px-6 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition shadow-lg"
            >
              {loading === "trimestral" ? "Processando..." : "Assinar Trimestral"}
            </button>
          </div>

          {/* ANUAL */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 hover:shadow-xl transition transform hover:-translate-y-1">
            <h3 className="text-xl font-bold text-slate-800">Anual</h3>
            <div className="my-4">
              <span className="text-4xl font-extrabold text-slate-900">R$ 899</span>
              <span className="text-slate-500">/ano</span>
            </div>
            <p className="text-sm text-slate-500 mb-6">Melhor custo-benefício.</p>
            <ul className="text-left space-y-3 mb-8 text-sm text-slate-600">
              <li className="flex items-center gap-2">✅ <strong>10.000 Créditos</strong></li>
              <li className="flex items-center gap-2">✅ Acesso Total à API</li>
              <li className="flex items-center gap-2">✅ Relatórios Personalizados</li>
              <li className="flex items-center gap-2">✅ Gerente de Conta</li>
            </ul>
            <button 
              onClick={() => assinar("anual")}
              disabled={loading === "anual"}
              className="w-full py-3 px-6 rounded-lg bg-slate-800 text-white font-bold hover:bg-slate-900 transition"
            >
              {loading === "anual" ? "Processando..." : "Assinar Anual"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}