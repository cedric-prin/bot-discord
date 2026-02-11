import streamlit as st
import sys
from pathlib import Path

# Ajouter le dossier parent au path pour les imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.python.connection import get_connection
from panel.utils.auth import check_auth, login_page
from panel.components.sidebar import render_sidebar

# Configuration de la page
st.set_page_config(
    page_title="Bot Modération - Panel",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded",
    menu_items={
        'Get Help': 'https://github.com/yourrepo',
        'Report a bug': 'https://github.com/yourrepo/issues',
        'About': '# Bot de Modération Discord\nPanel d\'administration v1.0'
    }
)

# CSS personnalisé
st.markdown("""
<style>
    /* Couleurs Discord */
    :root {
        --discord-blurple: #5865F2;
        --discord-green: #57F287;
        --discord-yellow: #FEE75C;
        --discord-red: #ED4245;
        --discord-dark: #2C2F33;
        --discord-darker: #23272A;
    }
    
    /* Header */
    .main-header {
        background: linear-gradient(90deg, var(--discord-blurple), #7289DA);
        padding: 1rem 2rem;
        border-radius: 10px;
        margin-bottom: 2rem;
        color: white;
    }
    
    /* Cards */
    .metric-card {
        background: var(--discord-dark);
        padding: 1.5rem;
        border-radius: 10px;
        border-left: 4px solid var(--discord-blurple);
    }
    
    /* Stat positive */
    .stat-positive {
        color: var(--discord-green);
    }
    
    /* Stat negative */
    .stat-negative {
        color: var(--discord-red);
    }
    
    /* Table style */
    .dataframe {
        border-radius: 10px;
        overflow: hidden;
    }
    
    /* Sidebar */
    [data-testid="stSidebar"] {
        background-color: var(--discord-darker);
    }
    
    /* Hide Streamlit branding */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
</style>
""", unsafe_allow_html=True)

def main():
    """Point d'entrée principal"""
    
    # Vérifier l'authentification
    if not check_auth():
        login_page()
        return
    
    # Render sidebar avec infos utilisateur
    render_sidebar()
    
    # Page d'accueil
    st.markdown("""
    <div class="main-header">
        <h1>🤖 Bot de Modération</h1>
        <p>Panel d'administration</p>
    </div>
    """, unsafe_allow_html=True)
    
    # Quick stats
    col1, col2, col3, col4 = st.columns(4)
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Nombre de serveurs
        cursor.execute("SELECT COUNT(*) as count FROM guilds")
        guilds_count = cursor.fetchone()['count']
        
        # Nombre d'utilisateurs uniques
        cursor.execute("SELECT COUNT(DISTINCT discord_id) as count FROM users WHERE is_active = 1")
        users_count = cursor.fetchone()['count']
        
        # Warnings aujourd'hui
        cursor.execute("""
            SELECT COUNT(*) as count FROM warnings 
            WHERE DATE(created_at) = DATE('now')
        """)
        warnings_today = cursor.fetchone()['count']
        
        # Sanctions actives
        cursor.execute("""
            SELECT COUNT(*) as count FROM sanctions 
            WHERE active = 1
        """)
        active_sanctions = cursor.fetchone()['count']
        
        cursor.close()
        conn.close()
        
        with col1:
            st.metric(
                label="🏠 Serveurs",
                value=guilds_count,
                delta=None
            )
        
        with col2:
            st.metric(
                label="👥 Utilisateurs",
                value=users_count,
                delta=None
            )
        
        with col3:
            st.metric(
                label="⚠️ Warns aujourd'hui",
                value=warnings_today,
                delta=None
            )
        
        with col4:
            st.metric(
                label="🔨 Sanctions actives",
                value=active_sanctions,
                delta=None
            )
            
    except Exception as e:
        st.error(f"Erreur de connexion à la base de données: {e}")
    
    st.divider()
    
    # Navigation rapide
    st.subheader("🚀 Navigation rapide")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.markdown("""
        ### 📊 Dashboard
        Statistiques détaillées et graphiques de modération.
        """)
        if st.button("Ouvrir Dashboard", key="nav_dashboard"):
            st.switch_page("pages/1_Dashboard.py")
    
    with col2:
        st.markdown("""
        ### ⚔️ Modération
        Gérer les warnings et sanctions des utilisateurs.
        """)
        if st.button("Ouvrir Modération", key="nav_mod"):
            st.switch_page("pages/2_Moderation.py")
    
    with col3:
        st.markdown("""
        ### ⚙️ Configuration
        Configurer le bot pour vos serveurs.
        """)
        if st.button("Ouvrir Settings", key="nav_settings"):
            st.switch_page("pages/4_Settings.py")
    
    # Footer
    st.divider()
    st.caption("Bot de Modération v1.0 • Panel Streamlit")

if __name__ == "__main__":
    main()
