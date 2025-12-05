import os
import pandas as pd
from sqlalchemy import create_engine, text
import io
import time
from tqdm import tqdm
import zipfile
import gc

# --- CONFIGURAÇÕES ---
DB_USER = "user_cnpj"
DB_PASS = "password_cnpj"
DB_HOST = "127.0.0.1"
DB_PORT = "5433"
DB_NAME = "cnpj_dados"
DATABASE_URL = f"postgresql+pg8000://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
PASTA_DADOS = "./dados"

# Tamanho do lote reduzido para garantir estabilidade em VPS (10k linhas por vez)
TAMANHO_CHUNK = 10000 

# --- DEFINIÇÃO DAS COLUNAS (LAYOUT RECEITA FEDERAL) ---

# 1. Tabelas Principais
COLUNAS_EMPRESAS = ["cnpj_basico", "razao_social", "natureza_juridica", "qualificacao_responsavel", "capital_social", "porte_empresa", "ente_federativo_responsavel"]
COLUNAS_ESTABELECIMENTOS = ["cnpj_basico", "cnpj_ordem", "cnpj_dv", "identificador_matriz_filial", "nome_fantasia", "situacao_cadastral", "data_situacao_cadastral", "motivo_situacao_cadastral", "nome_cidade_exterior", "pais", "data_inicio_atividade", "cnae_fiscal_principal", "cnae_fiscal_secundaria", "tipo_de_logradouro", "logradouro", "numero", "complemento", "bairro", "cep", "uf", "municipio", "ddd_1", "telefone_1", "ddd_2", "telefone_2", "ddd_fax", "fax", "correio_eletronico", "situacao_especial", "data_situacao_especial"]
COLUNAS_SOCIOS = ["cnpj_basico", "identificador_socio", "nome_socio_razao_social", "cpf_cnpj_socio", "qualificacao_socio", "data_entrada_sociedade", "pais", "representante_legal", "nome_representante", "qualificacao_representante", "faixa_etaria"]

# 2. Tabelas de Referência (Simples: Código + Descrição)
COLUNAS_DOMINIO = ["codigo", "descricao"]

def get_engine():
    # Timeout de 10 minutos para conexões lentas
    return create_engine(DATABASE_URL, isolation_level="AUTOCOMMIT", connect_args={"timeout": 600})

def limpar_dados(df):
    """
    Remove caracteres nulos e espaços que quebram a importação do Postgres.
    """
    df = df.fillna("")
    # Otimização: Aplica limpeza apenas em colunas de texto
    cols_texto = df.select_dtypes(include=['object']).columns
    if len(cols_texto) > 0:
        df[cols_texto] = df[cols_texto].astype(str).apply(lambda x: x.str.strip().str.replace('\x00', '', regex=False))
    return df

def inserir_via_copy(conn, df, tabela):
    """
    Usa o comando COPY do Postgres para inserção ultra-rápida via stream.
    """
    output = io.StringIO()
    # Exporta para CSV em memória (sem header, separado por tabulação)
    df.to_csv(output, sep='\t', header=False, index=False)
    output.seek(0)
    
    dbapi_conn = conn.connection
    cursor = dbapi_conn.cursor()
    
    columns_str = ",".join(df.columns)
    sql_copy = f"COPY {tabela} ({columns_str}) FROM STDIN WITH (FORMAT CSV, DELIMITER '\t', NULL '', QUOTE '\"', ESCAPE '\\')"
    
    cursor.execute(sql_copy, stream=output)
    output.close()

def processar_csv(caminho_csv, tabela, colunas):
    engine = get_engine()
    tamanho_arquivo = os.path.getsize(caminho_csv)
    print(f"    -> Processando CSV: {os.path.basename(caminho_csv)} ({tamanho_arquivo/1024/1024:.2f} MB)")

    # Tenta configurar sessão para performance (synchronous_commit off)
    try:
        with engine.connect() as conn:
            conn.execute(text("SET synchronous_commit = off;"))
            conn.execute(text("SET temp_buffers = '32MB';"))
    except: pass

    # Leitura em blocos (Chunks)
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

    linhas_importadas = 0
    
    with engine.connect() as conn:
        # Garante configuração na conexão ativa
        conn.execute(text("SET synchronous_commit = off;"))
        
        with tqdm(total=tamanho_arquivo, unit='B', unit_scale=True, desc="    Importando DB") as barra:
            for df_chunk in chunks:
                df_chunk = limpar_dados(df_chunk)
                
                # Sistema de Retry (Tenta 3 vezes se o banco cair)
                tentativas = 3
                while tentativas > 0:
                    try:
                        inserir_via_copy(conn, df_chunk, tabela)
                        
                        # Atualiza barra de progresso
                        bytes_chunk = df_chunk.memory_usage(index=True, deep=True).sum()
                        barra.update(int(bytes_chunk * 0.35)) # 0.35 é um fator de correção estimado csv/dataframe
                        linhas_importadas += len(df_chunk)
                        break # Sucesso
                    except Exception as e:
                        print(f"    [!] Erro de conexão ({e}). Tentando reconectar em 5s...")
                        time.sleep(5)
                        tentativas -= 1
                        # Tenta recriar conexão se falhou muito
                        try:
                            if tentativas == 1: conn = engine.connect()
                        except: pass
                        
                        if tentativas == 0:
                            print(f"    [X] Falha crítica no lote. Pulando.")

                # Limpeza de Memória Explícita (Crítico para VPS)
                del df_chunk
                gc.collect()

    return linhas_importadas

def processar_zip(caminho_zip, tabela, colunas):
    print(f"\n{'='*60}\n[*] ARQUIVO: {os.path.basename(caminho_zip)}\n    -> Tabela Destino: {tabela}\n{'='*60}")
    try:
        with zipfile.ZipFile(caminho_zip, 'r') as z:
            # Assume que há apenas 1 CSV dentro do ZIP (padrão da Receita)
            nomes_arquivos = z.namelist()
            if not nomes_arquivos: return
            
            nome_csv = nomes_arquivos[0]
            # Extrai
            z.extract(nome_csv, PASTA_DADOS)
            caminho_csv = os.path.join(PASTA_DADOS, nome_csv)
            
            # Processa
            processar_csv(caminho_csv, tabela, colunas)
            
            # Limpa disco imediatamente
            os.remove(caminho_csv)
            gc.collect()
            
    except Exception as e:
        print(f"    [X] Falha ao processar ZIP {caminho_zip}: {e}")

def main():
    if not os.path.exists(PASTA_DADOS):
        print(f"[Erro] Pasta {PASTA_DADOS} não encontrada.")
        return

    arquivos = sorted([f for f in os.listdir(PASTA_DADOS) if f.endswith(".zip")])
    print(f"--- Iniciando Importação Completa ({len(arquivos)} arquivos encontrados) ---")
    print("OBS: Certifique-se de que os arquivos já processados foram removidos ou movidos, senão serão duplicados.")

    for arquivo in arquivos:
        caminho = os.path.join(PASTA_DADOS, arquivo)
        
        # Mapeamento Inteligente de Arquivos
        if "Empresas" in arquivo: processar_zip(caminho, "empresas", COLUNAS_EMPRESAS)
        elif "Estabelecimentos" in arquivo: processar_zip(caminho, "estabelecimentos", COLUNAS_ESTABELECIMENTOS)
        elif "Socios" in arquivo: processar_zip(caminho, "socios", COLUNAS_SOCIOS)
        
        # Tabelas de Domínio (Referência)
        elif "Cnaes" in arquivo: processar_zip(caminho, "cnaes", COLUNAS_DOMINIO)
        elif "Naturezas" in arquivo: processar_zip(caminho, "naturezas", COLUNAS_DOMINIO)
        elif "Municipios" in arquivo: processar_zip(caminho, "municipios", COLUNAS_DOMINIO)
        elif "Qualificacoes" in arquivo: processar_zip(caminho, "qualificacoes", COLUNAS_DOMINIO) # ESSENCIAL PARA O EXPORTAR
        elif "Paises" in arquivo: processar_zip(caminho, "paises", COLUNAS_DOMINIO)
        elif "Motivos" in arquivo: processar_zip(caminho, "motivos", COLUNAS_DOMINIO)
        
        else:
            print(f"[Ignorado] {arquivo} (Não corresponde a uma tabela conhecida)")

    print("\n[FIM] Processamento concluído com sucesso!")

if __name__ == "__main__":
    main()