import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
from panel.config import COLORS

def create_line_chart(data: pd.DataFrame, x: str, y: str, title: str, color: str = None):
    """
    Crée un graphique en ligne
    """
    fig = px.line(
        data, x=x, y=y,
        title=title,
        color_discrete_sequence=[color or COLORS['primary']]
    )
    
    fig.update_layout(
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)',
        font_color='white',
        title_font_size=16,
        xaxis=dict(showgrid=False),
        yaxis=dict(showgrid=True, gridcolor='rgba(255,255,255,0.1)')
    )
    
    return fig

def create_bar_chart(data: pd.DataFrame, x: str, y: str, title: str, 
                     color: str = None, horizontal: bool = False):
    """
    Crée un graphique en barres
    """
    if horizontal:
        fig = px.bar(data, x=y, y=x, orientation='h', title=title,
                    color_discrete_sequence=[color or COLORS['primary']])
    else:
        fig = px.bar(data, x=x, y=y, title=title,
                    color_discrete_sequence=[color or COLORS['primary']])
    
    fig.update_layout(
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)',
        font_color='white',
        title_font_size=16,
        xaxis=dict(showgrid=False),
        yaxis=dict(showgrid=True, gridcolor='rgba(255,255,255,0.1)')
    )
    
    return fig

def create_pie_chart(data: pd.DataFrame, values: str, names: str, title: str,
                    colors: list = None):
    """
    Crée un graphique en camembert
    """
    fig = px.pie(
        data, values=values, names=names,
        title=title,
        color_discrete_sequence=colors or px.colors.sequential.RdYlGn_r
    )
    
    fig.update_layout(
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)',
        font_color='white',
        title_font_size=16
    )
    
    fig.update_traces(textposition='inside', textinfo='percent+label')
    
    return fig

def create_gauge_chart(value: float, max_value: float, title: str, 
                      thresholds: list = None):
    """
    Crée une jauge
    """
    if thresholds is None:
        thresholds = [
            [0, 0.3, COLORS['success']],
            [0.3, 0.7, COLORS['warning']],
            [0.7, 1, COLORS['danger']]
        ]
    
    fig = go.Figure(go.Indicator(
        mode="gauge+number",
        value=value,
        title={'text': title, 'font': {'color': 'white'}},
        gauge={
            'axis': {'range': [0, max_value], 'tickcolor': 'white'},
            'bar': {'color': COLORS['primary']},
            'bgcolor': 'rgba(0,0,0,0)',
            'steps': [
                {'range': [t[0] * max_value, t[1] * max_value], 'color': t[2]}
                for t in thresholds
            ]
        }
    ))
    
    fig.update_layout(
        paper_bgcolor='rgba(0,0,0,0)',
        font_color='white',
        height=250
    )
    
    return fig

def create_heatmap(data: pd.DataFrame, x: str, y: str, z: str, title: str):
    """
    Crée une heatmap
    """
    pivot = data.pivot(index=y, columns=x, values=z)
    
    fig = px.imshow(
        pivot,
        title=title,
        color_continuous_scale='RdYlGn_r',
        aspect='auto'
    )
    
    fig.update_layout(
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)',
        font_color='white',
        title_font_size=16
    )
    
    return fig

def create_area_chart(data: pd.DataFrame, x: str, y: str, title: str,
                     fill: bool = True, color: str = None):
    """
    Crée un graphique en aire
    """
    fig = px.area(
        data, x=x, y=y,
        title=title,
        color_discrete_sequence=[color or COLORS['primary']]
    )
    
    fig.update_layout(
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)',
        font_color='white',
        title_font_size=16,
        xaxis=dict(showgrid=False),
        yaxis=dict(showgrid=True, gridcolor='rgba(255,255,255,0.1)')
    )
    
    if fill:
        fig.update_traces(fill='tozeroy', fillcolor=f'rgba(88, 101, 242, 0.3)')
    
    return fig

def create_multi_line_chart(data: pd.DataFrame, x: str, y_columns: list, 
                           title: str, colors: list = None):
    """
    Crée un graphique multi-lignes
    """
    fig = go.Figure()
    
    default_colors = [COLORS['primary'], COLORS['success'], 
                     COLORS['warning'], COLORS['danger']]
    colors = colors or default_colors
    
    for i, col in enumerate(y_columns):
        fig.add_trace(go.Scatter(
            x=data[x],
            y=data[col],
            mode='lines+markers',
            name=col,
            line=dict(color=colors[i % len(colors)])
        ))
    
    fig.update_layout(
        title=title,
        plot_bgcolor='rgba(0,0,0,0)',
        paper_bgcolor='rgba(0,0,0,0)',
        font_color='white',
        title_font_size=16,
        xaxis=dict(showgrid=False),
        yaxis=dict(showgrid=True, gridcolor='rgba(255,255,255,0.1)'),
        legend=dict(
            bgcolor='rgba(0,0,0,0)',
            bordercolor='rgba(255,255,255,0.1)'
        )
    )
    
    return fig
