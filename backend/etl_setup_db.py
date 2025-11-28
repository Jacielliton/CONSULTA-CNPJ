import sqlalchemy
from sqlalchemy import create_engine, text

# --- CONFIGURAÇÕES ---
DB_USER = "user_cnpj"
DB_PASS = "password_cnpj"
DB_HOST = "127.0.0.1"
DB_PORT = "5433"
DB_NAME = "cnpj_dados"

DATABASE_URL = f"postgresql+pg8000://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

def get_engine():
    return create_engine(DATABASE_URL, isolation_level="AUTOCOMMIT")

def criar_tabelas():
    print(f"[*] Conectando ao banco {DB_HOST}:{DB_PORT}...")
    try:
        engine = get_engine()
        
        with engine.connect() as conn:
            print("[*] Criando tabelas principais...")
            
            # 1. Tabelas Principais (Já existiam)
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS empresas (
                    cnpj_basico VARCHAR(8),
                    razao_social TEXT,
                    natureza_juridica VARCHAR(4),
                    qualificacao_responsavel VARCHAR(2),
                    capital_social VARCHAR(20),
                    porte_empresa VARCHAR(2),
                    ente_federativo_responsavel TEXT
                );
            """))
            
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS estabelecimentos (
                    cnpj_basico VARCHAR(8),
                    cnpj_ordem VARCHAR(4),
                    cnpj_dv VARCHAR(2),
                    identificador_matriz_filial CHAR(1),
                    nome_fantasia TEXT,
                    situacao_cadastral CHAR(2),
                    data_situacao_cadastral VARCHAR(8),
                    motivo_situacao_cadastral VARCHAR(2),
                    nome_cidade_exterior TEXT,
                    pais VARCHAR(3),
                    data_inicio_atividade VARCHAR(8),
                    cnae_fiscal_principal VARCHAR(7),
                    cnae_fiscal_secundaria TEXT,
                    tipo_de_logradouro TEXT,
                    logradouro TEXT,
                    numero TEXT,
                    complemento TEXT,
                    bairro TEXT,
                    cep VARCHAR(8),
                    uf VARCHAR(2),
                    municipio VARCHAR(4),
                    ddd_1 VARCHAR(4),
                    telefone_1 VARCHAR(12),
                    ddd_2 VARCHAR(4),
                    telefone_2 VARCHAR(12),
                    ddd_fax VARCHAR(4),
                    fax VARCHAR(12),
                    correio_eletronico TEXT,
                    situacao_especial TEXT,
                    data_situacao_especial VARCHAR(8)
                );
            """))
            
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS socios (
                    cnpj_basico VARCHAR(8),
                    identificador_socio VARCHAR(1),
                    nome_socio_razao_social TEXT,
                    cpf_cnpj_socio VARCHAR(14),
                    qualificacao_socio VARCHAR(2),
                    data_entrada_sociedade VARCHAR(8),
                    pais VARCHAR(3),
                    representante_legal VARCHAR(11),
                    nome_representante TEXT,
                    qualificacao_representante VARCHAR(2),
                    faixa_etaria VARCHAR(1)
                );
            """))

            # 2. Tabelas de Referência (NOVAS)
            print("[*] Criando tabelas de referência (CNAE, Natureza, Município)...")
            
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS cnaes (
                    codigo VARCHAR(7),
                    descricao TEXT
                );
            """))
            
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS naturezas (
                    codigo VARCHAR(4),
                    descricao TEXT
                );
            """))
            
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS municipios (
                    codigo VARCHAR(4),
                    descricao TEXT
                );
            """))
            
            # Criação de Índices Básicos para as novas tabelas
            print("[*] Criando índices das tabelas de referência...")
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_cnae_codigo ON cnaes (codigo);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_nat_codigo ON naturezas (codigo);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_mun_codigo ON municipios (codigo);"))

        print("[SUCESSO] Estrutura do banco atualizada!")
        
    except Exception as e:
        print(f"[X] Erro: {e}")

if __name__ == "__main__":
    criar_tabelas()