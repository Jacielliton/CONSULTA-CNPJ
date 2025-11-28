import os
import pandas as pd
from sqlalchemy import create_engine, text
import io
import time
from tqdm import tqdm
import zipfile

# --- CONFIGURAÇÕES ---
DB_USER = "user_cnpj"
DB_PASS = "password_cnpj"
DB_HOST = "127.0.0.1"
DB_PORT = "5433"
DB_NAME = "cnpj_dados"
DATABASE_URL = f"postgresql+pg8000://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
PASTA_DADOS = "./dados"
TAMANHO_CHUNK = 20000

# --- DEFINIÇÃO DAS COLUNAS ---
COLUNAS_EMPRESAS = ["cnpj_basico", "razao_social", "natureza_juridica", "qualificacao_responsavel", "capital_social", "porte_empresa", "ente_federativo_responsavel"]
COLUNAS_ESTABELECIMENTOS = ["cnpj_basico", "cnpj_ordem", "cnpj_dv", "identificador_matriz_filial", "nome_fantasia", "situacao_cadastral", "data_situacao_cadastral", "motivo_situacao_cadastral", "nome_cidade_exterior", "pais", "data_inicio_atividade", "cnae_fiscal_principal", "cnae_fiscal_secundaria", "tipo_de_logradouro", "logradouro", "numero", "complemento", "bairro", "cep", "uf", "municipio", "ddd_1", "telefone_1", "ddd_2", "telefone_2", "ddd_fax", "fax", "correio_eletronico", "situacao_especial", "data_situacao_especial"]
COLUNAS_SOCIOS = ["cnpj_basico", "identificador_socio", "nome_socio_razao_social", "cpf_cnpj_socio", "qualificacao_socio", "data_entrada_sociedade", "pais", "representante_legal", "nome_representante", "qualificacao_representante", "faixa_etaria"]

# Colunas das Tabelas de Referência
COLUNAS_CNAES = ["codigo", "descricao"]
COLUNAS_NATUREZAS = ["codigo", "descricao"]
COLUNAS_MUNICIPIOS = ["codigo", "descricao"]

def get_engine():
    return create_engine(DATABASE_URL, isolation_level="AUTOCOMMIT")

def limpar_dados(df):
    df = df.fillna("")
    for col in df.select_dtypes(include=['object']):
        df[col] = df[col].astype(str).str.strip().str.replace('\x00', '', regex=False)
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
    engine = get_engine()
    tamanho_arquivo = os.path.getsize(caminho_csv)
    print(f"    -> Processando CSV: {os.path.basename(caminho_csv)} ({tamanho_arquivo/1024/1024:.2f} MB)")

    chunks = pd.read_csv(
        caminho_csv, sep=';', encoding='latin-1', header=None, names=colunas,
        dtype=str, chunksize=TAMANHO_CHUNK, quotechar='"', on_bad_lines='warn'
    )

    total_linhas = 0
    with engine.connect() as conn:
        # Limpa tabela de referência antes de inserir para evitar duplicação (opcional, bom para CNAEs)
        if tabela in ['cnaes', 'naturezas', 'municipios']:
            conn.execute(text(f"TRUNCATE TABLE {tabela}"))
            
        with tqdm(total=tamanho_arquivo, unit='B', unit_scale=True, desc="    Importando DB") as barra:
            for df_chunk in chunks:
                df_chunk = limpar_dados(df_chunk)
                try:
                    inserir_via_copy(conn, df_chunk, tabela)
                    bytes_chunk = df_chunk.memory_usage(index=True, deep=True).sum()
                    barra.update(int(bytes_chunk * 0.35))
                    total_linhas += len(df_chunk)
                except Exception as e:
                    print(f"    [X] Erro no lote: {e}")
                    continue
    return total_linhas

def processar_zip(caminho_zip, tabela, colunas):
    print(f"\n{'='*60}\n[*] ARQUIVO: {os.path.basename(caminho_zip)}\n    -> Tabela: {tabela}\n{'='*60}")
    try:
        with zipfile.ZipFile(caminho_zip, 'r') as z:
            nomes_arquivos = z.namelist()
            if not nomes_arquivos: return
            nome_csv = nomes_arquivos[0]
            z.extract(nome_csv, PASTA_DADOS)
            caminho_csv = os.path.join(PASTA_DADOS, nome_csv)
            
            processar_csv(caminho_csv, tabela, colunas)
            
            os.remove(caminho_csv)
    except Exception as e:
        print(f"    [X] Falha: {e}")

def main():
    if not os.path.exists(PASTA_DADOS):
        print(f"[Erro] Pasta {PASTA_DADOS} não encontrada.")
        return

    arquivos = sorted([f for f in os.listdir(PASTA_DADOS) if f.endswith(".zip")])
    print(f"--- Iniciando Importação ({len(arquivos)} arquivos) ---")

    for arquivo in arquivos:
        caminho = os.path.join(PASTA_DADOS, arquivo)
        
        # Mapeamento de Arquivos Principais
        if "Empresas" in arquivo: processar_zip(caminho, "empresas", COLUNAS_EMPRESAS)
        elif "Estabelecimentos" in arquivo: processar_zip(caminho, "estabelecimentos", COLUNAS_ESTABELECIMENTOS)
        elif "Socios" in arquivo: processar_zip(caminho, "socios", COLUNAS_SOCIOS)
        
        # Mapeamento de Tabelas de Referência
        elif "Cnaes" in arquivo: processar_zip(caminho, "cnaes", COLUNAS_CNAES)
        elif "Naturezas" in arquivo: processar_zip(caminho, "naturezas", COLUNAS_NATUREZAS)
        elif "Municipios" in arquivo: processar_zip(caminho, "municipios", COLUNAS_MUNICIPIOS)
        
        else: print(f"[Ignorado] {arquivo}")

    print("\n[FIM] Processamento concluído!")

if __name__ == "__main__":
    main()