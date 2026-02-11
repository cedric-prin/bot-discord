import streamlit as st
import pandas as pd
from datetime import datetime
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from database.python.connection import get_connection
from panel.utils.auth import require_auth
from panel.components.sidebar import render_sidebar, get_selected_guild_id

st.set_page_config(page_title="Modération", page_icon="⚔️", layout="wide")

@require_auth
def main():
    render_sidebar()
    
    st.title("⚔️ Modération")
    
    guild_id = get_selected_guild_id()
    
    if not guild_id:
        st.warning("Veuillez sélectionner un serveur dans la sidebar")
        return
    
    # Tabs
    tab1, tab2, tab3 = st.tabs(["⚠️ Warnings", "🔨 Sanctions", "🔍 Recherche"])
    
    # ============ TAB WARNINGS ============
    with tab1:
        st.subheader("⚠️ Gestion des Warnings")
        
        # Filtres
        col1, col2, col3 = st.columns(3)
        with col1:
            search_user = st.text_input("🔍 Rechercher User ID", key="warn_search")
        with col2:
            sort_by = st.selectbox(
                "📊 Trier par",
                ["Plus récent", "Plus ancien", "User ID"],
                key="warn_sort"
            )
        with col3:
            per_page = st.selectbox("📄 Par page", [10, 25, 50, 100], key="warn_per_page")
        
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            # Construire la requête
            query = "SELECT * FROM warnings WHERE guild_id = ?"
            params = [guild_id]
            
            if search_user:
                query += " AND user_id LIKE ?"
                params.append(f"%{search_user}%")
            
            # Tri
            if sort_by == "Plus récent":
                query += " ORDER BY created_at DESC"
            elif sort_by == "Plus ancien":
                query += " ORDER BY created_at ASC"
            else:
                query += " ORDER BY user_id"
            
            query += f" LIMIT {per_page}"
            
            cursor.execute(query, params)
            warnings_raw = cursor.fetchall()
            
            if warnings_raw:
                # Convertir en liste de dict pour manipulation
                warnings = []
                for row in warnings_raw:
                    warnings.append({
                        'id': row[0],
                        'guild_id': row[1],
                        'user_id': row[2],
                        'moderator_id': row[3],
                        'reason': row[4],
                        'created_at': row[5]
                    })
                
                # Afficher comme dataframe éditable
                df = pd.DataFrame(warnings)
                
                # Sélection pour suppression
                st.markdown("**Sélectionner pour supprimer:**")
                
                selected_ids = []
                for idx, row in df.iterrows():
                    col1, col2, col3, col4, col5 = st.columns([1, 2, 2, 4, 1])
                    
                    with col1:
                        if st.checkbox("", key=f"warn_{row['id']}"):
                            selected_ids.append(row['id'])
                    with col2:
                        st.text(f"User: {row['user_id']}")
                    with col3:
                        st.text(f"Mod: {row['moderator_id']}")
                    with col4:
                        st.text(f"{str(row['reason'])[:50]}..." if len(str(row['reason'])) > 50 else row['reason'])
                    with col5:
                        st.text(row['created_at'].strftime('%d/%m/%y') if row['created_at'] else '-')
                
                # Bouton suppression
                if selected_ids:
                    st.divider()
                    col1, col2 = st.columns([3, 1])
                    with col2:
                        if st.button(f"🗑️ Supprimer ({len(selected_ids)})", type="primary"):
                            placeholders = ','.join(['?'] * len(selected_ids))
                            cursor.execute(f"DELETE FROM warnings WHERE id IN ({placeholders})", selected_ids)
                            conn.commit()
                            st.success(f"✅ {len(selected_ids)} warning(s) supprimé(s)")
                            st.rerun()
            else:
                st.info("Aucun warning trouvé")
            
            cursor.close()
            conn.close()
            
        except Exception as e:
            st.error(f"Erreur: {e}")
    
    # ============ TAB SANCTIONS ============
    with tab2:
        st.subheader("🔨 Gestion des Sanctions")
        
        # Filtres
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            search_user_s = st.text_input("🔍 User ID", key="sanc_search")
        with col2:
            filter_type = st.selectbox(
                "📋 Type",
                ["Tous", "mute", "ban", "kick"],
                key="sanc_type"
            )
        with col3:
            filter_active = st.selectbox(
                "📊 Status",
                ["Tous", "Actives", "Expirées"],
                key="sanc_active"
            )
        with col4:
            per_page_s = st.selectbox("📄 Par page", [10, 25, 50], key="sanc_per_page")
        
        try:
            conn = get_connection()
            cursor = conn.cursor()
            
            query = "SELECT * FROM sanctions WHERE guild_id = ?"
            params = [guild_id]
            
            if search_user_s:
                query += " AND user_id LIKE ?"
                params.append(f"%{search_user_s}%")
            
            if filter_type != "Tous":
                query += " AND type = ?"
                params.append(filter_type)
            
            if filter_active == "Actives":
                query += " AND active = 1"
            elif filter_active == "Expirées":
                query += " AND active = 0"
            
            query += f" ORDER BY created_at DESC LIMIT {per_page_s}"
            
            cursor.execute(query, params)
            sanctions_raw = cursor.fetchall()
            
            if sanctions_raw:
                # Convertir en liste de dict
                sanctions = []
                for row in sanctions_raw:
                    sanctions.append({
                        'id': row[0],
                        'guild_id': row[1],
                        'user_id': row[2],
                        'moderator_id': row[3],
                        'type': row[4],
                        'reason': row[5],
                        'active': bool(row[6]),
                        'created_at': row[7],
                        'expires_at': row[8] if len(row) > 8 else None,
                        'removed_at': row[9] if len(row) > 9 else None
                    })
                
                for sanction in sanctions:
                    with st.expander(
                        f"{'🟢' if sanction['active'] else '⚫'} "
                        f"**{sanction['type'].upper()}** - "
                        f"User: {sanction['user_id']} - "
                        f"{sanction['created_at'].strftime('%d/%m/%Y %H:%M') if sanction['created_at'] else '-'}"
                    ):
                        col1, col2 = st.columns(2)
                        
                        with col1:
                            st.markdown(f"**ID:** `{sanction['id']}`")
                            st.markdown(f"**User ID:** `{sanction['user_id']}`")
                            st.markdown(f"**Modérateur:** `{sanction['moderator_id']}`")
                            st.markdown(f"**Type:** `{sanction['type']}`")
                        
                        with col2:
                            st.markdown(f"**Active:** {'✅ Oui' if sanction['active'] else '❌ Non'}")
                            st.markdown(f"**Créée:** {sanction['created_at']}")
                            if sanction.get('expires_at'):
                                st.markdown(f"**Expire:** {sanction['expires_at']}")
                            if sanction.get('removed_at'):
                                st.markdown(f"**Retirée:** {sanction['removed_at']}")
                        
                        st.markdown(f"**Raison:** {sanction['reason']}")
                        
                        # Actions
                        col1, col2, col3 = st.columns(3)
                        with col1:
                            if sanction['active'] and st.button("⏹️ Désactiver", key=f"deact_{sanction['id']}"):
                                cursor.execute(
                                    "UPDATE sanctions SET active = 0, removed_at = CURRENT_TIMESTAMP WHERE id = ?",
                                    (sanction['id'],)
                                )
                                conn.commit()
                                st.success("Sanction désactivée")
                                st.rerun()
                        with col3:
                            if st.button("🗑️ Supprimer", key=f"del_{sanction['id']}"):
                                cursor.execute("DELETE FROM sanctions WHERE id = ?", (sanction['id'],))
                                conn.commit()
                                st.success("Sanction supprimée")
                                st.rerun()
            else:
                st.info("Aucune sanction trouvée")
            
            cursor.close()
            conn.close()
            
        except Exception as e:
            st.error(f"Erreur: {e}")
    
    # ============ TAB RECHERCHE ============
    with tab3:
        st.subheader("🔍 Recherche utilisateur")
        
        user_id_search = st.text_input("Entrez l'ID utilisateur", key="global_search")
        
        if user_id_search:
            try:
                conn = get_connection()
                cursor = conn.cursor()
                
                # Infos utilisateur
                cursor.execute("""
                    SELECT * FROM users WHERE user_id = ? AND guild_id = ?
                """, (user_id_search, guild_id))
                user_info_raw = cursor.fetchone()
                
                if user_info_raw:
                    user_info = {
                        'user_id': user_info_raw[0],
                        'guild_id': user_info_raw[1],
                        'username': user_info_raw[2] if len(user_info_raw) > 2 else None,
                        'created_at': user_info_raw[3] if len(user_info_raw) > 3 else None
                    }
                    
                    st.markdown(f"### 👤 Utilisateur trouvé")
                    col1, col2 = st.columns(2)
                    with col1:
                        st.metric("User ID", user_info['user_id'])
                    with col2:
                        st.metric("Username", user_info.get('username', 'N/A'))
                else:
                    st.markdown(f"### 👤 Utilisateur (ID: {user_id_search})")
                
                # Warnings de l'utilisateur
                cursor.execute("""
                    SELECT * FROM warnings 
                    WHERE user_id = ? AND guild_id = ?
                    ORDER BY created_at DESC
                """, (user_id_search, guild_id))
                user_warnings_raw = cursor.fetchall()
                
                user_warnings = []
                for row in user_warnings_raw:
                    user_warnings.append({
                        'id': row[0],
                        'reason': row[4],
                        'moderator_id': row[3],
                        'created_at': row[5]
                    })
                
                st.markdown(f"### ⚠️ Warnings ({len(user_warnings)})")
                if user_warnings:
                    df = pd.DataFrame(user_warnings)
                    st.dataframe(df[['id', 'reason', 'moderator_id', 'created_at']], 
                                use_container_width=True, hide_index=True)
                else:
                    st.success("Aucun warning")
                
                # Sanctions de l'utilisateur
                cursor.execute("""
                    SELECT * FROM sanctions 
                    WHERE user_id = ? AND guild_id = ?
                    ORDER BY created_at DESC
                """, (user_id_search, guild_id))
                user_sanctions_raw = cursor.fetchall()
                
                user_sanctions = []
                for row in user_sanctions_raw:
                    user_sanctions.append({
                        'id': row[0],
                        'type': row[4],
                        'reason': row[5],
                        'active': bool(row[6]),
                        'created_at': row[7]
                    })
                
                st.markdown(f"### 🔨 Sanctions ({len(user_sanctions)})")
                if user_sanctions:
                    df = pd.DataFrame(user_sanctions)
                    st.dataframe(df[['id', 'type', 'reason', 'active', 'created_at']], 
                                use_container_width=True, hide_index=True)
                else:
                    st.success("Aucune sanction")
                
                cursor.close()
                conn.close()
                
            except Exception as e:
                st.error(f"Erreur: {e}")

if __name__ == "__main__":
    main()
