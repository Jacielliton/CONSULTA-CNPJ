import os
import pandas as pd
from sqlalchemy import create_engine, text
import io
import time
from tqdm import tqdm
import zipfile

# --- CONFIGURAÇÕES DO BANCO (Porta 5433) ---
DB_USER = "user_cnpj"
DB_PASS = "password_cnpj"
DB_HOST = "127.0.0.1"
DB_PORT = "5433"
DB_NAME = "cnpj_dados"

DATABASE_URL = f"postgresql+pg8000://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

PASTA_DADOS = "./dados"
TAMANHO_CHUNK = 50000  # 50k linhas por lote

# --- DEFINIÇÃO DAS COLUNAS ---
COLUNAS_EMPRESAS = [
    "cnpj_basico", "razao_social", "natureza_juridica", "qualificacao_responsavel", 
    "capital_social", "porte_empresa", "ente_federativo_responsavel"
]

COLUNAS_ESTABELECIMENTOS = [
    "cnpj_basico", "cnpj_ordem", "cnpj_dv", "identificador_matriz_filial", "nome_fantasia",
    "situacao_cadastral", "data_situacao_cadastral", "motivo_situacao_cadastral",
    "nome_cidade_exterior", "pais", "data_inicio_atividade", "cnae_fiscal_principal",
    "cnae_fiscal_secundaria", "tipo_de_logradouro", "logradouro", "numero",
    "complemento", "bairro", "cep", "uf", "municipio", "ddd_1", "telefone_1",
    "ddd_2", "telefone_2", "ddd_fax", "fax", "correio_eletronico",
    "situacao_especial", "data_situacao_especial"
]

COLUNAS_SOCIOS = [
    "cnpj_basico", "identificador_socio", "nome_socio_razao_social", "cpf_cnpj_socio",
    "qualificacao_socio", "data_entrada_sociedade", "pais", "representante_legal",
    "nome_representante", "qualificacao_representante", "faixa_etaria"
]

def get_engine():
    return create_engine(DATABASE_URL, isolation_level="AUTOCOMMIT")

def limpar_dados(df):
    df = df.fillna("")
    for col in df.select_dtypes(include=['object']):
        df[col] = df[col].astype(str).str.strip()
        df[col] = df[col].str.replace('\x00', '', regex=False)
    return df

def inserir_via_copy(conn, df, tabela):
    output = io.StringIO()
    df.to_csv(output, sep='\t', header=False, index=False)
    output.seek(0)
    
    dbapi_conn = conn.connection
    cursor = dbapi_conn.cursor()
    
    columns_str = ",".join(df.columns)
    sql_copy = f"COPY {tabela} ({columns_str}) FROM STDIN WITH (FORMAT CSV, DELIMITER '\t', NULL '', QUOTE '\"', ESCAPE '\\')"
    
    cursor.execute(sql_copy, stream=output)

def processar_csv(caminho_csv, tabela, colunas):
    """Lê o CSV extraído e manda pro banco"""
    engine = get_engine()
    tamanho_arquivo = os.path.getsize(caminho_csv)
    
    print(f"    -> Processando CSV: {os.path.basename(caminho_csv)} ({tamanho_arquivo/1024/1024:.2f} MB)")

    chunks = pd.read_csv(
        caminho_csv,
        sep=';',
        encoding='latin-1',
        header=None,
        names=colunas,
        dtype=str,
        chunksize=TAMANHO_CHUNK,
        quotechar='"',
        on_bad_lines='warn'
    )

    total_linhas = 0
    
    with engine.connect() as conn:
        with tqdm(total=tamanho_arquivo, unit='B', unit_scale=True, desc="    Importando DB") as barra:
            for df_chunk in chunks:
                df_chunk = limpar_dados(df_chunk)
                try:
                    inserir_via_copy(conn, df_chunk, tabela)
                    bytes_chunk = df_chunk.memory_usage(index=True, deep=True).sum()
                    barra.update(int(bytes_chunk * 0.35)) # Fator de correção visual para CSV
                    total_linhas += len(df_chunk)
                except Exception as e:
                    print(f"    [X] Erro no lote: {e}")
                    continue

    return total_linhas

def processar_zip(caminho_zip, tabela, colunas):
    """Extrai o ZIP, descobre o arquivo dentro, processa e DELETA o extraído."""
    print(f"\n{'='*60}")
    print(f"[*] INICIANDO ARQUIVO: {os.path.basename(caminho_zip)}")
    print(f"    -> Tabela Alvo: {tabela}")
    
    try:
        with zipfile.ZipFile(caminho_zip, 'r') as z:
            # Pega o nome do arquivo que está dentro do zip
            nomes_arquivos = z.namelist()
            if not nomes_arquivos:
                print("    [!] Zip vazio. Pulando.")
                return

            nome_csv_interno = nomes_arquivos[0] # Geralmente é só um arquivo
            print(f"    -> Extraindo: {nome_csv_interno}...")
            z.extract(nome_csv_interno, PASTA_DADOS)
            
            caminho_csv_extraido = os.path.join(PASTA_DADOS, nome_csv_interno)
            
            # --- PROCESSAMENTO ---
            start = time.time()
            linhas = processar_csv(caminho_csv_extraido, tabela, colunas)
            end = time.time()
            
            print(f"    [OK] Sucesso! {linhas} linhas em {end-start:.2f}s")
            
            # --- LIMPEZA ---
            print("    -> Removendo arquivo CSV extraído para liberar espaço...")
            os.remove(caminho_csv_extraido)
            
    except zipfile.BadZipFile:
        print("    [X] Erro: Arquivo ZIP corrompido.")
    except Exception as e:
        print(f"    [X] Falha fatal no processamento: {e}")

def main():
    if not os.path.exists(PASTA_DADOS):
        print(f"[Erro] Pasta {PASTA_DADOS} não encontrada.")
        return

    # Lista apenas arquivos .zip
    arquivos = sorted([f for f in os.listdir(PASTA_DADOS) if f.endswith(".zip")])
    
    print(f"--- Iniciando Automação de Importação ({len(arquivos)} arquivos encontrados) ---")

    for arquivo in arquivos:
        caminho_completo = os.path.join(PASTA_DADOS, arquivo)
        
        # Identifica o tipo pelo nome do ZIP
        if "Empresas" in arquivo:
            processar_zip(caminho_completo, "empresas", COLUNAS_EMPRESAS)
        elif "Estabelecimentos" in arquivo:
            processar_zip(caminho_completo, "estabelecimentos", COLUNAS_ESTABELECIMENTOS)
        elif "Socios" in arquivo:
            processar_zip(caminho_completo, "socios", COLUNAS_SOCIOS)
        else:
            print(f"[Ignorado] {arquivo} (Não é um dos arquivos principais de dados)")

    print("\n[FIM] Todos os arquivos processados!")

if __name__ == "__main__":
    main()