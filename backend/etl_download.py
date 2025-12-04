import os
import requests
from tqdm import tqdm
import urllib3
from datetime import datetime, timedelta
import json
import time

# Desabilita avisos SSL
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# === CONFIGURAÇÕES ===
HOST = "https://arquivos.receitafederal.gov.br"
PATH_ROOT = "/dados/cnpj/dados_abertos_cnpj"
URL_RAIZ = f"{HOST}{PATH_ROOT}"
PASTA_DADOS = "./dados"
ARQUIVO_METADATA = os.path.join(PASTA_DADOS, "metadata.json")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
}

def obter_versao_local():
    if os.path.exists(ARQUIVO_METADATA):
        try:
            with open(ARQUIVO_METADATA, 'r') as f:
                data = json.load(f)
                return data.get("versao", None)
        except:
            return None
    return None

def salvar_versao_local(versao):
    with open(ARQUIVO_METADATA, 'w') as f:
        json.dump({"versao": versao, "ultima_atualizacao": str(datetime.now())}, f)

def encontrar_ultima_versao_online():
    data_cursor = datetime.now()
    limite = data_cursor - timedelta(days=730) 

    print("[*] Buscando versão mais recente no servidor...")
    while data_cursor > limite:
        pasta_teste = data_cursor.strftime("%Y-%m")
        url_teste = f"{URL_RAIZ}/{pasta_teste}/"
        try:
            response = requests.head(url_teste, headers=HEADERS, verify=False, timeout=10)
            if response.status_code == 200:
                print(f"[OK] Última versão encontrada online: {pasta_teste}")
                return pasta_teste, url_teste
        except:
            pass
        primeiro_dia = data_cursor.replace(day=1)
        data_cursor = primeiro_dia - timedelta(days=1)
    
    raise Exception("Não foi possível encontrar dados recentes.")

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
    
    tamanho_remoto = -1
    try:
        head = requests.head(url, headers=HEADERS, verify=False, timeout=30)
        tamanho_remoto = int(head.headers.get('content-length', 0))
    except:
        pass

    if os.path.exists(caminho_arquivo):
        tamanho_local = os.path.getsize(caminho_arquivo)
        if not forcar_download and tamanho_remoto != -1 and tamanho_local == tamanho_remoto:
            print(f"[Ignorado] {nome_arquivo} já existe e está completo.")
            return True

    print(f"[*] Baixando: {nome_arquivo} ({tamanho_remoto / (1024*1024):.2f} MB)")
    
    tentativas = 3
    while tentativas > 0:
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
            return True
        except Exception as e:
            print(f"[!] Erro no download ({e}). Tentando novamente...")
            tentativas -= 1
            time.sleep(5)
    
    return False

def main():
    if not os.path.exists(PASTA_DADOS):
        os.makedirs(PASTA_DADOS)

    versao_online, url_base = encontrar_ultima_versao_online()
    versao_local = obter_versao_local()
    
    nova_versao = (versao_local != versao_online)
    if nova_versao:
        print(f"[!] Nova versão detectada: {versao_online}")
    
    arquivos = gerar_lista_arquivos()
    sucesso = True
    
    for arq in arquivos:
        if not baixar_arquivo(url_base, arq, forcar_download=nova_versao):
            sucesso = False
    
    if sucesso and nova_versao:
        salvar_versao_local(versao_online)
        print("\n[SUCESSO] Todos os arquivos baixados.")
    elif not sucesso:
        print("\n[!] Alguns arquivos falharam.")

if __name__ == "__main__":
    main()