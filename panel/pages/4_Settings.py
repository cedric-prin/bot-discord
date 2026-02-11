import streamlit as st
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from database.python.connection import get_connection
from panel.utils.auth import require_auth
from panel.components.sidebar import render_sidebar, get_selected_guild_id

st.set_page_config(page_title="Settings", page_icon="⚙️", layout="wide")

@require_auth
def main():
    render_sidebar()
    
    st.title("⚙️ Configuration du Bot")
    st.caption("Gérer les paramètres du bot pour ce serveur")
    
    guild_id = get_selected_guild_id()
    
    if not guild_id:
        st.warning("Veuillez sélectionner un serveur dans la sidebar")
        return
    
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Récupérer config actuelle
        cursor.execute("SELECT * FROM guilds WHERE id = ?", (guild_id,))
        guild_data_raw = cursor.fetchone()
        
        if not guild_data_raw:
            st.error("Serveur non trouvé dans la base de données")
            return
        
        # Parser config JSON avec gestion d'erreur
        config_str = guild_data_raw[7] if len(guild_data_raw) > 7 else None  # automod_config
        
        config = {}
        
        if config_str and config_str.strip():
            try:
                config = json.loads(config_str)
            except json.JSONDecodeError:
                config = {}
        
        st.info(f"Configuration pour: **{guild_data_raw[1] or 'Unknown'}**")
        
        # Tabs
        tab1, tab2, tab3, tab4 = st.tabs([
            "📋 Général", 
            "🤖 AutoMod", 
            "⚠️ Sanctions Auto", 
            "📝 Logs"
        ])
        
        # ============ TAB GÉNÉRAL ============
        with tab1:
            st.subheader("📋 Configuration générale")
            
            with st.form("general_settings"):
                col1, col2 = st.columns(2)
                
                with col1:
                    prefix = st.text_input(
                        "🔤 Préfixe des commandes",
                        value=config.get('prefix', '!'),
                        help="Préfixe utilisé pour les commandes du bot"
                    )
                    
                    language = st.selectbox(
                        "🌐 Langue",
                        options=["fr", "en"],
                        index=0 if config.get('language', 'fr') == 'fr' else 1,
                        help="Langue des réponses du bot"
                    )
                
                with col2:
                    mod_role = st.text_input(
                        "🛡️ Rôle Modérateur",
                        value=config.get('mod_role', ''),
                        help="ID du rôle ayant accès aux commandes de modération"
                    )
                    
                    admin_role = st.text_input(
                        "👑 Rôle Administrateur",
                        value=config.get('admin_role', ''),
                        help="ID du rôle ayant accès à toutes les commandes"
                    )
                
                mute_role = st.text_input(
                    "🔇 Rôle Mute",
                    value=config.get('mute_role', ''),
                    help="ID du rôle appliqué lors d'un mute"
                )
                
                submitted = st.form_submit_button("💾 Sauvegarder", type="primary")
                
                if submitted:
                    new_config = {
                        **config,
                        'prefix': prefix,
                        'language': language,
                        'mod_role': mod_role if mod_role else None,
                        'admin_role': admin_role if admin_role else None,
                        'mute_role': mute_role if mute_role else None
                    }
                    
                    cursor.execute(
                        "UPDATE guilds SET automod_config = ? WHERE id = ?",
                        (json.dumps(new_config), guild_id)
                    )
                    conn.commit()
                    st.success("✅ Configuration sauvegardée!")
                    st.rerun()
        
        # ============ TAB AUTOMOD ============
        with tab2:
            st.subheader("🤖 Configuration AutoMod")
            
            with st.form("automod_settings"):
                st.write("**Anti-Spam**")
                spam_enabled = st.checkbox("Activer l'anti-spam", value=config.get('spam', {}).get('enabled', False), key="spam_enabled")
                
                if spam_enabled:
                    col1, col2 = st.columns(2)
                    with col1:
                        spam_max = st.number_input("Messages max", min_value=2, max_value=10, value=config.get('spam', {}).get('maxMessages', 5))
                        spam_window = st.number_input("Fenêtre (secondes)", min_value=1, max_value=10, value=config.get('spam', {}).get('window', 5))
                    with col2:
                        spam_duplicates = st.checkbox("Détecter les doublons", value=config.get('spam', {}).get('duplicates', True), key="spam_duplicates")
                        spam_action = st.selectbox("Action", ["warn", "mute", "kick"], index=0, key="spam_action")
                
                st.write("**Anti-Invitations**")
                invites_enabled = st.checkbox("Bloquer les invitations Discord", value=config.get('invites', {}).get('enabled', False), key="invites_enabled")
                
                if invites_enabled:
                    col1, col2 = st.columns(2)
                    with col1:
                        invites_allow_server = st.checkbox("Autoriser les invitations de ce serveur", value=config.get('invites', {}).get('allowServer', False), key="invites_allow_server")
                    with col2:
                        invites_action = st.selectbox("Action", ["warn", "mute", "delete"], index=0, key="invites_action")
                
                st.write("**Anti-Bad Words**")
                badwords_enabled = st.checkbox("Activer le filtre de mauvais mots", value=config.get('badwords', {}).get('enabled', False), key="badwords_enabled")
                
                if badwords_enabled:
                    badwords_list = st.text_area(
                        "Mots interdits (un par ligne)",
                        value='\n'.join(config.get('badwords', {}).get('words', [])),
                        help="Liste des mots à filtrer"
                    )
                    badwords_leet = st.checkbox("Détecter le leet speak (ex: 4=a)", value=config.get('badwords', {}).get('leetSpeak', True), key="badwords_leet")
                    badwords_whole = st.checkbox("Mot entier uniquement", value=config.get('badwords', {}).get('wholeWord', True), key="badwords_whole")
                
                submitted = st.form_submit_button("💾 Sauvegarder AutoMod", type="primary")
                
                if submitted:
                    new_automod = {
                        'spam': {
                            'enabled': spam_enabled,
                            'maxMessages': spam_max,
                            'window': spam_window,
                            'duplicates': spam_duplicates,
                            'action': spam_action
                        },
                        'invites': {
                            'enabled': invites_enabled,
                            'allowServer': invites_allow_server,
                            'action': invites_action
                        },
                        'badwords': {
                            'enabled': badwords_enabled,
                            'words': [w.strip() for w in badwords_list.split('\n') if w.strip()],
                            'leetSpeak': badwords_leet,
                            'wholeWord': badwords_whole
                        }
                    }
                
                    cursor.execute(
                        "UPDATE guilds SET automod_config = ? WHERE id = ?",
                        (json.dumps(new_automod), guild_id)
                    )
                    conn.commit()
                    st.success("✅ Configuration AutoMod sauvegardée!")
                    st.rerun()
        
        # ============ TAB SANCTIONS AUTO ============
        with tab3:
            st.subheader("⚠️ Sanctions automatiques")
            st.caption("Configurer des sanctions automatiques basées sur le nombre de warnings")
            
            warn_actions = config.get('warnActions', [])
            
            st.write("**Paliers de sanctions**")
            
            # Palier 3 warnings
            with st.expander("⚠️ 3 Warnings", expanded=True):
                col1, col2 = st.columns(2)
                with col1:
                    warn3_enabled = st.checkbox("Activer", value=any(a.get('count') == 3 for a in warn_actions), key="warn3_enabled")
                with col2:
                    warn3_action = st.selectbox("Action", ["mute", "kick", "ban"], index=0, key="warn3_action")
                
                warn3_duration = st.text_input("Durée (ex: 1h, 1d, permanent)", value="1h", key="warn3_duration")
            
            # Palier 5 warnings
            with st.expander("⚠️ 5 Warnings"):
                col1, col2 = st.columns(2)
                with col1:
                    warn5_enabled = st.checkbox("Activer", value=any(a.get('count') == 5 for a in warn_actions), key="warn5_enabled")
                with col2:
                    warn5_action = st.selectbox("Action", ["mute", "kick", "ban"], index=1, key="warn5_action")
                
                warn5_duration = st.text_input("Durée (ex: 1h, 1d, permanent)", value="1d", key="warn5_duration")
            
            # Palier 10 warnings
            with st.expander("⚠️ 10 Warnings"):
                col1, col2 = st.columns(2)
                with col1:
                    warn10_enabled = st.checkbox("Activer", value=any(a.get('count') == 10 for a in warn_actions), key="warn10_enabled")
                with col2:
                    warn10_action = st.selectbox("Action", ["mute", "kick", "ban"], index=2, key="warn10_action")
                
                warn10_duration = st.text_input("Durée (ex: 1h, 1d, permanent)", value="permanent", key="warn10_duration")
            
            # Décroissance des warnings
            st.write("**Décroissance des warnings**")
            warn_decay = config.get('warnDecay', {})
            
            col1, col2 = st.columns(2)
            with col1:
                decay_enabled = st.checkbox("Activer la décroissance", value=warn_decay.get('enabled', False), key="decay_enabled")
            with col2:
                decay_days = st.number_input("Décroissance après (jours)", min_value=1, max_value=30, value=warn_decay.get('days', 7))
            
            if st.button("💾 Sauvegarder les sanctions", type="primary"):
                new_warn_actions = []
                
                if warn3_enabled:
                    new_warn_actions.append({
                        'count': 3,
                        'action': warn3_action,
                        'duration': warn3_duration
                    })
                
                if warn5_enabled:
                    new_warn_actions.append({
                        'count': 5,
                        'action': warn5_action,
                        'duration': warn5_duration
                    })
                
                if warn10_enabled:
                    new_warn_actions.append({
                        'count': 10,
                        'action': warn10_action,
                        'duration': warn10_duration
                    })
                
                new_config = {
                    **config,
                    'warnActions': new_warn_actions,
                    'warnDecay': {
                        'enabled': decay_enabled,
                        'days': decay_days
                    }
                }
                
                cursor.execute(
                    "UPDATE guilds SET config = ? WHERE id = ?",
                    (json.dumps(new_config), guild_id)
                )
                conn.commit()
                st.success("✅ Configuration sauvegardée!")
                st.rerun()
        
        # ============ TAB LOGS ============
        with tab4:
            st.subheader("📝 Configuration des logs")
            
            logs_config = config.get('logs', {})
            
            with st.form("logs_settings"):
                st.write("**Channels de logs**")
                
                col1, col2 = st.columns(2)
                with col1:
                    log_channel = st.text_input(
                        "Channel des logs généraux",
                        value=logs_config.get('channel', ''),
                        help="ID du channel pour les logs généraux"
                    )
                    
                    mod_log_channel = st.text_input(
                        "Channel des logs de modération",
                        value=logs_config.get('modChannel', ''),
                        help="ID du channel pour les logs de modération"
                    )
                
                with col2:
                    join_log_channel = st.text_input(
                        "Channel des logs d'arrivées/départs",
                        value=logs_config.get('joinChannel', ''),
                        help="ID du channel pour les logs de membres"
                    )
                    
                    message_log_channel = st.text_input(
                        "Channel des logs de messages",
                        value=logs_config.get('messageChannel', ''),
                        help="ID du channel pour les logs de messages supprimés"
                    )
                
                st.write("**Options de logs**")
                
                col1, col2 = st.columns(2)
                with col1:
                    log_warnings = st.checkbox("Logger les warnings", value=logs_config.get('logWarnings', True), key="log_warnings")
                    log_sanctions = st.checkbox("Logger les sanctions", value=logs_config.get('logSanctions', True), key="log_sanctions")
                    log_joins = st.checkbox("Logger les arrivées/départs", value=logs_config.get('logJoins', True), key="log_joins")
                
                with col2:
                    log_messages = st.checkbox("Logger les messages supprimés", value=logs_config.get('logMessages', False), key="log_messages")
                    log_deletes = st.checkbox("Logger les messages édités", value=logs_config.get('logEdits', False), key="log_deletes")
                    log_voice = st.checkbox("Logger le vocal", value=logs_config.get('logVoice', False), key="log_voice")
                
                submitted = st.form_submit_button("💾 Sauvegarder les logs", type="primary")
                
                if submitted:
                    new_log_config = {
                        'channel': log_channel,
                        'modChannel': mod_log_channel,
                        'joinChannel': join_log_channel,
                        'messageChannel': message_log_channel,
                        'logWarnings': log_warnings,
                        'logSanctions': log_sanctions,
                        'logJoins': log_joins,
                        'logMessages': log_messages,
                        'logEdits': log_deletes,
                        'logVoice': log_voice
                    }
                    
                    new_config = {
                        **config,
                        'logs': new_log_config
                    }
                    
                    cursor.execute(
                        "UPDATE guilds SET automod_config = ? WHERE id = ?",
                        (json.dumps(new_config), guild_id)
                    )
                    conn.commit()
                    st.success("✅ Configuration sauvegardée!")
                    st.rerun()
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        st.error(f"Erreur: {e}")
        import traceback
        st.code(traceback.format_exc())

if __name__ == "__main__":
    main()
