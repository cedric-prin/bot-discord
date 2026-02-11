import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from database.python.connection import get_connection
from panel.utils.auth import require_auth
from panel.components.sidebar import render_sidebar, get_selected_guild_id
from panel.config import COLORS

st.set_page_config(page_title="Dashboard", page_icon="📊", layout="wide")

@require_auth
def main():
    render_sidebar()
    
    st.title("📊 Dashboard")
    st.caption("Vue d'ensemble de l'activité de modération")
    
    guild_id = get_selected_guild_id()
    
    if not guild_id:
        st.warning("Veuillez sélectionner un serveur dans la sidebar")
        return
    
    # Période de filtrage
    col1, col2 = st.columns(2)
    with col1:
        period = st.selectbox("Période", ["7 jours", "30 jours", "90 jours", "1 an"], key="dashboard_period")
    with col2:
        st.info(f"Serveur sélectionné : `{guild_id}`")
    
    # Conversion période en jours
    period_days = {"7 jours": 7, "30 jours": 30, "90 jours": 90, "1 an": 365}
    days = period_days[period]
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Métriques principales
        st.markdown("### 📈 Métriques principales")
        
        # Warnings totaux
        cursor.execute("""
            SELECT COUNT(*) as total_warnings,
                   COUNT(CASE WHEN created_at >= DATE('now', '-{} days') THEN 1 END) as recent_warnings
            FROM warnings WHERE guild_id = ?
        """.format(days), (guild_id,))
        warning_stats = cursor.fetchone()
        
        # Sanctions totales
        cursor.execute("""
            SELECT COUNT(*) as total_sanctions,
                   COUNT(CASE WHEN created_at >= DATE('now', '-{} days') THEN 1 END) as recent_sanctions,
                   COUNT(CASE WHEN active = 1 THEN 1 END) as active_sanctions
            FROM sanctions WHERE guild_id = ?
        """.format(days), (guild_id,))
        sanction_stats = cursor.fetchone()
        
        # Utilisateurs uniques
        cursor.execute("""
            SELECT COUNT(DISTINCT discord_id) as total_users
            FROM users WHERE guild_id = ?
        """, (guild_id,))
        user_stats = cursor.fetchone()
        
        # Actions AutoMod
        cursor.execute("""
            SELECT COUNT(*) as total_automod,
                   COUNT(CASE WHEN created_at >= DATE('now', '-{} days') THEN 1 END) as recent_automod
            FROM automod_logs WHERE guild_id = ?
        """.format(days), (guild_id,))
        automod_stats = cursor.fetchone()
        
        # Affichage des métriques
        col1, col2, col3, col4, col5 = st.columns(5)
        
        with col1:
            delta = warning_stats[1] if warning_stats[1] > 0 else None
            st.metric("⚠️ Warnings", warning_stats[0], delta=f"+{delta}" if delta else None)
        
        with col2:
            delta = sanction_stats[1] if sanction_stats[1] > 0 else None
            st.metric("🔨 Sanctions", sanction_stats[0], delta=f"+{delta}" if delta else None)
        
        with col3:
            st.metric("👥 Utilisateurs", user_stats[0])
        
        with col4:
            st.metric("⛔ Actives", sanction_stats[2])
        
        with col5:
            delta = automod_stats[1] if automod_stats[1] > 0 else None
            st.metric("🤖 AutoMod", automod_stats[0], delta=f"+{delta}" if delta else None)
        
        st.divider()
        
        # Graphiques
        col1, col2 = st.columns(2)
        
        with col1:
            st.markdown("### 📊 Évolution des warnings")
            cursor.execute("""
                SELECT DATE(created_at) as date, COUNT(*) as count
                FROM warnings 
                WHERE guild_id = ? AND created_at >= DATE('now', '-{} days')
                GROUP BY DATE(created_at)
                ORDER BY date
            """.format(days), (guild_id,))
            
            warning_trend = cursor.fetchall()
            if warning_trend:
                df = pd.DataFrame(warning_trend, columns=['date', 'count'])
                fig = px.area(df, x='date', y='count', title="Warnings par jour",
                            color_discrete_sequence=[COLORS['primary']])
                fig.update_layout(showlegend=False, transition_duration=0)
                fig.update_traces(hovertemplate=None, hoverinfo='none')
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info("Aucune donnée pour cette période")
        
        with col2:
            st.markdown("### 🥧 Répartition des sanctions")
            cursor.execute("""
                SELECT type, COUNT(*) as count
                FROM sanctions 
                WHERE guild_id = ? AND created_at >= DATE('now', '-{} days')
                GROUP BY type
            """.format(days), (guild_id,))
            
            sanction_types = cursor.fetchall()
            if sanction_types:
                df = pd.DataFrame(sanction_types, columns=['type', 'count'])
                fig = px.pie(df, values='count', names='type', title="Types de sanctions")
                fig.update_layout(transition_duration=0)
                fig.update_traces(hovertemplate=None, hoverinfo='none')
                st.plotly_chart(fig, use_container_width=True)
            else:
                st.info("Aucune sanction pour cette période")
        
        # Top modérateurs
        st.markdown("### 🏆 Top modérateurs")
        cursor.execute("""
            SELECT moderator_id, COUNT(*) as count
            FROM warnings 
            WHERE guild_id = ? AND created_at >= DATE('now', '-{} days')
            GROUP BY moderator_id
            ORDER BY count DESC
            LIMIT 10
        """.format(days), (guild_id,))
        
        top_mods = cursor.fetchall()
        if top_mods:
            df = pd.DataFrame(top_mods, columns=['moderator_id', 'count'])
            fig = px.bar(df, x='count', y='moderator_id', orientation='h',
                        title="Warnings par modérateur", color_discrete_sequence=[COLORS['warning']])
            fig.update_layout(showlegend=False, transition_duration=0)
            fig.update_traces(hovertemplate=None, hoverinfo='none')
            st.plotly_chart(fig, use_container_width=True)
        
        # Utilisateurs à surveiller
        st.markdown("### ⚠️ Utilisateurs à surveiller")
        cursor.execute("""
            SELECT user_id, COUNT(*) as warning_count
            FROM warnings 
            WHERE guild_id = ? AND created_at >= DATE('now', '-{} days')
            GROUP BY user_id
            HAVING warning_count >= 2
            ORDER BY warning_count DESC
            LIMIT 10
        """.format(days), (guild_id,))
        
        watch_list = cursor.fetchall()
        if watch_list:
            df = pd.DataFrame(watch_list, columns=['user_id', 'warning_count'])
            fig = px.bar(df, x='warning_count', y='user_id', orientation='h',
                        title="Utilisateurs avec 2+ warnings", color_discrete_sequence=[COLORS['danger']])
            fig.update_layout(showlegend=False, transition_duration=0)
            fig.update_traces(hovertemplate=None, hoverinfo='none')
            st.plotly_chart(fig, use_container_width=True)
        else:
            st.success("✅ Aucun utilisateur à surveiller!")
        
        # Activité récente
        st.markdown("### 📋 Activité récente")
        cursor.execute("""
            SELECT 'warning' as type, user_id, moderator_id, reason, created_at
            FROM warnings 
            WHERE guild_id = ? 
            UNION ALL
            SELECT type, user_id, moderator_id, reason, created_at
            FROM sanctions 
            WHERE guild_id = ?
            ORDER BY created_at DESC
            LIMIT 10
        """, (guild_id, guild_id))
        
        recent_activity = cursor.fetchall()
        if recent_activity:
            df = pd.DataFrame(recent_activity, columns=['type', 'user_id', 'moderator_id', 'reason', 'created_at'])
            st.dataframe(df, use_container_width=True, hide_index=True)
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        st.error(f"Erreur de connexion à la base de données: {e}")
        import traceback
        st.code(traceback.format_exc())

if __name__ == "__main__":
    main()
