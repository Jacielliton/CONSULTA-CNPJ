import os
from sqlalchemy import create_engine, text
from passlib.context import CryptContext
from dotenv import load_dotenv

# 1. Carregar variáveis de ambiente
load_dotenv()

# 2. Configurações
DB_USER = os.getenv("DB_USER", "user_cnpj")
DB_PASS = os.getenv("DB_PASS", "password_cnpj")
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "5433")
DB_NAME = os.getenv("DB_NAME", "cnpj_dados")

ADMIN_NAME = os.getenv("ADMIN_NAME")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
ADMIN_CONTACT = os.getenv("ADMIN_CONTACT")

if not ADMIN_EMAIL or not ADMIN_PASSWORD:
    print("[ERRO] Variáveis ADMIN_EMAIL ou ADMIN_PASSWORD não definidas no .env")
    exit(1)

DATABASE_URL = f"postgresql+pg8000://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# 3. Configuração de Hashing (Igual ao main.py)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def criar_admin():
    print("--- CRIANDO USUÁRIO ADMINISTRADOR ---")
    print(f"[*] Conectando ao banco em {DB_HOST}:{DB_PORT}...")
    
    try:
        engine = create_engine(DATABASE_URL)
        
        with engine.connect() as conn:
            # Verifica se já existe
            usuario_existente = conn.execute(
                text("SELECT id FROM users WHERE email = :email"),
                {"email": ADMIN_EMAIL}
            ).fetchone()

            senha_hash = get_password_hash(ADMIN_PASSWORD)

            if usuario_existente:
                print(f"[*] O usuário '{ADMIN_EMAIL}' já existe. Atualizando permissões e senha...")
                conn.execute(text("""
                    UPDATE users 
                    SET senha_hash = :senha, 
                        is_admin = TRUE, 
                        nome = :nome,
                        contato = :contato
                    WHERE email = :email
                """), {
                    "senha": senha_hash,
                    "nome": ADMIN_NAME,
                    "contato": ADMIN_CONTACT,
                    "email": ADMIN_EMAIL
                })
                print("[SUCESSO] Usuário atualizado para ADMIN.")
            else:
                print(f"[*] Criando novo usuário '{ADMIN_EMAIL}'...")
                conn.execute(text("""
                    INSERT INTO users (nome, email, senha_hash, contato, is_admin)
                    VALUES (:nome, :email, :senha, :contato, TRUE)
                """), {
                    "nome": ADMIN_NAME,
                    "email": ADMIN_EMAIL,
                    "senha": senha_hash,
                    "contato": ADMIN_CONTACT
                })
                print("[SUCESSO] Usuário ADMIN criado.")
            
            conn.commit()

    except Exception as e:
        print(f"[X] Erro ao criar admin: {e}")

if __name__ == "__main__":
    criar_admin()