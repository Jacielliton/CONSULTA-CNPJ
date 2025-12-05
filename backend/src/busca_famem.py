#G:\PROJETOS-CODER\SITES\LICITACAO-WEB\backend\busca_famem.py
import requests
import json
from datetime import datetime
import time
import unicodedata

# ATENÇÃO: Não adicione "from busca_famem import ..." aqui.
# A classe é definida logo abaixo.

class BuscadorFamem:
    def __init__(self):
        self.url_filtro = "https://www.diariooficial.famem.org.br/dom/dom/todasPublicacoes/"
        self.url_dados = "https://www.diariooficial.famem.org.br/dom/dom/pesquisaPublicacoes/"
        
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Origin': 'https://www.diariooficial.famem.org.br',
            'Referer': 'https://www.diariooficial.famem.org.br/dom/dom/todasPublicacoes/',
            'X-Requested-With': 'XMLHttpRequest'
        }

    def remover_acentos(self, texto):
        # Normaliza para remover acentos (útil para comparação robusta)
        return ''.join(c for c in unicodedata.normalize('NFD', texto) if unicodedata.category(c) != 'Mn')

    def buscar_publicacoes(self, data_inicio, data_fim, termo_pesquisa="Pregão Presencial", filtro_titulo=None, filtro_categoria=None):
        print(f"--- Busca FAMEM | Termo: '{termo_pesquisa}' | Titulo: '{filtro_titulo}' | Cat: '{filtro_categoria}' ---")
        
        try:
            dt_ini_obj = datetime.strptime(data_inicio, '%Y-%m-%d')
            dt_fim_obj = datetime.strptime(data_fim, '%Y-%m-%d')
            str_ini_br = dt_ini_obj.strftime('%d/%m/%Y')
            str_fim_br = dt_fim_obj.strftime('%d/%m/%Y')
        except ValueError:
            print("Erro de conversão de data")
            return []

        session = requests.Session()
        session.headers.update(self.headers)

        # O termo de pesquisa principal vai para o servidor da FAMEM
        payload = {
            'caxPesquisa': termo_pesquisa,
            'caxDtInicio': str_ini_br,
            'caxDtFim': str_fim_br
        }

        try:
            # 1. POST para configurar a sessão
            resp_filtro = session.post(self.url_filtro, data=payload)
            if resp_filtro.status_code != 200:
                print(f"Erro filtro: {resp_filtro.status_code}")
                return []

            # 2. GET para pegar os dados
            timestamp = int(datetime.now().timestamp() * 1000)
            url_get = f"{self.url_dados}?_={timestamp}"
            
            resp_dados = session.get(url_get)
            
            if resp_dados.status_code == 200:
                data_json = resp_dados.json()
                lista_bruta = data_json.get('data', [])
                
                resultados_formatados = []
                
                # Normaliza filtros para comparação (caixa alta e sem acento)
                f_titulo_norm = self.remover_acentos(filtro_titulo.upper()) if filtro_titulo else None
                f_categoria_norm = self.remover_acentos(filtro_categoria.upper()) if filtro_categoria else None
                
                for item in lista_bruta:
                    titulo_api = item.get('TDC_TITULO', '') or ''
                    categoria_api = item.get('TDCT_DESCRICAO', '') or '' # Campo que representa a Categoria na FAMEM
                    
                    titulo_norm = self.remover_acentos(titulo_api.upper())
                    categoria_norm = self.remover_acentos(categoria_api.upper())
                    
                    # --- APLICAÇÃO DOS FILTROS ---
                    
                    # 1. Filtro de Título (Se informado)
                    if f_titulo_norm and f_titulo_norm not in titulo_norm:
                        continue
                        
                    # 2. Filtro de Categoria (Se informado)
                    if f_categoria_norm and f_categoria_norm not in categoria_norm:
                        continue
                        
                    # Se passou nos filtros, processa
                    data_raw = item.get('TDO_DT_GERACAO', '')
                    data_formatada = data_raw.split(' ')[0] if data_raw else ''
                    doc_id = item.get('TDC_ID')
                    
                    res = {
                        "id": doc_id,
                        "municipio": item.get('PUBLICACAO_DONO'),
                        "orgao": "FAMEM / DOM",
                        "objeto": f"{titulo_api} - {categoria_api}", # Título visual principal
                        "data_sessao": data_formatada,
                        "valor_estimado": 0.00,
                        "link_edital": f"https://www.diariooficial.famem.org.br/dom/dom/publicacoesDetalhes/{doc_id}",
                        "criterio": termo_pesquisa,
                        "finalidade": categoria_api, # Exibimos a categoria real retornada
                        "data_publicacao": data_formatada,
                        "fonte": "FAMEM"
                    }
                    resultados_formatados.append(res)
                
                print(f"Total FAMEM: {len(lista_bruta)} | Filtrados: {len(resultados_formatados)}")
                return resultados_formatados
            else:
                print(f"Erro ao buscar JSON: {resp_dados.status_code}")
                return []

        except Exception as e:
            print(f"Erro crítico FAMEM: {e}")
            return []