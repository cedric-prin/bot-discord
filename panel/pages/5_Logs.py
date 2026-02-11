import streamlit as st
import pandas as pd
from datetime import datetime, timedelta
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from database.python.connection import get_connection
from panel.utils.auth import require_auth
from panel.components.sidebar import render_sidebar, get_selected_guild_id

st.set_page_config(page_title="Logs", page_icon="📜", layout="wide")

@require_auth
def main():
    render_sidebar()
    
    st.title("📜 Logs de Modération")
    
    guild_id = get_selected_guild_id()
    
    if not guild_id:
        st.warning("Veuillez sélectionner un serveur dans la sidebar")
        return
    
    # Filtres
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        log_type = st.selectbox(
            "📁 Type de log",
            options=["Tous", "warning", "mute", "kick", "ban", "unban", "unmute"]
        )
    
    with col2:
        date_range = st.selectbox(
            "📅 Période",
            options=["Aujourd'hui", "7 jours", "30 jours", "Tout"]
        )
    
    with col3:
        moderator_filter = st.text_input("🛡️ Modérateur (ID)")
    
    with col4:
        user_filter = st.text_input("👤 Utilisateur (ID)")
    
    # Auto-refresh
    col1, col2 = st.columns([3, 1])
    with col2:
        auto_refresh = st.toggle("🔄 Auto-refresh (30s)", value=False)
    
    if auto_refresh:
        st.empty()
        import time
        time.sleep(30)
        st.rerun()
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Construire la requête pour les sanctions (logs)
        query = """
            SELECT 
                s.id,
                s.type,
                s.user_id,
                s.moderator_id,
                s.reason,
                s.duration,
                s.created_at,
                s.active
            FROM sanctions s
            WHERE s.guild_id = ?
        """
        params = [guild_id]
        
        # Filtre type
        if log_type != "Tous":
            query += " AND s.type = ?"
            params.append(log_type)
        
        # Filtre date
        if date_range == "Aujourd'hui":
            query += " AND DATE(s.created_at) = DATE('now')"
        elif date_range == "7 jours":
            query += " AND s.created_at >= DATE('now', '-7 days')"
        elif date_range == "30 jours":
            query += " AND s.created_at >= DATE('now', '-30 days')"
        
        # Filtre modérateur
        if moderator_filter:
            query += " AND s.moderator_id = ?"
            params.append(moderator_filter)
        
        # Filtre utilisateur
        if user_filter:
            query += " AND s.user_id = ?"
            params.append(user_filter)
        
        query += " ORDER BY s.created_at DESC LIMIT 100"
        
        cursor.execute(query, params)
        sanctions_raw = cursor.fetchall()
        
        # Convertir en liste de dict
        logs = []
        for row in sanctions_raw:
            logs.append({
                'id': row[0],
                'type': row[1],
                'user_id': row[2],
                'moderator_id': row[3],
                'reason': row[4],
                'duration': row[5],
                'created_at': row[6],
                'active': bool(row[7]) if row[7] is not None else True
            })
        
        # Ajouter aussi les warnings
        warning_query = """
            SELECT 
                w.id,
                'warning' as type,
                w.user_id,
                w.moderator_id,
                w.reason,
                NULL as duration,
                w.created_at,
                TRUE as active
            FROM warnings w
            WHERE w.guild_id = ?
        """
        warning_params = [guild_id]
        
        if log_type == "Tous" or log_type == "warning":
            if date_range == "Aujourd'hui":
                warning_query += " AND DATE(w.created_at) = DATE('now')"
            elif date_range == "7 jours":
                warning_query += " AND w.created_at >= DATE('now', '-7 days')"
            elif date_range == "30 jours":
                warning_query += " AND w.created_at >= DATE('now', '-30 days')"
            
            if moderator_filter:
                warning_query += " AND w.moderator_id = ?"
                warning_params.append(moderator_filter)
            
            if user_filter:
                warning_query += " AND w.user_id = ?"
                warning_params.append(user_filter)
            
            warning_query += " ORDER BY w.created_at DESC LIMIT 100"
            
            cursor.execute(warning_query, warning_params)
            warnings_raw = cursor.fetchall()
            
            # Convertir en liste de dict
            warnings = []
            for row in warnings_raw:
                warnings.append({
                    'id': row[0],
                    'type': row[1],
                    'user_id': row[2],
                    'moderator_id': row[3],
                    'reason': row[4],
                    'duration': row[5],
                    'created_at': row[6],
                    'active': bool(row[7]) if row[7] is not None else True
                })
            
            # Combiner et trier
            all_logs = logs + warnings
            all_logs.sort(key=lambda x: x['created_at'] or datetime.min, reverse=True)
            all_logs = all_logs[:100]
        else:
            all_logs = logs
        
        cursor.close()
        conn.close()
        
        # Affichage
        st.markdown(f"**{len(all_logs)} entrées trouvées**")
        
        if all_logs:
            # Icônes par type
            type_icons = {
                'warning': '⚠️',
                'mute': '🔇',
                'unmute': '🔊',
                'kick': '👢',
                'ban': '🔨',
                'unban': '🔓'
            }
            
            # Couleurs par type
            type_colors = {
                'warning': '#FEE75C',
                'mute': '#5865F2',
                'unmute': '#57F287',
                'kick': '#FEA500',
                'ban': '#ED4245',
                'unban': '#57F287'
            }
            
            for log in all_logs:
                icon = type_icons.get(log['type'], '📋')
                color = type_colors.get(log['type'], '#FFFFFF')
                timestamp = log['created_at']
                
                st.markdown(f"""
                <div style="
                    background: #2C2F33;
                    padding: 1rem;
                    border-radius: 8px;
                    border-left: 4px solid {color};
                    margin-bottom: 0.5rem;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 1.1em;">
                            {icon} <strong>{log['type'].upper()}</strong>
                        </span>
                        <span style="color: #72767D; font-size: 0.9em;">
                            {timestamp}
                        </span>
                    </div>
                    <div style="margin-top: 0.5rem; color: #B9BBBE;">
                        <strong>User:</strong> {log['user_id']} | 
                        <strong>Mod:</strong> {log['moderator_id']}
                        {f" | <strong>Durée:</strong> {log['duration']}" if log.get('duration') else ""}
                    </div>
                    <div style="margin-top: 0.5rem;">
                        {log['reason'] or 'Aucune raison'}
                    </div>
                </div>
                """, unsafe_allow_html=True)
            
            # Export CSV
            st.divider()
            
            if st.button("📥 Exporter en CSV"):
                df = pd.DataFrame(all_logs)
                csv = df.to_csv(index=False)
                st.download_button(
                    label="Télécharger CSV",
                    data=csv,
                    file_name=f"logs_{guild_id}_{datetime.now().strftime('%Y%m%d')}.csv",
                    mime="text/csv"
                )
        else:
            st.info("Aucun log trouvé pour ces critères")
    
    except Exception as e:
        st.error(f"Erreur: {e}")

if __name__ == "__main__":
    main()
