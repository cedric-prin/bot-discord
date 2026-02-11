import streamlit as st
import pandas as pd
import plotly.express as px
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from database.python.connection import get_connection
from panel.utils.auth import require_auth
from panel.components.sidebar import render_sidebar, get_selected_guild_id
from panel.config import COLORS

st.set_page_config(page_title="Utilisateurs", page_icon="👥", layout="wide")

@require_auth
def main():
    render_sidebar()
    
    st.title("👥 Utilisateurs")
    
    guild_id = get_selected_guild_id()
    
    if not guild_id:
        st.warning("Veuillez sélectionner un serveur dans la sidebar")
        return
    
    # Tabs
    tab1, tab2, tab3 = st.tabs(["📋 Liste", "📊 Statistiques", "⚠️ À surveiller"])
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # ============ TAB LISTE ============
        with tab1:
            st.subheader("📋 Liste des utilisateurs")
            
            # Filtres
            col1, col2, col3 = st.columns(3)
            with col1:
                search = st.text_input("🔍 Rechercher (ID ou username)")
            with col2:
                filter_warnings = st.selectbox(
                    "⚠️ Filtrer par warnings",
                    ["Tous", "Avec warnings", "Sans warnings", "3+ warnings"]
                )
            with col3:
                per_page = st.selectbox("📄 Par page", [25, 50, 100])
            
            # Requête
            query = """
                SELECT 
                    u.user_id,
                    u.username,
                    u.server_username,
                    u.joined_at,
                    COUNT(w.id) as warning_count
                FROM users u
                LEFT JOIN warnings w ON u.user_id = w.user_id AND u.guild_id = w.guild_id
                WHERE u.guild_id = ? AND u.is_active = 1
            """
            params = [guild_id]
            
            if search:
                query += " AND (u.user_id LIKE ? OR u.username LIKE ?)"
                params.extend([f"%{search}%", f"%{search}%"])
            
            query += " GROUP BY u.user_id, u.username, u.server_username"
            
            if filter_warnings == "Avec warnings":
                query += " HAVING warning_count > 0"
            elif filter_warnings == "Sans warnings":
                query += " HAVING warning_count = 0"
            elif filter_warnings == "3+ warnings":
                query += " HAVING warning_count >= 3"
            
            query += f" ORDER BY warning_count DESC LIMIT {per_page}"
            
            cursor.execute(query, params)
            users_raw = cursor.fetchall()
            
            if users_raw:
                # Convertir en liste de dict
                users = []
                for row in users_raw:
                    users.append({
                        'user_id': row[0],
                        'username': row[1],
                        'server_username': row[2],
                        'joined_at': row[3],
                        'warning_count': row[4]
                    })
                
                df = pd.DataFrame(users)
                
                # Formatter les dates
                def format_date(date_input):
                    if not date_input or date_input == '':
                        return '?'
                    try:
                        from datetime import datetime
                        # Si c'est déjà un objet datetime
                        if hasattr(date_input, 'strftime'):
                            return date_input.strftime('%d/%m/%Y %H:%M')
                        # Si c'est une chaîne de caractères
                        elif isinstance(date_input, str):
                            # Essayer différents formats
                            formats = [
                                '%Y-%m-%d %H:%M:%S',
                                '%Y-%m-%dT%H:%M:%S',
                                '%Y-%m-%dT%H:%M:%SZ',
                                '%Y-%m-%dT%H:%M:%S.%f',
                                '%Y-%m-%dT%H:%M:%S.%fZ'
                            ]
                            for fmt in formats:
                                try:
                                    dt = datetime.strptime(date_input, fmt)
                                    return dt.strftime('%d/%m/%Y %H:%M')
                                except ValueError:
                                    continue
                            # Si aucun format ne marche, essayer fromisoformat
                            try:
                                dt = datetime.fromisoformat(date_input.replace('Z', '+00:00'))
                                return dt.strftime('%d/%m/%Y %H:%M')
                            except:
                                return str(date_input)[:16]  # Retourner les 16 premiers caractères
                        else:
                            return str(date_input)
                    except Exception as e:
                        return str(date_input)[:16] if date_input else '?'
                
                df['joined_at'] = df['joined_at'].apply(format_date)
                
                # Ajouter indicateur couleur
                def get_risk_color(count):
                    if count >= 5:
                        return "🔴"
                    elif count >= 3:
                        return "🟠"
                    elif count >= 1:
                        return "🟡"
                    return "🟢"
                
                df['risk'] = df['warning_count'].apply(get_risk_color)
                
                # Réorganiser colonnes
                df = df[['risk', 'user_id', 'username', 'server_username', 'joined_at', 'warning_count']]
                df.columns = ['Risk', 'User ID', 'Username', 'Server Username', 'Joined', 'Warnings']
                
                st.dataframe(df, use_container_width=True, hide_index=True)
                
                st.caption(f"Affichage de {len(users)} utilisateurs")
            else:
                st.info("Aucun utilisateur trouvé")
        
        # ============ TAB STATS ============
        with tab2:
            st.subheader("📊 Statistiques utilisateurs")
            
            col1, col2 = st.columns(2)
            
            with col1:
                # Distribution des warnings
                cursor.execute("""
                    SELECT 
                        CASE 
                            WHEN warning_count = 0 THEN '0 warning'
                            WHEN warning_count = 1 THEN '1 warning'
                            WHEN warning_count = 2 THEN '2 warnings'
                            WHEN warning_count BETWEEN 3 AND 5 THEN '3-5 warnings'
                            ELSE '6+ warnings'
                        END as category,
                        COUNT(*) as count
                    FROM (
                        SELECT u.user_id, COUNT(w.id) as warning_count
                        FROM users u
                        LEFT JOIN warnings w ON u.user_id = w.user_id AND u.guild_id = w.guild_id
                        WHERE u.guild_id = ?
                        GROUP BY u.user_id
                    ) as subquery
                    GROUP BY category
                    ORDER BY 
                        CASE category
                            WHEN '0 warning' THEN 1
                            WHEN '1 warning' THEN 2
                            WHEN '2 warnings' THEN 3
                            WHEN '3-5 warnings' THEN 4
                            ELSE 5
                        END
                """, (guild_id,))
                
                dist_data_raw = cursor.fetchall()
                
                if dist_data_raw:
                    dist_data = [{'category': row[0], 'count': row[1]} for row in dist_data_raw]
                    df = pd.DataFrame(dist_data)
                    
                    fig = px.pie(
                        df, values='count', names='category',
                        title="Distribution des warnings",
                        color_discrete_sequence=['#FF6B6B', '#FFA06B', '#FFD06B', '#6BFF6B', '#6B6BFF']
                    )
                    fig.update_layout(showlegend=False, transition_duration=0)
                    fig.update_traces(hovertemplate=None, hoverinfo='none')
                    st.plotly_chart(fig, use_container_width=True)
            
            with col2:
                # Nouveaux utilisateurs par mois
                cursor.execute("""
                    SELECT 
                        strftime('%Y-%m', joined_at) as month,
                        COUNT(*) as count
                    FROM users
                    WHERE guild_id = ? AND joined_at IS NOT NULL AND is_active = 1
                    GROUP BY month
                    ORDER BY month DESC
                    LIMIT 12
                """, (guild_id,))
                
                join_data_raw = cursor.fetchall()
                
                if join_data_raw:
                    join_data = [{'month': row[0], 'count': row[1]} for row in join_data_raw]
                    df = pd.DataFrame(join_data)
                    df = df.iloc[::-1]  # Inverser pour ordre chronologique
                    
                    fig = px.bar(
                        df, x='month', y='count',
                        title="Nouveaux membres par mois",
                        color_discrete_sequence=[COLORS['primary']]
                    )
                    fig.update_layout(transition_duration=0)
                    fig.update_traces(hovertemplate=None, hoverinfo='none')
                    st.plotly_chart(fig, use_container_width=True)
        
        # ============ TAB À SURVEILLER ============
        with tab3:
            st.subheader("⚠️ Utilisateurs à surveiller")
            
            st.markdown("""
            Liste des utilisateurs avec un historique de modération important 
            qui nécessitent une attention particulière.
            """)
            
            # Utilisateurs avec beaucoup de warnings
            cursor.execute("""
                SELECT 
                    u.user_id,
                    u.username,
                    u.server_username,
                    COUNT(w.id) as warning_count,
                    MAX(w.created_at) as last_warning
                FROM users u
                JOIN warnings w ON u.user_id = w.user_id AND u.guild_id = w.guild_id
                WHERE u.guild_id = ? AND u.is_active = 1
                GROUP BY u.user_id, u.username, u.server_username
                HAVING warning_count >= 3
                ORDER BY warning_count DESC
                LIMIT 20
            """, (guild_id,))
            
            watch_list_raw = cursor.fetchall()
            
            if watch_list_raw:
                watch_list = []
                for row in watch_list_raw:
                    watch_list.append({
                        'user_id': row[0],
                        'username': row[1],
                        'warning_count': row[2],
                        'last_warning': row[3]
                    })
                
                for user in watch_list:
                    risk_level = "🔴 ÉLEVÉ" if user['warning_count'] >= 5 else "🟠 MODÉRÉ"
                    
                    with st.expander(f"{risk_level} - {user['username'] or user['user_id']} ({user['warning_count']} warnings)"):
                        col1, col2 = st.columns(2)
                        
                        with col1:
                            st.markdown(f"**User ID:** `{user['user_id']}`")
                            st.markdown(f"**Username:** `{user['username']}`")
                            st.markdown(f"**Server Username:** `{user['server_username']}`")
                            st.markdown(f"**Warnings:** {user['warning_count']}")
                        
                        with col2:
                            if user['last_warning']:
                                formatted_date = format_date(user['last_warning'])
                                st.markdown(f"**Dernier warning:** {formatted_date}")
                        
                        # Détails des warnings
                        cursor.execute("""
                            SELECT reason, moderator_id, created_at
                            FROM warnings
                            WHERE user_id = ? AND guild_id = ?
                            ORDER BY created_at DESC
                            LIMIT 5
                        """, (user['user_id'], guild_id))
                        
                        recent_warnings_raw = cursor.fetchall()
                        
                        if recent_warnings_raw:
                            st.markdown("**Derniers warnings:**")
                            for w_row in recent_warnings_raw:
                                w = {
                                    'reason': w_row[0],
                                    'moderator_id': w_row[1],
                                    'created_at': w_row[2]
                                }
                                formatted_date = format_date(w['created_at'])
                                st.markdown(f"- {formatted_date}: {w['reason']}")
            else:
                st.success("🎉 Aucun utilisateur à surveiller!")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        st.error(f"Erreur: {e}")

if __name__ == "__main__":
    main()
