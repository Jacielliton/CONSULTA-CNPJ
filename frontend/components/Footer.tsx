export default function Footer() {
  return (
    <footer className="bg-gray-900 text-white py-8 mt-auto">
      <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
        <div className="mb-4 md:mb-0">
          <p className="font-bold text-gray-200">Plataforma de Inteligência - CNPJ & Licitações</p>
          <p className="mt-1">© {new Date().getFullYear()} Todos os direitos reservados.</p>
        </div>
        <div className="flex gap-6">
          <a href="#" className="hover:text-white transition">Termos de Uso</a>
          <a href="#" className="hover:text-white transition">Privacidade</a>
          <a href="#" className="hover:text-white transition">Suporte</a>
        </div>
      </div>
    </footer>
  );
}