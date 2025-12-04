import os
import requests
from tqdm import tqdm
import urllib3
from datetime import datetime, timedelta
import json

# Desabilita avisos SSL
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# === CONFIGURAÇÕES ===
HOST = "https://arquivos.receitafederal.gov.br"
PATH_ROOT = "/dados/cnpj/dados_abertos_cnpj"
URL_RAIZ = f"{HOST}{PATH_ROOT}"
PASTA_DADOS = "./dados"
ARQUIVO_METADATA = os.path.join(PASTA_DADOS, "metadata.json")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def obter_versao_local():
    """Lê qual a versão dos dados que já temos baixada no disco."""
    if os.path.exists(ARQUIVO_METADATA):
        try:
            with open(ARQUIVO_METADATA, 'r') as f:
                data = json.load(f)
                return data.get("versao", None)
        except:
            return None
    return None

def salvar_versao_local(versao):
    """Atualiza o arquivo de metadata com a nova versão."""
    with open(ARQUIVO_METADATA, 'w') as f:
        json.dump({"versao": versao, "ultima_atualizacao": str(datetime.now())}, f)

def encontrar_ultima_versao_online():
    """
    Começa do mês atual e volta no tempo até achar uma pasta válida.
    Ex: Tenta 2025-11 (404) -> Tenta 2025-10 (200 OK!) -> Retorna '2025-10'
    """
    data_cursor = datetime.now()
    # Tenta voltar até 24 meses (2 anos) atrás no máximo
    limite = data_cursor - timedelta(days=730) 

    print("[*] Buscando versão mais recente no servidor...")

    while data_cursor > limite:
        pasta_teste = data_cursor.strftime("%Y-%m")
        url_teste = f"{URL_RAIZ}/{pasta_teste}/"
        
        try:
            # Head request é rápido, só pega o status
            response = requests.head(url_teste, headers=HEADERS, verify=False, timeout=5)
            if response.status_code == 200:
                print(f"[OK] Última versão encontrada online: {pasta_teste}")
                return pasta_teste, url_teste
        except Exception:
            pass # Erro de conexão, tenta o próximo mês pra trás
        
        # Volta 1 mês
        # Truque: pegar o primeiro dia do mês atual e subtrair 1 dia cai no mês anterior
        primeiro_dia = data_cursor.replace(day=1)
        data_cursor = primeiro_dia - timedelta(days=1)
    
    raise Exception("Não foi possível encontrar nenhuma pasta de dados nos últimos 2 anos.")

def gerar_lista_arquivos():
    arquivos = [
        "Cnaes.zip", "Motivos.zip", "Municipios.zip", 
        "Naturezas.zip", "Paises.zip", "Qualificacoes.zip", "Simples.zip"
    ]
    for i in range(10):
        arquivos.append(f"Empresas{i}.zip")
        arquivos.append(f"Estabelecimentos{i}.zip")
        arquivos.append(f"Socios{i}.zip")
    return arquivos

def baixar_arquivo(url_base, nome_arquivo, forcar_download=False):
    url = f"{url_base}{nome_arquivo}"
    caminho_arquivo = os.path.join(PASTA_DADOS, nome_arquivo)
    
    # Pega o tamanho do arquivo remoto
    try:
        response_head = requests.head(url, headers=HEADERS, verify=False, timeout=30)
        tamanho_remoto = int(response_head.headers.get('content-length', 0))
    except:
        print(f"[!] Não foi possível verificar tamanho remoto de {nome_arquivo}. Tentando baixar mesmo assim.")
        tamanho_remoto = -1

    # Verificação de Integridade
    if os.path.exists(caminho_arquivo):
        tamanho_local = os.path.getsize(caminho_arquivo)
        
        if not forcar_download:
            # Se não estamos forçando (mesma versão), verifica se o tamanho bate
            if tamanho_local == tamanho_remoto:
                print(f"[Ignorado] {nome_arquivo} já existe e está completo.")
                return
            elif tamanho_local > 0:
                print(f"[Resume] {nome_arquivo} parece incompleto ou alterado. Baixando novamente...")
        else:
             print(f"[Atualização] Nova versão detectada. Baixando {nome_arquivo}...")

    # Download Real
    print(f"[*] Baixando: {nome_arquivo} ({tamanho_remoto / (1024*1024):.2f} MB)")
    
    try:
        response = requests.get(url, headers=HEADERS, stream=True, verify=False, timeout=60)
        response.raise_for_status()
        
        with open(caminho_arquivo, "wb") as arquivo, tqdm(
            desc=nome_arquivo,
            total=tamanho_remoto,
            unit='iB',
            unit_scale=True,
            unit_divisor=1024,
        ) as barra:
            for dados in response.iter_content(chunk_size=16384):
                arquivo.write(dados)
                barra.update(len(dados))
                
    except Exception as e:
        print(f"[X] Falha no download de {nome_arquivo}: {e}")
        # Se falhar, não apaga imediatamente, permite retry na proxima
        return False
        
    return True

def main():
    if not os.path.exists(PASTA_DADOS):
        os.makedirs(PASTA_DADOS)

    # 1. Descobre o que tem online
    versao_online, url_base = encontrar_ultima_versao_online()
    
    # 2. Descobre o que temos localmente
    versao_local = obter_versao_local()
    
    print(f"\n--- RESUMO ---")
    print(f"Versão Local : {versao_local if versao_local else 'Nenhuma'}")
    print(f"Versão Online: {versao_online}")
    print(f"--------------\n")
    
    nova_versao_detectada = False
    if versao_local != versao_online:
        print(f"[!] ATENÇÃO: Os dados locais estão desatualizados (ou inexistentes).")
        print(f"[!] Iniciando atualização completa para a versão {versao_online}...")
        nova_versao_detectada = True
    else:
        print(f"[OK] Sua base está na versão correta. Verificando integridade dos arquivos...")

    # 3. Baixa os arquivos
    arquivos = gerar_lista_arquivos()
    sucesso_total = True
    
    for arq in arquivos:
        # Se a versão mudou, forçamos o download (overwrite)
        # Se a versão é a mesma, só baixamos se o arquivo não existir ou tamanho estiver errado
        ok = baixar_arquivo(url_base, arq, forcar_download=nova_versao_detectada)
        if not ok:
            sucesso_total = False
    
    # 4. Se baixou tudo com sucesso, atualiza o "selo" de versão
    if sucesso_total and nova_versao_detectada:
        salvar_versao_local(versao_online)
        print(f"\n[SUCESSO] Base atualizada para versão {versao_online}!")
    elif not sucesso_total:
        print(f"\n[!] Ocorreram erros em alguns arquivos. Rode o script novamente para corrigir.")
    else:
        print(f"\n[OK] Base já estava atualizada.")

if __name__ == "__main__":
    main()