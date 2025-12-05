#G:\PROJETOS-CODER\SITES\LICITACAO-WEB\backend\busca_licitacoes.py
import requests
import json
from datetime import datetime, timedelta
import time

class BuscadorLicitacoesTCEMA:
    def __init__(self):
        self.base_url = "https://app.tcema.tc.br/sinccontrata/api/procedimento/filtrar/mural"
        self.headers = {
            'authority': 'app.tcema.tc.br',
            'accept': 'application/json, text/plain, */*',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'referer': 'https://app.tcema.tc.br/sinccontrata/mural/procedimento',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-origin'
        }

    def buscar_pregoes_abertos(self, data_inicio, data_fim, tipo_procedimento=None, finalidade=None):
        """
        Busca licitações com filtros dinâmicos de tipo e finalidade.
        """
        
        # Converte strings para objetos de data
        try:
            start_date = datetime.strptime(data_inicio, '%Y-%m-%d')
            end_date = datetime.strptime(data_fim, '%Y-%m-%d')
        except ValueError:
            print("Erro no formato das datas. Use AAAA-MM-DD.")
            return []
        
        # Define padrão se não vier nada (Pregão Presencial é o padrão anterior)
        if not tipo_procedimento:
            tipo_procedimento = 'PP'

        print(f"--- Busca TCE: {data_inicio} a {data_fim} | Tipo: {tipo_procedimento} | Finalidade: {finalidade or 'Todas'} ---")
        
        licitacoes_encontradas = []
        ids_processados = set()
        
        current_date = start_date
        while current_date <= end_date:
            data_atual_str = current_date.strftime('%Y-%m-%d')
            ano_atual = current_date.year
            
            print(f"Verificando data: {data_atual_str}...")
            
            page = 0
            tem_proxima_pagina = True
            
            while tem_proxima_pagina:
                params = {
                    'tipoProcedimento': tipo_procedimento,
                    'anoProcedimento': ano_atual,
                    'dataSessaoInicio': data_atual_str,
                    'page': page,
                    'size': 20 
                }
                
                # Adiciona finalidade apenas se foi selecionada (se não for None ou string vazia)
                if finalidade:
                    params['finalidade'] = finalidade

                try:
                    response = requests.get(
                        self.base_url, 
                        headers=self.headers, 
                        params=params, 
                        timeout=10
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        conteudo = data.get('content', [])
                        
                        if not conteudo:
                            tem_proxima_pagina = False
                            break
                        
                        for item in conteudo:
                            sessao_str = item.get('dataSessao')
                            
                            # Filtro de dia exato
                            if sessao_str != data_atual_str:
                                continue

                            proc_id = item.get('idProcedimento')
                            
                            if proc_id in ids_processados:
                                continue
                            
                            licitacao = {
                                "id": proc_id,
                                "municipio": item.get('nomeEnteEnvio'),
                                "orgao": item.get('nomeEntidadeEnvio'),
                                "objeto": item.get('objeto'),
                                "data_sessao": sessao_str,
                                "valor_estimado": item.get('valorEstimado'),
                                "link_edital": item.get('link_documento'),
                                "criterio": item.get('nomeCriterio') or "Não informado",
                                "finalidade": item.get('nomeFinalidade') or "Não informada",
                                "data_publicacao": item.get('dataPublicacao'),
                                "fonte": "TCE"
                            }
                            
                            licitacoes_encontradas.append(licitacao)
                            ids_processados.add(proc_id)

                        tem_proxima_pagina = not data.get('last', True)
                        page += 1
                        
                    else:
                        print(f"Erro na API data {data_atual_str}: {response.status_code}")
                        tem_proxima_pagina = False

                except Exception as e:
                    print(f"Erro de conexão em {data_atual_str}: {e}")
                    tem_proxima_pagina = False
            
            current_date += timedelta(days=1)
            time.sleep(0.1)

        print(f"Finalizado. Total encontrado: {len(licitacoes_encontradas)}")
        return licitacoes_encontradas