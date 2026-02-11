import streamlit as st
import hashlib
import time
from panel.config import AUTH_CONFIG

def hash_password(password: str) -> str:
    """Hash un mot de passe avec SHA-256"""
    return hashlib.sha256(password.encode()).hexdigest()

def check_auth() -> bool:
    """Vérifie si l'utilisateur est authentifié"""
    
    # Si auth désactivée, toujours autoriser
    if not AUTH_CONFIG['enabled']:
        return True
    
    # Vérifier la session
    if 'authenticated' not in st.session_state:
        st.session_state.authenticated = False
        st.session_state.auth_time = None
    
    # Vérifier expiration
    if st.session_state.authenticated and st.session_state.auth_time:
        elapsed = time.time() - st.session_state.auth_time
        if elapsed > AUTH_CONFIG['session_expiry']:
            st.session_state.authenticated = False
            st.session_state.auth_time = None
            st.warning("Session expirée. Veuillez vous reconnecter.")
    
    return st.session_state.authenticated

def login(username: str, password: str) -> bool:
    """Tente de connecter l'utilisateur"""
    
    # Vérifier les credentials
    if username == AUTH_CONFIG['username'] and password == AUTH_CONFIG['password']:
        st.session_state.authenticated = True
        st.session_state.auth_time = time.time()
        st.session_state.username = username
        return True
    
    return False

def logout():
    """Déconnecte l'utilisateur"""
    st.session_state.authenticated = False
    st.session_state.auth_time = None
    st.session_state.username = None

def login_page():
    """Affiche la page de connexion"""
    
    st.markdown("""
    <style>
        .login-container {
            max-width: 400px;
            margin: 100px auto;
            padding: 2rem;
            background: #2C2F33;
            border-radius: 15px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }
        .login-header {
            text-align: center;
            margin-bottom: 2rem;
        }
        .login-header h1 {
            color: #5865F2;
        }
    </style>
    """, unsafe_allow_html=True)
    
    col1, col2, col3 = st.columns([1, 2, 1])
    
    with col2:
        st.markdown("""
        <div class="login-header">
            <h1>🤖 Bot Panel</h1>
            <p>Connectez-vous pour accéder au panel</p>
        </div>
        """, unsafe_allow_html=True)
        
        with st.form("login_form"):
            username = st.text_input("👤 Nom d'utilisateur")
            password = st.text_input("🔒 Mot de passe", type="password")
            
            submitted = st.form_submit_button("Se connecter", use_container_width=True)
            
            if submitted:
                if username and password:
                    if login(username, password):
                        st.success("✅ Connexion réussie!")
                        time.sleep(1)
                        st.rerun()
                    else:
                        st.error("❌ Identifiants incorrects")
                else:
                    st.warning("Veuillez remplir tous les champs")
        
        st.divider()
        st.caption("💡 Contactez l'administrateur si vous avez oublié vos identifiants")

def require_auth(func):
    """Décorateur pour protéger une page"""
    def wrapper(*args, **kwargs):
        if not check_auth():
            login_page()
            st.stop()
        return func(*args, **kwargs)
    return wrapper
