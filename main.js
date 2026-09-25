import { createClient } from '@supabase/supabase-js'
import './style.css'

const SUPABASE_URL = 'https://pbpspiavtihqgdigedvn.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_uhM6t2Uw1vh2wHYCDx9tzg_ly3nXAqx'

// Vercel/Vite usa as variáveis VITE_* durante o build.
// Os valores abaixo funcionam como fallback para evitar que um ambiente
// de produção com variáveis ausentes/vazias impeça a inicialização do app.
const url = String(import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL).trim()
const key = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY).trim()

const supabase = createClient(url, key)

const app = document.querySelector('#app')

async function getMe(user) {
  const { data, error } = await supabase.from('usuarios').select('id,nome,perfil_id,ativo,perfis(id,nome,descricao)').eq('id', user.id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return {...data, perfil: Array.isArray(data.perfis) ? data.perfis[0] : data.perfis}
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))
}
function money(v) {
  return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
}
function shell(me, content) {
  app.innerHTML = `<div class="layout">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">TS</div><div><strong>TS Refrigeração</strong><small>Sistema Online</small></div></div>
      <nav>
        <button data-page="dashboard">📊 Dashboard</button>
        <button data-page="clientes">👥 Clientes</button>
        <button data-page="agenda">📅 Agenda</button>
        <button data-page="os">🧾 Ordens de serviço</button>
        <button data-page="financeiro">💰 Financeiro</button>
        <button data-page="servicos">🛠️ Serviços</button>
        <button data-page="usuarios">👤 Usuários</button>
      </nav>
      <div class="userbox"><b>${esc(me.nome)}</b><span>${esc(me.perfil?.nome)}</span><button id="logout">Sair</button></div>
    </aside>
    <section class="main"><header><div><h2 id="page-title">Dashboard</h2><span id="status">Conectado ao Supabase</span></div><button class="mobile-menu" id="mobileMenu">☰</button></header><div id="content">${content}</div></section>
  </div>`
  document.querySelectorAll('[data-page]').forEach(b => b.addEventListener('click', () => loadPage((b).dataset.page)))
  document.querySelector('#logout')?.addEventListener('click', async()=>{await supabase.auth.signOut()})
  document.querySelector('#mobileMenu')?.addEventListener('click',()=>document.querySelector('.sidebar')?.classList.toggle('open'))
}
function table(rows, heads) {
  return `<div class="table-wrap"><table><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`
}
async function loadPage(page) {
  const {data:{user}} = await supabase.auth.getUser()
  if (!user) return
  const me = await getMe(user)
  if (!me || !me.ativo) return login('Usuário sem cadastro ativo no sistema.')
  const title ={dashboard:'Dashboard',clientes:'Clientes',agenda:'Agenda',os:'Ordens de serviço',financeiro:'Financeiro',servicos:'Serviços',usuarios:'Usuários'}
  const t=document.querySelector('#page-title'); if(t)t.textContent=title[page]||'Dashboard'
  const c=document.querySelector('#content')
  c.innerHTML='<div class="loading">Carregando...</div>'
  try {
    if(page==='dashboard') await dashboard(c)
    if(page==='clientes') await clientes(c)
    if(page==='agenda') await agenda(c)
    if(page==='os') await ordens(c)
    if(page==='financeiro') await financeiro(c)
    if(page==='servicos') await servicos(c)
    if(page==='usuarios') await usuarios(c, me)
  } catch(e) { c.innerHTML=`<div class="error"><b>Erro:</b> ${esc(e.message)}</div>` }
}
async function dashboard(c) {
  const [cli,os,ag,pay] = await Promise.all([
    supabase.from('clientes').select('id',{count:'exact',head:true}),
    supabase.from('ordens_servico').select('id,valor_total,status'),
    supabase.from('agendamentos').select('id',{count:'exact',head:true}).eq('status','Agendado'),
    supabase.from('pagamentos').select('valor')
  ])
  const totalOS=(os.data||[]).reduce((s,r)=>s+Number(r.valor_total||0),0)
  const recebido=(pay.data||[]).reduce((s,r)=>s+Number(r.valor||0),0)
  const abertas=(os.data||[]).filter((r)=>!['concluida','cancelada'].includes((r.status||'').toLowerCase())).length
  c.innerHTML=`<div class="hero"><div><h1>Olá! 👋</h1><p>Gestão da TS Refrigeração em um só lugar.</p></div><button class="primary" onclick="window.__newOS()">+ Nova OS</button></div>
  <div class="cards">
    <div class="card"><span>Clientes</span><b>${cli.count||0}</b></div>
    <div class="card"><span>OS abertas</span><b>${abertas}</b></div>
    <div class="card"><span>Agendamentos</span><b>${ag.count||0}</b></div>
    <div class="card"><span>Total das OS</span><b>${money(totalOS)}</b></div>
    <div class="card"><span>Recebido</span><b>${money(recebido)}</b></div>
  </div>
  <div class="panel"><h3>Próximos passos</h3><p>Cadastre clientes e equipamentos, crie a agenda e abra suas primeiras ordens de serviço.</p></div>`
  ;window.__newOS=()=>loadPage('os')
}
async function clientes(c) {
  const {data,error}=await supabase.from('clientes').select('*').eq('ativo',true).order('nome')
  if(error)throw error
  c.innerHTML=`<div class="toolbar"><input id="search" placeholder="Buscar cliente..." /><button class="primary" id="add">+ Novo cliente</button></div><div id="clientTable"></div>`
  const render=(filter='')=>{
    const list=(data||[]).filter((x)=>`${x.nome} ${x.telefone||''} ${x.cpf_cnpj||''}`.toLowerCase().includes(filter.toLowerCase()))
    ;(document.querySelector('#clientTable')).innerHTML=table(list.map((x)=>`<tr><td><b>${esc(x.nome)}</b><small>${esc(x.cpf_cnpj||'')}</small></td><td>${esc(x.telefone||x.whatsapp||'')}</td><td>${esc(x.cidade||'')}/${esc(x.estado||'')}</td><td><button class="link" data-id="${x.id}">Editar</button></td></tr>`),['Cliente','Telefone','Local',''])
  }
  render()
  document.querySelector('#search')?.addEventListener('input',(e)=>render(e.target.value))
  document.querySelector('#add')?.addEventListener('click',()=>clientForm())
  document.querySelectorAll('.link').forEach(b=>b.addEventListener('click',()=>clientForm((data||[]).find((x)=>x.id===(b).dataset.id))))
}
function clientForm(x={}) {
  const content=document.querySelector('#content')
  content.innerHTML=`<div class="panel form"><h3>${x.id?'Editar':'Novo'} cliente</h3>
  <div class="grid2"><label>Nome*<input id="nome" value="${esc(x.nome)}"></label><label>Tipo<select id="tipo"><option ${(!x.tipo_pessoa || x.tipo_pessoa==='Física')?'selected':''}>Física</option><option ${x.tipo_pessoa==='Jurídica'?'selected':''}>Jurídica</option></select></label>
  <label>CPF/CNPJ<input id="doc" value="${esc(x.cpf_cnpj)}"></label><label>Telefone<input id="tel" value="${esc(x.telefone)}"></label>
  <label>WhatsApp<input id="zap" value="${esc(x.whatsapp)}"></label><label>E-mail<input id="email" value="${esc(x.email)}"></label>
  <label>CEP<input id="cep" value="${esc(x.cep)}"></label><label>Endereço<input id="end" value="${esc(x.endereco)}"></label>
  <label>Número<input id="num" value="${esc(x.numero)}"></label><label>Complemento<input id="comp" value="${esc(x.complemento)}"></label>
  <label>Bairro<input id="bairro" value="${esc(x.bairro)}"></label><label>Cidade<input id="cidade" value="${esc(x.cidade)}"></label>
  <label>Estado<input id="estado" maxlength="2" value="${esc(x.estado)}"></label></div>
  <div class="actions"><button class="secondary" id="cancel">Cancelar</button><button class="primary" id="save">Salvar cliente</button></div></div>`
  document.querySelector('#cancel')?.addEventListener('click',()=>loadPage('clientes'))
  document.querySelector('#save')?.addEventListener('click',async()=>{
    const {data:{user}}=await supabase.auth.getUser(); if(!user)return
    const payload={tipo_pessoa:(document.querySelector('#tipo')).value,nome:(document.querySelector('#nome')).value,cpf_cnpj:(document.querySelector('#doc')).value,telefone:(document.querySelector('#tel')).value,whatsapp:(document.querySelector('#zap')).value,email:(document.querySelector('#email')).value,cep:(document.querySelector('#cep')).value,endereco:(document.querySelector('#end')).value,numero:(document.querySelector('#num')).value,complemento:(document.querySelector('#comp')).value,bairro:(document.querySelector('#bairro')).value,cidade:(document.querySelector('#cidade')).value,estado:(document.querySelector('#estado')).value,ativo:true,criado_por:user.id}
    const q=x.id?supabase.from('clientes').update(payload).eq('id',x.id):supabase.from('clientes').insert(payload)
    const {error}=await q;if(error)return alert(error.message);await loadPage('clientes')
  })
}
async function agenda(c) {
  const {data,error}=await supabase.from('agendamentos').select('*,clientes(nome),tecnico:usuarios!agendamentos_tecnico_id_fkey(nome),criado_por_usuario:usuarios!agendamentos_criado_por_fkey(nome),equipamentos(tipo,marca)').order('data_agendamento').order('hora_inicio')
  if(error)throw error
  c.innerHTML=`<div class="toolbar"><input id="date" type="date"><button class="primary" id="refresh">Atualizar</button></div>${table((data||[]).map((x)=>`<tr><td>${esc(x.data_agendamento)} ${esc(x.hora_inicio?.slice(0,5)||'')}</td><td>${esc(x.clientes?.nome||'')}</td><td>${esc(x.tipo_servico||'')}</td><td><span class="badge">${esc(x.status||'')}</span></td></tr>`),['Data/Hora','Cliente','Serviço','Status'])}`
}
async function ordens(c) {
  const {data,error}=await supabase.from('ordens_servico').select('*,clientes(nome),tecnico:usuarios!ordens_servico_tecnico_id_fkey(nome),criado_por_usuario:usuarios!ordens_servico_criado_por_fkey(nome)').order('criado_em',{ascending:false}).limit(100)
  if(error)throw error
  c.innerHTML=`<div class="toolbar"><input id="ossearch" placeholder="Buscar número, cliente ou status..."><button class="primary" id="newos">+ Nova OS</button></div><div id="ostable"></div>`
  const render=(f='')=>{
    const list=(data||[]).filter((x)=>`${x.numero} ${x.clientes?.nome||''} ${x.status||''}`.toLowerCase().includes(f.toLowerCase()))
    document.querySelector('#ostable').innerHTML=table(list.map((x)=>`<tr><td><b>#${x.numero||''}</b></td><td>${esc(x.clientes?.nome||'')}</td><td><span class="badge">${esc(x.status||'')}</span></td><td>${money(x.valor_total)}</td><td><button class="link" data-os="${x.id}">Abrir</button></td></tr>`),['OS','Cliente','Status','Total',''])
    document.querySelectorAll('[data-os]').forEach(b=>b.addEventListener('click',()=>osView((data||[]).find((x)=>x.id===(b).dataset.os))))
  }
  render();document.querySelector('#ossearch')?.addEventListener('input',(e)=>render(e.target.value));document.querySelector('#newos')?.addEventListener('click',()=>osForm())
}
async function osForm() {
  const [{data:clients},{data:techs},{data:services}]=await Promise.all([
    supabase.from('clientes').select('id,nome').eq('ativo',true).order('nome'),
    supabase.from('usuarios').select('id,nome').eq('ativo',true).order('nome'),
    supabase.from('servicos').select('id,nome,valor_padrao').eq('ativo',true).order('nome')
  ])
  const c=document.querySelector('#content')
  c.innerHTML=`<div class="panel form"><h3>Nova ordem de serviço</h3><div class="grid2">
  <label>Cliente*<select id="client"><option value="">Selecione</option>${(clients||[]).map((x)=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></label>
  <label>Técnico<select id="tech"><option value="">Selecione</option>${(techs||[]).map((x)=>`<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></label>
  <label>Prioridade<select id="priority"><option>normal</option><option>alta</option><option>urgente</option></select></label>
  <label>Valor dos serviços<input id="valor" type="number" step="0.01" value="0"></label>
  <label class="wide">Problema relatado<textarea id="problem"></textarea></label>
  <label class="wide">Diagnóstico<textarea id="diag"></textarea></label>
  <label class="wide">Serviço executado<textarea id="exec"></textarea></label>
  <label class="wide">Observações<textarea id="obs"></textarea></label></div>
  <div class="actions"><button class="secondary" id="back">Cancelar</button><button class="primary" id="saveos">Criar OS</button></div></div>`
  document.querySelector('#back')?.addEventListener('click',()=>loadPage('os'))
  document.querySelector('#saveos')?.addEventListener('click',async()=>{
    const {data:{user}}=await supabase.auth.getUser(); if(!user)return
    const cliente=(document.querySelector('#client')).value
    if(!cliente)return alert('Selecione o cliente.')
    const valor=Number((document.querySelector('#valor')).value||0)
    const payload={cliente_id:cliente,tecnico_id:(document.querySelector('#tech')).value||null,status:'Aberta',prioridade:(document.querySelector('#priority')).value.charAt(0).toUpperCase()+(document.querySelector('#priority')).value.slice(1),problema_relatado:(document.querySelector('#problem')).value,diagnostico:(document.querySelector('#diag')).value,servico_executado:(document.querySelector('#exec')).value,observacoes:(document.querySelector('#obs')).value,valor_servicos:valor,valor_pecas:0,desconto:0,criado_por:user.id}
    const {data,error}=await supabase.from('ordens_servico').insert(payload).select().single()
    if(error)return alert(error.message)
    alert(`OS #${data.numero} criada com sucesso.`);loadPage('os')
  })
}
function osView(x) {
  document.querySelector('#content').innerHTML=`<div class="panel"><div class="detail-head"><div><h3>OS #${x.numero}</h3><p>${esc(x.clientes?.nome||'')}</p></div><span class="badge">${esc(x.status)}</span></div>
  <div class="cards mini"><div class="card"><span>Serviços</span><b>${money(x.valor_servicos)}</b></div><div class="card"><span>Peças</span><b>${money(x.valor_pecas)}</b></div><div class="card"><span>Desconto</span><b>${money(x.desconto)}</b></div><div class="card"><span>Total</span><b>${money(x.valor_total)}</b></div></div>
  <dl class="details"><dt>Prioridade</dt><dd>${esc(x.prioridade)}</dd><dt>Problema</dt><dd>${esc(x.problema_relatado)}</dd><dt>Diagnóstico</dt><dd>${esc(x.diagnostico)}</dd><dt>Serviço executado</dt><dd>${esc(x.servico_executado)}</dd><dt>Observações</dt><dd>${esc(x.observacoes)}</dd></dl><button class="secondary" onclick="location.reload()">Voltar</button></div>`
}
async function financeiro(c) {
  const {data,error}=await supabase.from('pagamentos').select('*,ordens_servico(numero,cliente_id,clientes(nome))').order('data_pagamento',{ascending:false}).limit(200)
  if(error)throw error
  const total=(data||[]).reduce((s,x)=>s+Number(x.valor||0),0)
  c.innerHTML=`<div class="cards"><div class="card"><span>Recebimentos</span><b>${money(total)}</b></div><div class="card"><span>Lançamentos</span><b>${data?.length||0}</b></div></div>${table((data||[]).map((x)=>`<tr><td>${esc(x.ordens_servico?.numero||'')}</td><td>${esc(x.ordens_servico?.clientes?.nome||'')}</td><td>${esc(x.forma_pagamento||'')}</td><td>${money(x.valor)}</td><td>${esc(x.data_pagamento?.slice(0,10)||'')}</td></tr>`),['OS','Cliente','Forma','Valor','Data'])}`
}
async function servicos(c) {
  const {data,error}=await supabase.from('servicos').select('*').order('nome');if(error)throw error
  c.innerHTML=`<div class="toolbar"><button class="primary" id="addsvc">+ Novo serviço</button></div>${table((data||[]).map((x)=>`<tr><td><b>${esc(x.nome)}</b><small>${esc(x.descricao||'')}</small></td><td>${money(x.valor_padrao)}</td><td><span class="badge">${x.ativo?'Ativo':'Inativo'}</span></td></tr>`),['Serviço','Valor padrão','Status'])}`
}
async function usuarios(c, me) {
  const {data,error}=await supabase.from('usuarios').select('id,nome,telefone,ativo,perfis(nome)').order('nome');if(error)throw error
  c.innerHTML=`<div class="notice">O cadastro de usuários deve ser feito primeiro em <b>Supabase Authentication → Users</b>. Depois, associe o usuário ao perfil nesta tabela.</div>${table((data||[]).map((x)=>`<tr><td><b>${esc(x.nome)}</b></td><td>${esc(x.telefone||'')}</td><td>${esc(Array.isArray(x.perfis)?x.perfis[0]?.nome:x.perfis?.nome||'')}</td><td><span class="badge">${x.ativo?'Ativo':'Inativo'}</span></td></tr>`),['Usuário','Telefone','Perfil','Status'])}`
}
function login(msg='') {
  app.innerHTML=`<main class="login"><div class="login-card"><div class="brand center"><div class="brand-mark">TS</div><div><strong>TS Refrigeração</strong><small>Gestão de serviços</small></div></div><h1>Acesso ao sistema</h1>${msg?`<div class="error">${esc(msg)}</div>`:''}<label>E-mail<input id="email" type="email" autocomplete="username"></label><label>Senha<input id="password" type="password" autocomplete="current-password"></label><button class="primary full" id="login">Entrar</button><p class="hint">A autenticação é feita pelo Supabase.</p></div></main>`
  document.querySelector('#login')?.addEventListener('click',async()=>{
    const email=(document.querySelector('#email')).value
    const password=(document.querySelector('#password')).value
    const {error}=await supabase.auth.signInWithPassword({email,password})
    if(error)return login(error.message)
    boot()
  })
}
async function boot() {
  const {data:{session}}=await supabase.auth.getSession()
  if(!session)return login()
  const me=await getMe(session.user)
  if(!me)return login('Seu usuário Auth ainda não está associado à tabela usuarios.')
  if(!me.ativo)return login('Seu usuário está inativo.')
  shell(me,'<div class="loading">Carregando...</div>')
  await loadPage('dashboard')
}
supabase.auth.onAuthStateChange((_event, session)=>{ if(!session) login() })
boot()
