from playwright.sync_api import sync_playwright, expect
import re
import os
B=os.environ.get('RIDELY_URL','http://127.0.0.1:5173')
TELAS={'presidente':('paula@teste.com',['/','/associados','/veiculos-rotas','/financeiro','/controles-financeiros','/contratos','/transporte','/comunicacao','/relatorios','/administracao','/perfil']),
       'tesoureiro':('tiago@teste.com',['/','/associados','/financeiro','/controles-financeiros','/contratos','/comunicacao','/relatorios','/perfil']),
       'associado':('ana@teste.com',['/','/financeiro','/contratos','/transporte','/comunicacao','/perfil']),
       'vice':('vera@teste.com',['/','/associados','/veiculos-rotas','/contratos','/transporte','/comunicacao','/relatorios','/perfil'])}
res=[]
with sync_playwright() as pw:
    br=pw.chromium.launch()
    for perfil,(email,rotas) in TELAS.items():
        ctx=br.new_context(viewport={'width':1200,'height':900}); p=ctx.new_page()
        erros=[]
        p.on('pageerror', lambda e: erros.append(f'JS: {str(e)[:150]}'))
        p.on('response', lambda r: erros.append(f'{r.status} {r.request.method} {r.url.split("/api")[-1][:70]}') if '/api/' in r.url and r.status>=500 else None)
        p.goto(B+'/login'); p.wait_for_load_state('networkidle')
        p.fill('#email',email); p.fill('#senha','Senha-de-teste-1'); p.click('button:has-text("Entrar")')
        expect(p.get_by_text(re.compile('^Olá,'))).to_be_visible(timeout=15000)
        for r in rotas:
            erros.clear() if False else None
            before=len(erros)
            p.goto(B+r); p.wait_for_timeout(1200)
            txt=p.inner_text('body')
            if 'Algo deu errado' in txt or 'Cannot read' in txt or 'undefined' in txt: erros.append('TEXTO: erro/undefined na tela')
            novos=erros[before:]
            res.append((perfil,r,'OK' if not novos else 'FALHA: '+' ; '.join(novos)))
        ctx.close()
    br.close()
for x in res: print(f'{x[0]:11} {x[1]:20} {x[2]}')
print('falhas:', sum(1 for x in res if x[2]!='OK'), 'de', len(res))
