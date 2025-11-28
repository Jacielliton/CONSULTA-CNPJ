from sqlalchemy import create_engine, text

# Configuração
DB_USER = "user_cnpj"
DB_PASS = "password_cnpj"
DB_HOST = "127.0.0.1"
DB_PORT = "5433"
DB_NAME = "cnpj_dados"
DATABASE_URL = f"postgresql+pg8000://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL)

def checar():
    print("--- CONTAGEM DE DADOS ---")
    with engine.connect() as conn:
        cnaes = conn.execute(text("SELECT count(*) FROM cnaes")).scalar()
        nats = conn.execute(text("SELECT count(*) FROM naturezas")).scalar()
        muns = conn.execute(text("SELECT count(*) FROM municipios")).scalar()
        empresas = conn.execute(text("SELECT count(*) FROM empresas")).scalar()
        
    print(f"CNAEs (Atividades): {cnaes} (Esperado ~1.300)")
    print(f"Naturezas Jurídicas: {nats} (Esperado ~90)")
    print(f"Municípios: {muns} (Esperado ~5.570)")
    print(f"Empresas Totais: {empresas}")
    print("-------------------------")

if __name__ == "__main__":
    checar()