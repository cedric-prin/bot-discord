import streamlit as st
import pandas as pd
from datetime import datetime

def format_user_id(user_id):
    """Formate un ID utilisateur avec lien copier"""
    return f"`{user_id}`"

def format_timestamp(ts):
    """Formate un timestamp de manière lisible"""
    if ts is None:
        return "N/A"
    if isinstance(ts, str):
        try:
            ts = datetime.fromisoformat(ts)
        except:
            return ts
    return ts.strftime("%d/%m/%Y %H:%M")

def format_duration(duration):
    """Formate une durée"""
    if duration is None or duration == "":
        return "Permanent"
    return duration

def format_status(active: bool):
    """Formate un status actif/inactif"""
    return " Actif" if active else " Inactif"

def styled_dataframe(df: pd.DataFrame, columns_config: dict = None):
    """
    Affiche un DataFrame avec style personnalisé
    
    Args:
        df: DataFrame à afficher
        columns_config: Dict de config par colonne
            {
                'column_name': {
                    'label': 'Display Name',
                    'width': 'small|medium|large',
                    'format': 'user_id|timestamp|duration|status'
                }
            }
    """
    if df.empty:
        st.info("Aucune donnée à afficher")
        return
    
    display_df = df.copy()
    
    if columns_config:
        for col, config in columns_config.items():
            if col in display_df.columns:
                # Appliquer le formatage
                format_type = config.get('format')
                if format_type == 'user_id':
                    display_df[col] = display_df[col].apply(format_user_id)
                elif format_type == 'timestamp':
                    display_df[col] = display_df[col].apply(format_timestamp)
                elif format_type == 'duration':
                    display_df[col] = display_df[col].apply(format_duration)
                elif format_type == 'status':
                    display_df[col] = display_df[col].apply(format_status)
                
                # Renommer la colonne
                if 'label' in config:
                    display_df = display_df.rename(columns={col: config['label']})
    
    st.dataframe(display_df, use_container_width=True, hide_index=True)

def paginated_table(df: pd.DataFrame, page_size: int = 20, key: str = "table"):
    """
    Affiche un tableau avec pagination
    """
    total_rows = len(df)
    total_pages = (total_rows - 1) // page_size + 1 if total_rows > 0 else 1
    
    col1, col2, col3 = st.columns([1, 3, 1])
    
    with col2:
        page = st.number_input(
            f"Page (1-{total_pages})",
            min_value=1, max_value=total_pages,
            value=1, key=f"{key}_page"
        )
    
    start_idx = (page - 1) * page_size
    end_idx = min(start_idx + page_size, total_rows)
    
    st.dataframe(
        df.iloc[start_idx:end_idx],
        use_container_width=True,
        hide_index=True
    )
    
    st.caption(f"Affichage {start_idx + 1}-{end_idx} sur {total_rows}")

def selectable_table(df: pd.DataFrame, key: str = "select"):
    """
    Tableau avec sélection multiple
    """
    if df.empty:
        st.info("Aucune donnée")
        return []
    
    # Ajouter une colonne de sélection
    df_with_select = df.copy()
    df_with_select.insert(0, '', False)
    
    edited_df = st.data_editor(
        df_with_select,
        hide_index=True,
        use_container_width=True,
        key=key,
        column_config={
            '': st.column_config.CheckboxColumn(
                '',
                help='Sélectionner',
                default=False
            )
        }
    )
    
    # Récupérer les lignes sélectionnées
    selected_rows = edited_df[edited_df[''] == True].drop(columns=[''])
    
    return selected_rows.to_dict('records')

def warning_table(warnings: list):
    """
    Tableau spécialisé pour les warnings
    """
    if not warnings:
        st.success("")
        return
    
    df = pd.DataFrame(warnings)
    
    styled_dataframe(df, {
        'id': {'label': 'ID', 'width': 'small'},
        'user_id': {'label': 'Utilisateur', 'format': 'user_id'},
        'moderator_id': {'label': 'Modérateur', 'format': 'user_id'},
        'reason': {'label': 'Raison'},
        'created_at': {'label': 'Date', 'format': 'timestamp'}
    })

def sanction_table(sanctions: list):
    """
    Tableau spécialisé pour les sanctions
    """
    if not sanctions:
        st.success("")
        return
    
    df = pd.DataFrame(sanctions)
    
    # Icônes par type
    type_icons = {
        'mute': '',
        'kick': '',
        'ban': '',
        'unban': ''
    }
    
    df['type'] = df['type'].apply(lambda x: f"{type_icons.get(x, '')} {x}")
    
    styled_dataframe(df, {
        'id': {'label': 'ID'},
        'type': {'label': 'Type'},
        'user_id': {'label': 'Utilisateur', 'format': 'user_id'},
        'reason': {'label': 'Raison'},
        'duration': {'label': 'Durée', 'format': 'duration'},
        'active': {'label': 'Status', 'format': 'status'},
        'created_at': {'label': 'Date', 'format': 'timestamp'}
    })
