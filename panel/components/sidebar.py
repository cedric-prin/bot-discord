import streamlit as st
from panel.utils.auth import logout
from panel.config import PANEL_CONFIG

def render_sidebar():
    """Render la sidebar avec infos et navigation"""
    
    with st.sidebar:
        # Logo/Titre
        st.markdown("""
        <div style="text-align: center; padding: 1rem;">
            <h2>🤖 Bot Panel</h2>
        </div>
        """, unsafe_allow_html=True)
        
        st.divider()
        
        # Infos utilisateur connecté
        if 'username' in st.session_state and st.session_state.username:
            st.markdown(f"""
            <div style="
                background: #5865F2;
                padding: 0.75rem;
                border-radius: 8px;
                margin-bottom: 1rem;
            ">
                <p style="margin: 0; color: white;">
                    👤 Connecté en tant que<br>
                    <strong>{st.session_state.username}</strong>
                </p>
            </div>
            """, unsafe_allow_html=True)
        
        # Sélecteur de serveur
        guilds = get_guild_list()
        if guilds:
            guild_names = [g['name'] for g in guilds]
            
            # Trouver l'index du serveur actuellement sélectionné
            current_guild_id = st.session_state.get('selected_guild_id')
            current_index = 0
            if current_guild_id:
                for i, guild in enumerate(guilds):
                    if guild['id'] == current_guild_id:
                        current_index = i
                        break
            
            selected_guild_name = st.selectbox(
                "🏠 Serveur actif",
                options=guild_names,
                index=current_index,
                key="guild_selector_name"
            )
            
            # Mettre à jour l'ID du serveur sélectionné
            selected_guild = guilds[guild_names.index(selected_guild_name)]
            st.session_state.selected_guild_id = selected_guild['id']
            
            # Afficher l'ID du serveur sélectionné
            st.caption(f"ID: `{selected_guild['id']}`")
        else:
            st.warning("Aucun serveur disponible")
        
        st.divider()
        
        # Navigation manuelle (en plus des pages auto)
        st.markdown("### 📌 Raccourcis")
        
        col1, col2 = st.columns(2)
        with col1:
            if st.button("🔄 Refresh", use_container_width=True):
                st.cache_data.clear()
                st.rerun()
        with col2:
            if st.button("🚪 Logout", use_container_width=True):
                logout()
                st.rerun()
        
        # Spacer
        st.markdown("<br>" * 5, unsafe_allow_html=True)
        
        # Footer sidebar
        st.divider()
        st.caption(f"v{PANEL_CONFIG['version']}")
        
        # Status BDD
        try:
            from database.python.connection import get_connection
            conn = get_connection()
            conn.close()
            st.success("� BDD connectée", icon="✅")
        except:
            st.error("🔴 BDD déconnectée", icon="❌")

def get_guild_list():
    """Récupère la liste des serveurs depuis la BDD"""
    try:
        from database.python.connection import get_connection
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id, name FROM guilds ORDER BY name")
        guilds_raw = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        if guilds_raw:
            guilds = []
            for row in guilds_raw:
                guilds.append({
                    'id': row[0],
                    'name': row[1]
                })
            return guilds
        else:
            return [{"id": None, "name": "Aucun serveur"}]
        
    except Exception as e:
        return [{"id": None, "name": f"Erreur: {e}"}]

def get_selected_guild_id():
    """Retourne l'ID du serveur sélectionné"""
    if 'selected_guild_id' in st.session_state:
        return st.session_state.selected_guild_id
    return None
