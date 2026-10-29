import re, sys
from playwright.sync_api import sync_playwright, expect
import os
B=os.environ.get('RIDELY_URL','http://127.0.0.1:5173')
CAP=os.path.join(os.path.dirname(os.path.abspath(__file__)),'capturas'); os.makedirs(CAP,exist_ok=True)
import tempfile
ANEXO=os.path.join(tempfile.gettempdir(),'ridely_aviso_teste.pdf')
open(ANEXO,'wb').write(b'%PDF-1.4\n'+b'x'*3000)
def login(ctx, email):
    p=ctx.new_page(); p.goto(B+'/login'); p.wait_for_load_state('networkidle')
    p.fill('#email',email); p.fill('#senha','Senha-de-teste-1'); p.click('button:has-text("Entrar")')
    expect(p.get_by_text(re.compile('^Olá,'))).to_be_visible(timeout=15000); return p
ok=[]
def passo(nome): ok.append(nome); print('ok  -', nome)
with sync_playwright() as pw:
    br=pw.chromium.launch()
    pres=login(br.new_context(viewport={'width':1200,'height':900}), 'paula@teste.com')
    ana=login(br.new_context(viewport={'width':1200,'height':900}, accept_downloads=True), 'ana@teste.com')
    bruno=login(br.new_context(viewport={'width':1200,'height':900}), 'bruno@teste.com')

    # --- presidente publica um comunicado com anexo
    pres.goto(B+'/comunicacao'); expect(pres.get_by_role('heading',name='Comunicação')).to_be_visible()
    expect(pres.get_by_role('tab',name='Rotinas automáticas')).to_be_visible(); passo('presidente vê as 3 abas, inclusive Rotinas automáticas')
    expect(ana.get_by_role('tab',name='Rotinas automáticas')).to_have_count(0) if ana.goto(B+'/comunicacao') else None; passo('associado vê só Comunicados e Notificações')
    pres.click('button:has-text("Novo comunicado")')
    pres.select_option('#tp','aviso'); pres.fill('#tt','Assembleia no sábado'); pres.fill('#ms','Assembleia geral às 9h.\nTraga o contrato.')
    pres.set_input_files('#ax',ANEXO)
    pres.click('button:has-text("Publicar")')
    expect(pres.get_by_role('status')).to_contain_text('enviado a 5 pessoas'); passo('publicar com anexo: "enviado a 5 pessoas"')
    pres.screenshot(path=CAP+'/1-presidente-publicou.png')
    expect(pres.get_by_text('Baixar anexo: '+os.path.basename(ANEXO))).to_be_visible(); passo('comunicado aparece na lista com o anexo')
    expect(pres.get_by_text('Avisou 5 pessoas; 0 já leram')).to_be_visible(); passo('quem publica vê a estatística de entrega')

    # --- Ana: sino, notificações, abrir, anexo
    ana.goto(B+'/'); expect(ana.get_by_role('link',name='1 notificações novas')).to_be_visible(); passo('sino da Ana mostra 1 nova')
    ana.get_by_role('link',name='1 notificações novas').click()
    expect(ana.get_by_text('Assembleia no sábado')).to_be_visible(); expect(ana.get_by_role('heading',name=re.compile('Minhas notificações'))).to_contain_text('1 nova')
    ana.screenshot(path=CAP+'/2-ana-notificacoes.png'); passo('aba Notificações destaca a nova')
    ana.get_by_role('button',name=re.compile('Assembleia no sábado')).click()
    expect(ana.get_by_role('link',name='Baixar anexo: '+os.path.basename(ANEXO))).to_be_visible()
    expect(ana.get_by_role('link',name=re.compile('notificações novas'))).to_have_count(0); passo('abrir marca como lida (some o contador) e leva ao comunicado')
    with ana.expect_download() as d: ana.get_by_role('link',name='Baixar anexo: '+os.path.basename(ANEXO)).click()
    dl=d.value; assert dl.suggested_filename==os.path.basename(ANEXO); passo('anexo baixa com o nome original')
    ana.screenshot(path=CAP+'/3-ana-comunicado.png')
    # estatística no lado da presidente
    pres.reload(); expect(pres.get_by_text('Avisou 5 pessoas; 1 já leu')).to_be_visible(); passo('presidente vê "1 já leu" depois que a Ana abriu')

    # --- editar
    pres.get_by_role('button',name='Editar').first.click(); pres.fill('#tt','Assembleia ADIADA para domingo')
    pres.click('button:has-text("Salvar alterações")'); pres.get_by_role('button',name='Cancelar').click()
    expect(pres.get_by_text('Assembleia ADIADA para domingo')).to_be_visible()
    ana.goto(B+'/comunicacao?aba=Notificações'); expect(ana.get_by_text('Assembleia ADIADA para domingo')).to_be_visible(); passo('editar: o painel da Ana mostra o título corrigido')

    # --- rotinas
    pres.goto(B+'/comunicacao?aba=Rotinas automáticas'); expect(pres.get_by_text('SMTP_URL')).to_be_visible(); passo('aviso de SMTP não configurado aparece')
    pres.get_by_role('button',name='Notificar atrasados agora').click()
    expect(pres.get_by_role('status').first).to_contain_text('1 notificação'); passo('"Notificar atrasados agora" cria 1 notificação (Ana, 18 dias de atraso)')
    pres.get_by_role('button',name='Notificar atrasados agora').click()
    expect(pres.get_by_role('status').first).to_contain_text('1 já enviada'); passo('rodar de novo não duplica')
    pres.get_by_role('row',name=re.compile('Contratos a vencer')).get_by_role('button').click()
    expect(pres.get_by_role('row',name=re.compile('Contratos a vencer')).get_by_role('status')).to_contain_text('notificação'); passo('contratos a vencer executa')
    pres.screenshot(path=CAP+'/4-rotinas.png')
    ana.goto(B+'/'); expect(ana.get_by_role('link',name=re.compile('notificações? novas?'))).to_be_visible()
    ana.get_by_role('link',name=re.compile('notificações? novas?')).click()
    expect(ana.get_by_text('Mensalidade de 10/2026 em atraso')).to_be_visible()
    expect(ana.get_by_text('multa de 5% (R$ 12,50) = R$ 262,50')).to_be_visible(); passo('Ana recebeu a cobrança com valor, multa e total')
    ana.screenshot(path=CAP+'/5-ana-cobranca.png')
    bruno.goto(B+'/comunicacao?aba=Notificações'); from datetime import date
    dias=(date(2026,11,20)-date.today()).days  # o contrato de demonstração termina em 20/11/2026
    expect(bruno.get_by_text(re.compile(f'Seu contrato termina em {dias} dias'))).to_be_visible(); passo(f'Bruno recebeu o aviso de contrato a vencer ({dias} dias)')
    # --- administração: novos parâmetros
    pres.goto(B+'/administracao'); pres.get_by_role('tab',name='Parâmetros').click()
    expect(pres.get_by_label(re.compile('Lembrete de vencimento'))).to_have_value('3'); expect(pres.get_by_label(re.compile('Cobrança de atrasados'))).to_have_value('7'); passo('Administração mostra os parâmetros novos (3 e 7)')
    # --- remover
    pres.goto(B+'/comunicacao'); pres.once('dialog', lambda d: d.accept()); pres.get_by_role('button',name='Remover').first.click()
    expect(pres.get_by_text('Assembleia ADIADA para domingo')).to_have_count(0); passo('remover comunicado some da lista')
    br.close()
print(f'\n{len(ok)} passos ok')
